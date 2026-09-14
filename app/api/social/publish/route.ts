import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'
import { hentbarMediaUrl } from '../../../../lib/r2-presign'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

type PublishResult = {
  connectionId: string
  platform: string
  pageName: string
  success: boolean
  postId?: string
  error?: string
  // Instagram: containeren er opprettet, men Meta er ikke ferdig med aa
  // prosessere videoen. Raden i reelhome_publications staar som 'processing'
  // og fullfoeres av finishPendingPublications (klient-polling eller cron).
  pending?: boolean
  publicationId?: string
}

// Hvor lenge en Instagram-container faar staa som 'processing' foer vi gir
// opp. Meta bruker normalt 30-60 s; en time betyr at noe har gaatt galt.
const PROSESSERING_MAKS_MS = 60 * 60 * 1000

type Connection = {
  id: string
  platform: string
  page_id: string
  page_name: string
  access_token: string
}

/**
 * Publish a video to the given connections and log each result to the
 * `publications` table. Shared by the interactive publish endpoint and the
 * scheduled-publishing cron.
 */
export async function publishVideoToConnections(opts: {
  userId: string
  videoUrl: string
  caption: string
  connections: Connection[]
  propertyId?: string | null
}): Promise<PublishResult[]> {
  const { userId, videoUrl, caption, connections, propertyId = null } = opts
  const supabase = getServiceClient()

  // Legg ved lenke til annonsen (Hjem.no foretrukket, ellers Finn.no) i posten.
  let listingUrl: string | null = null
  if (propertyId) {
    const { data: prop } = await supabase
      .from('properties')
      .select('finn_url, hjem_url')
      .eq('id', propertyId)
      .maybeSingle()
    listingUrl = prop?.hjem_url || prop?.finn_url || null
  }
  const fullCaption = listingUrl
    ? `${caption ? caption + '\n\n' : ''}Se hele annonsen: ${listingUrl}`
    : caption

  // URL-en Facebook og Instagram henter fila fra. Ligger videoen på det
  // ratebegrensede R2-dev-domenet, byttes den mot en presignert URL — ellers
  // uendret. Loggingen under beholder den varige `videoUrl`.
  //
  // ⚠️ Gjelder BARE Facebook/Instagram: de laster fila ned én gang og lagrer
  // den selv. LinkedIn-grenen deler en ARTICLE der `originalUrl` blir stående
  // som en permanent lenke i posten — en presignert URL ville vært død etter
  // en time, så den må ha original-URL-en.
  const hentbarUrl = await hentbarMediaUrl(videoUrl)

  const results: PublishResult[] = await Promise.all(
    connections.map(async conn => {
      let result: { success: boolean; postId?: string; error?: string }

      if (conn.platform === 'facebook') {
        result = await publishToFacebook(conn.page_id, conn.access_token, hentbarUrl, fullCaption)
      } else if (conn.platform === 'instagram') {
        // Instagram bruker 30-60 s paa aa prosessere en video, og Netlify
        // kutter API-svaret etter 26 s. Foer ventet vi her -- gatewayen ga
        // opp, klienten fikk aldri noe svar, og dialogen nullstilte seg uten
        // bekreftelse mens innlegget likevel gikk ut (screencast-take 4,
        // 14/9). Naa oppretter vi bare containeren og svarer med en gang;
        // fullfoeringen skjer i finishPendingPublications.
        const start = await startInstagram(conn.page_id, conn.access_token, hentbarUrl, fullCaption)
        if (start.containerId) {
          const { data: row, error: logErr } = await supabase
            .from('reelhome_publications')
            .insert({
              user_id:       userId,
              property_id:   propertyId,
              connection_id: conn.id,
              platform:      conn.platform,
              page_name:     conn.page_name,
              caption:       fullCaption,
              video_url:     videoUrl,
              // Container-id-en laaner post_id til publiseringen er ferdig;
              // da byttes den ut med det ekte innleggets id.
              post_id:       start.containerId,
              status:        'processing',
              error:         null,
            })
            .select('id')
            .single()
          if (logErr) console.error('[publish] kunne ikke logge instagram-container:', logErr.message)
          return {
            connectionId:  conn.id,
            platform:      conn.platform,
            pageName:      conn.page_name,
            success:       false,
            pending:       true,
            publicationId: row?.id,
          }
        }
        result = { success: false, error: start.error }
      } else if (conn.platform === 'linkedin') {
        result = await publishToLinkedIn(conn.page_id, conn.access_token, videoUrl, fullCaption)
      } else {
        result = { success: false, error: `Ukjent plattform: ${conn.platform}` }
      }

      // Log the outcome so it shows up in the calendar / history.
      // reelhome_publications er ReelHome-eid (den delte `publications` er ContentForge sin
      // og har feil skjema → tidligere feilet denne loggingen stille).
      const { error: logErr } = await supabase.from('reelhome_publications').insert({
        user_id:       userId,
        property_id:   propertyId,
        connection_id: conn.id,
        platform:      conn.platform,
        page_name:     conn.page_name,
        caption:       fullCaption,
        video_url:     videoUrl,
        post_id:       result.postId ?? null,
        status:        result.success ? 'published' : 'failed',
        error:         result.error ?? null,
      })
      if (logErr) console.error('[publish] kunne ikke logge publisering:', logErr.message)

      return {
        connectionId: conn.id,
        platform:     conn.platform,
        pageName:     conn.page_name,
        ...result,
      }
    })
  )

  return results
}

