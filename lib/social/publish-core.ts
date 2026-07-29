import { createClient } from '@supabase/supabase-js'

/**
 * Kjerne-logikk for sosial publisering, HOLDT FRI for Next-import (ingen
 * `next/server`, ingen `next/headers`) slik at en vanlig Netlify-funksjon
 * (netlify/functions/*.mts) kan importere den. Route-handlerne og cron-en
 * i app/ importerer den samme logikken herfra.
 *
 * Instagram er asynkron: Reels-containeren må prosesseres av Meta (kan ta
 * lengre tid enn Netlifys ~26s serverless-tak), så vi splitter IG i
 *   1) `createInstagramContainer` (ett raskt kall, kjøres inline i request-en)
 *   2) `runInstagramJob` (poll + media_publish + logg), som kjøres i en
 *      Netlify Background Function (opptil 15 min).
 * Facebook/LinkedIn er ett raskt kall hver og kjøres fortsatt synkront inline.
 */

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type PublishResult = {
  connectionId: string
  platform: string
  pageName: string
  success: boolean
  /** true mens en Instagram-jobb prosesseres i bakgrunnen (ennå ikke ferdig). */
  pending?: boolean
  /** id-en til reelhome_publications-raden — lar UI polle akkurat denne raden. */
  rowId?: string
  postId?: string
  error?: string
}

export type Connection = {
  id: string
  platform: string
  page_id: string
  page_name: string
  access_token: string
}

/** En Instagram-publiseringsjobb som kjøres asynkront av bakgrunnsfunksjonen. */
export type InstagramJob = {
  /** id-en til den forhåndsopprettede `reelhome_publications`-raden (status 'processing'). */
  rowId: string
  igUserId: string
  accessToken: string
  containerId: string
}

/**
 * Publiser til gitte connections og logg hvert utfall til `reelhome_publications`.
 * Delt av det interaktive publish-endepunktet og den planlagte cron-en.
 *
 * Facebook/LinkedIn publiseres synkront inline. Instagram opprettes som en
 * `processing`-rad + container og dispatches til bakgrunnsfunksjonen; disse
 * returneres med `pending: true`. Den terminale statusen (published/failed)
 * skrives til den samme raden av `runInstagramJob`.
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

  const igJobs: InstagramJob[] = []

  const results: PublishResult[] = await Promise.all(
    connections.map(async (conn): Promise<PublishResult> => {
      // Instagram: opprett container + processing-rad, dispatch senere.
      if (conn.platform === 'instagram') {
        const container = await createInstagramContainer(
          conn.page_id, conn.access_token, videoUrl, fullCaption
        )
        if (!container.success || !container.containerId) {
          // Containeren feilet umiddelbart → logg failed-rad med én gang.
          await insertPublicationRow(supabase, {
            userId, propertyId, conn, caption: fullCaption, videoUrl,
            status: 'failed', error: container.error ?? 'Kunne ikke opprette container',
          })
          return {
            connectionId: conn.id, platform: conn.platform, pageName: conn.page_name,
            success: false, error: container.error ?? 'Kunne ikke opprette container',
          }
        }

        // Forhåndsopprett raden som 'processing' så historikken ALLTID har et spor,
        // uansett om bakgrunnsjobben rekker å fullføre eller ikke.
        const rowId = await insertPublicationRow(supabase, {
          userId, propertyId, conn, caption: fullCaption, videoUrl,
          status: 'processing', error: null,
        })
        if (!rowId) {
          return {
            connectionId: conn.id, platform: conn.platform, pageName: conn.page_name,
            success: false, error: 'Kunne ikke opprette historikk-rad',
          }
        }

        igJobs.push({
          rowId,
          igUserId: conn.page_id,
          accessToken: conn.access_token,
          containerId: container.containerId,
        })
        return {
          connectionId: conn.id, platform: conn.platform, pageName: conn.page_name,
          success: false, pending: true, rowId,
        }
      }

      // Facebook / LinkedIn: synkront, som før.
      let result: { success: boolean; postId?: string; error?: string }
      if (conn.platform === 'facebook') {
        result = await publishToFacebook(conn.page_id, conn.access_token, videoUrl, fullCaption)
      } else if (conn.platform === 'linkedin') {
        result = await publishToLinkedIn(conn.page_id, conn.access_token, videoUrl, fullCaption)
      } else {
        result = { success: false, error: `Ukjent plattform: ${conn.platform}` }
      }

      await insertPublicationRow(supabase, {
        userId, propertyId, conn, caption: fullCaption, videoUrl,
        status: result.success ? 'published' : 'failed',
        error: result.error ?? null, postId: result.postId ?? null,
      })

      return {
        connectionId: conn.id, platform: conn.platform, pageName: conn.page_name,
        ...result,
      }
    })
  )

  // Dispatch Instagram-jobbene til bakgrunnsfunksjonen (202, opptil 15 min).
  if (igJobs.length > 0) {
    await dispatchInstagramJobs(igJobs, supabase)
  }

  return results
}

/** Insert én rad i reelhome_publications. Returnerer rad-id (eller null ved feil). */
async function insertPublicationRow(
  supabase: ReturnType<typeof getServiceClient>,
  row: {
    userId: string
    propertyId: string | null
    conn: Connection
    caption: string
    videoUrl: string
    status: 'processing' | 'published' | 'failed'
    error: string | null
    postId?: string | null
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('reelhome_publications')
    .insert({
      user_id:       row.userId,
      property_id:   row.propertyId,
      connection_id: row.conn.id,
      platform:      row.conn.platform,
      page_name:     row.conn.page_name,
      caption:       row.caption,
      video_url:     row.videoUrl,
      post_id:       row.postId ?? null,
      status:        row.status,
      error:         row.error,
    })
    .select('id')
    .single()
  if (error) {
    console.error('[publish] kunne ikke logge publisering:', error.message)
    return null
  }
  return data.id as string
}

/**
 * Fyr av Instagram-jobbene mot Netlify Background Function. Vi awaiter kun
 * 202-dispatchen (returnerer på <1s); selve prosesseringen skjer uavhengig
 * server-side. Feiler dispatchen, markerer vi de forhåndsopprettede radene
 * som failed så de ikke blir hengende i 'processing'.
 */
async function dispatchInstagramJobs(
  jobs: InstagramJob[],
  supabase: ReturnType<typeof getServiceClient>
): Promise<void> {
  const base =
    process.env.URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://reelhome.ai'
  const secret = process.env.CRON_SECRET

  try {
    const res = await fetch(`${base}/.netlify/functions/publish-worker-background`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-worker-secret': secret } : {}),
      },
      body: JSON.stringify({ jobs }),
    })
    // Background functions svarer 202 Accepted. Alt annet = dispatch feilet.
    if (res.status !== 202 && !res.ok) {
      throw new Error(`Background dispatch HTTP ${res.status}`)
    }
  } catch (err) {
    console.error('[publish/instagram] Bakgrunns-dispatch feilet:', err)
    // Markér radene failed så de ikke henger i 'processing'.
    await supabase
      .from('reelhome_publications')
      .update({ status: 'failed', error: 'Kunne ikke starte bakgrunnsjobb for publisering' })
      .in('id', jobs.map(j => j.rowId))
  }
}

