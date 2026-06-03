import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

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
}

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

  const results: PublishResult[] = await Promise.all(
    connections.map(async conn => {
      let result: { success: boolean; postId?: string; error?: string }

      if (conn.platform === 'facebook') {
        result = await publishToFacebook(conn.page_id, conn.access_token, videoUrl, caption)
      } else if (conn.platform === 'linkedin') {
        result = await publishToLinkedIn(conn.page_id, conn.access_token, videoUrl, caption)
      } else {
        result = { success: false, error: `Ukjent plattform: ${conn.platform}` }
      }

      // Log the outcome so it shows up in the calendar / history
      await supabase.from('publications').insert({
        user_id:       userId,
        property_id:   propertyId,
        connection_id: conn.id,
        platform:      conn.platform,
        page_name:     conn.page_name,
        caption,
        video_url:     videoUrl,
        post_id:       result.postId ?? null,
        status:        result.success ? 'published' : 'failed',
        error:         result.error ?? null,
      })

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

  // Log each publish to calendar (one row per connection)
  for (const conn of connections) {
    const result = results.find(r => r.platform === conn.platform)
    await supabase.from('scheduled_publications').insert({
      user_id:        user.id,
      property_id,
      video_url,
      caption,
      connection_ids: [conn.id],
      scheduled_at:   new Date().toISOString(),
      platform:       'video',
      status:         result?.success ? 'published' : 'failed',
    }).then(({ error }) => { if (error) console.warn('[publish] log error:', error.message) })
  }

  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 })
}