/**
 * Fullfoerer Instagram-publiseringer som staar som 'processing': sjekker
 * containerens status hos Meta EN gang per rad og publiserer hvis den er
 * FINISHED. Ingen venting her -- kalleren (klientens polling eller cronen)
 * kommer tilbake. Rader som har staatt for lenge markeres som feilet.
 */
export async function finishPendingPublications(
  supabase: ReturnType<typeof getServiceClient>,
  filter: { userId?: string; ids?: string[] }
): Promise<{ id: string; pageName: string; status: 'processing' | 'published' | 'failed'; postId?: string; error?: string }[]> {
  let query = supabase
    .from('reelhome_publications')
    .select('id, user_id, connection_id, page_name, post_id, created_at')
    .eq('status', 'processing')
    .eq('platform', 'instagram')
  if (filter.userId) query = query.eq('user_id', filter.userId)
  if (filter.ids && filter.ids.length > 0) query = query.in('id', filter.ids)
  const { data: rows, error } = await query
  if (error) {
    console.error('[publish] kunne ikke hente ventende publiseringer:', error.message)
    return []
  }

  const out: { id: string; pageName: string; status: 'processing' | 'published' | 'failed'; postId?: string; error?: string }[] = []
  for (const row of rows ?? []) {
    const { data: conn } = await supabase
      .from('social_connections')
      .select('page_id, access_token')
      .eq('id', row.connection_id)
      .maybeSingle()

    let res: { status: 'processing' | 'published' | 'failed'; postId?: string; error?: string }
    if (!conn || !row.post_id) {
      res = { status: 'failed', error: 'Tilkoblingen finnes ikke lenger' }
    } else {
      res = await finishInstagram(conn.page_id, conn.access_token, row.post_id)
    }
    if (res.status === 'processing' && Date.now() - new Date(row.created_at).getTime() > PROSESSERING_MAKS_MS) {
      res = { status: 'failed', error: 'Timeout: Instagram ble ikke ferdig med videoen innen en time' }
    }
    if (res.status !== 'processing') {
      const { error: updErr } = await supabase
        .from('reelhome_publications')
        .update({ status: res.status, post_id: res.postId ?? null, error: res.error ?? null })
        .eq('id', row.id)
      if (updErr) console.error('[publish] kunne ikke oppdatere publisering:', updErr.message)
    }
    out.push({ id: row.id, pageName: row.page_name, ...res })
  }
  return out
}

async function startInstagram(
  igUserId: string,
  accessToken: string,
  videoUrl: string,
  caption: string
): Promise<{ containerId?: string; error?: string }> {
  try {
    const containerRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type:   'REELS',
        video_url:    videoUrl,
        caption,
        access_token: accessToken,
      }),
    })
    const containerData = await containerRes.json()
    if (containerData.error || !containerData.id) {
      console.error('[publish/instagram] Container error:', containerData.error)
      return { error: containerData.error?.message ?? 'Kunne ikke opprette container' }
    }
    return { containerId: containerData.id }
  } catch (err) {
    console.error('[publish/instagram] Exception:', err)
    return { error: String(err) }
  }
}