/**
 * Instagram steg 1: opprett Reels-media-container (ett raskt kall).
 */
export async function createInstagramContainer(
  igUserId: string,
  accessToken: string,
  videoUrl: string,
  caption: string
): Promise<{ success: boolean; containerId?: string; error?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type:   'REELS',
        video_url:    videoUrl,
        caption,
        access_token: accessToken,
      }),
    })
    const data = await res.json()
    if (data.error || !data.id) {
      console.error('[publish/instagram] Container error:', data.error)
      return { success: false, error: data.error?.message ?? 'Kunne ikke opprette container' }
    }
    return { success: true, containerId: data.id }
  } catch (err) {
    console.error('[publish/instagram] Container exception:', err)
    return { success: false, error: String(err) }
  }
}

/**
 * Instagram steg 2+3 (kjøres i bakgrunnsfunksjonen): poll til containeren er
 * FINISHED (opptil ~10 min), publiser, og OPPDATER den forhåndsopprettede
 * `reelhome_publications`-raden til published/failed.
 */
export async function runInstagramJob(job: InstagramJob): Promise<void> {
  const supabase = getServiceClient()
  const { rowId, igUserId, accessToken, containerId } = job

  const finish = async (
    status: 'published' | 'failed',
    fields: { post_id?: string | null; error?: string | null }
  ) => {
    const { error } = await supabase
      .from('reelhome_publications')
      .update({ status, post_id: fields.post_id ?? null, error: fields.error ?? null })
      .eq('id', rowId)
    if (error) console.error(`[worker] kunne ikke oppdatere rad ${rowId}:`, error.message)
  }

  try {
    // Poll til status er FINISHED (opptil ~10 min — godt innenfor 15-min-taket).
    const deadline = Date.now() + 10 * 60_000
    let status = ''
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5000))
      const statusRes = await fetch(
        `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`
      )
      const statusData = await statusRes.json()
      status = statusData.status_code ?? ''
      if (status === 'FINISHED') break
      if (status === 'ERROR' || status === 'EXPIRED') {
        await finish('failed', { error: `Video-prosessering feilet: ${status}` })
        return
      }
    }
    if (status !== 'FINISHED') {
      await finish('failed', { error: 'Timeout: video-prosessering tok for lang tid' })
      return
    }

    // Publiser containeren.
    const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
    })
    const publishData = await publishRes.json()
    if (publishData.error) {
      console.error('[worker/instagram] Publish error:', publishData.error)
      await finish('failed', { error: publishData.error.message ?? 'Publisering feilet' })
      return
    }
    await finish('published', { post_id: publishData.id })
  } catch (err) {
    console.error('[worker/instagram] Exception:', err)
    await finish('failed', { error: String(err) })
  }
}

export async function publishToFacebook(
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

export async function publishToLinkedIn(
  pageId: string,
  accessToken: string,
  videoUrl: string,
  caption: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // Company pages: urn:li:organization:{id} (rent numerisk id fra organizationAcls).
    // Personal profiles: urn:li:person:{sub} (LinkedIn openid sub, ikke rent numerisk).
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
