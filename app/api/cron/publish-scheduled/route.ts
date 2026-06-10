import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { publishVideoToConnections } from '../../social/publish/route'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

type ScheduledRow = {
  id: string
  user_id: string
  property_id: string | null
  video_url: string
  caption: string | null
  connection_ids: string[]
  scheduled_at: string
}

// En planlagt post skal ALDRI forsvinne sporløst. Hvis den ikke kan publiseres,
// logg en tydelig feilrad i reelhome_publications i tillegg til å markere
// scheduled_publications som 'failed'. Da har vi alltid et spor i historikken.
async function markFailed(
  supabase: ReturnType<typeof getServiceClient>,
  post: ScheduledRow,
  reason: string,
) {
  await supabase.from('reelhome_scheduled_publications')
    .update({ status: 'failed', error_message: reason })
    .eq('id', post.id)

  const { error: logErr } = await supabase.from('reelhome_publications').insert({
    user_id:       post.user_id,
    property_id:   post.property_id,
    connection_id: post.connection_ids?.[0] ?? null,
    platform:      'scheduled',
    page_name:     null,
    caption:       post.caption ?? '',
    video_url:     post.video_url,
    post_id:       null,
    status:        'failed',
    error:         reason,
  })
  if (logErr) console.error(`[cron] Post ${post.id}: kunne ikke logge feilrad:`, logErr.message)
}

async function runCron(request: Request) {
  // Optional shared secret — accepts Netlify's internal scheduler (no header)
  // or any caller presenting the correct secret.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const provided =
      request.headers.get('x-cron-secret') ||
      new URL(request.url).searchParams.get('secret')
    if (provided && provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = getServiceClient()

  const { data: due, error } = await supabase
    .from('reelhome_scheduled_publications')
    .select('id, user_id, property_id, video_url, caption, connection_ids, scheduled_at')
    .lte('scheduled_at', new Date().toISOString())
    .eq('status', 'pending')

  if (error) {
    console.error('[cron] Failed to fetch scheduled publications:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ published: 0 })
  }

  console.log(`[cron] Found ${due.length} post(s) due for publishing`)

  const results: Array<{ id: string; success: boolean; error?: string }> = []

  for (const post of due as ScheduledRow[]) {
    try {
      if (!post.connection_ids || post.connection_ids.length === 0) {
        console.error(`[cron] Post ${post.id}: no connections, skipping`)
        // Marker som failed (ikke slett) så posten ikke forsvinner stille fra kalenderen.
        await markFailed(supabase, post, 'Ingen tilkoblinger valgt')
        results.push({ id: post.id, success: false, error: 'missing connections' })
        continue
      }

      // Look up the connections (must still belong to the scheduling user)
      const { data: connections } = await supabase
        .from('social_connections')
        .select('id, platform, page_id, page_name, access_token')
        .eq('user_id', post.user_id)
        .in('id', post.connection_ids)

      if (!connections || connections.length === 0) {
        console.error(`[cron] Post ${post.id}: connections no longer exist`)
        // Vanlig etter at megler kobler til sosiale medier på nytt (nye connection-id-er).
        // Marker failed med tydelig grunn i stedet for å slette posten.
        await markFailed(supabase, post, 'Tilkoblingen finnes ikke lenger (koblet til på nytt?)')
        results.push({ id: post.id, success: false, error: 'connections gone' })
        continue
      }

      const pubResults = await publishVideoToConnections({
        userId:     post.user_id,
        videoUrl:   post.video_url,
        caption:    post.caption ?? '',
        connections,
        propertyId: post.property_id,
      })

      const success = pubResults.every(r => r.success)
      if (!success) {
        console.error(`[cron] Post ${post.id} had failures:`, JSON.stringify(pubResults))
      }

      await supabase.from('reelhome_scheduled_publications').update({
        status: success ? 'published' : 'failed',
      }).eq('id', post.id)
      results.push({ id: post.id, success })
    } catch (err) {
      console.error(`[cron] Error publishing post ${post.id}:`, err)
      await markFailed(supabase, post, String(err))
      results.push({ id: post.id, success: false, error: String(err) })
    }
  }

  const publishedCount = results.filter(r => r.success).length
  console.log(`[cron] Done: ${publishedCount}/${results.length} published`)
  return NextResponse.json({ published: publishedCount, results })
}

export async function POST(request: Request) { return runCron(request) }
export async function GET(request: Request) { return runCron(request) }