async function finishInstagram(
  igUserId: string,
  accessToken: string,
  containerId: string
): Promise<{ status: 'processing' | 'published' | 'failed'; postId?: string; error?: string }> {
  try {
    const statusRes = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`
    )
    const statusData = await statusRes.json()
    if (statusData.error) {
      return { status: 'failed', error: statusData.error.message ?? 'Kunne ikke lese container-status' }
    }
    const code: string = statusData.status_code ?? ''
    if (code === 'ERROR' || code === 'EXPIRED') {
      return { status: 'failed', error: `Video-prosessering feilet: ${code}` }
    }
    if (code !== 'FINISHED') return { status: 'processing' }

    const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
    })
    const publishData = await publishRes.json()
    if (publishData.error) {
      console.error('[publish/instagram] Publish error:', publishData.error)
      return { status: 'failed', error: publishData.error.message ?? 'Publisering feilet' }
    }
    return { status: 'published', postId: publishData.id }
  } catch (err) {
    console.error('[publish/instagram] Exception:', err)
    return { status: 'failed', error: String(err) }
  }
}

async function publishToFacebook(
  pageId: string,
  accessToken: string,
  videoUrl: string,
  caption: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_url:     videoUrl,
        description:  caption,
        access_token: accessToken,
      }),
    })
    const data = await res.json()
    if (data.error) {
      console.error('[publish/facebook] Error:', data.error)
      return { success: false, error: data.error.message ?? 'Ukjent feil' }
    }
    return { success: true, postId: data.id }
  } catch (err) {
    console.error('[publish/facebook] Exception:', err)
    return { success: false, error: String(err) }
  }
}

async function publishToLinkedIn(
  pageId: string,
  accessToken: string,
  videoUrl: string,
  caption: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // Determine author URN — company pages start with numeric IDs, personal profiles
    // are stored as the sub (also numeric but treated as person)
    // We distinguish by checking if the connection's page_id matches the platform_user_id
    // (personal) vs a different org ID (company). For simplicity: if pageId looks like
    // a URN prefix "urn:li:" it's already formatted; otherwise build it.
    // Company pages: urn:li:organization:{id}
    // Personal profiles: urn:li:person:{id}  (but w_member_social uses person URN)
    // We can't easily distinguish here without extra metadata, so we try person first,
    // fallback to organization. The calling code passes the page_id from social_connections.
    // Company page_ids come from organizationAcls; personal page_ids == sub (openid).
    // LinkedIn sub format: a string like "78V9Zks3Kx" — not purely numeric.
    // Organization IDs from organizationAcls are purely numeric.
    const isOrg = /^\d+$/.test(pageId)
    const authorUrn = isOrg
      ? `urn:li:organization:${pageId}`
      : `urn:li:person:${pageId}`

    const body = {
      author:     authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: caption },
          shareMediaCategory: 'ARTICLE',
          media: [
            {
              status: 'READY',
              originalUrl: videoUrl,
              title: { text: 'Video' },
            },
          ],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      console.error('[publish/linkedin] Error:', errData)
      return { success: false, error: errData.message ?? `HTTP ${res.status}` }
    }

    const postId = res.headers.get('x-restli-id') ?? undefined
    return { success: true, postId }
  } catch (err) {
    console.error('[publish/linkedin] Exception:', err)
    return { success: false, error: String(err) }
  }
}

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { video_url, caption = '', connection_ids, property_id = null } = await request.json()

  if (!video_url) return NextResponse.json({ error: 'Mangler video_url' }, { status: 400 })
  if (!Array.isArray(connection_ids) || connection_ids.length === 0) {
    return NextResponse.json({ error: 'Mangler connection_ids' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // Fetch the requested connections (verify they belong to this user)
  const { data: connections, error: dbErr } = await supabase
    .from('social_connections')
    .select('id, platform, page_id, page_name, access_token')
    .eq('user_id', user.id)
    .in('id', connection_ids)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!connections || connections.length === 0) {
    return NextResponse.json({ error: 'Ingen gyldige tilkoblinger funnet' }, { status: 400 })
  }

  const results = await publishVideoToConnections({
    userId:      user.id,
    videoUrl:    video_url,
    caption,
    connections,
    propertyId:  property_id,
  })

  const allOk = results.every(r => r.success)

  // Historikk logges allerede til reelhome_publications inne i publishVideoToConnections.
  // (scheduled_publications er kun for FREMTIDIGE planlagte poster — umiddelbare publiseringer
  // skal ikke opprette rader der.)

  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 })
}
