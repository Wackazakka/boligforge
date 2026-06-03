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

// List the user's queued (not-yet-published) scheduled posts.
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('scheduled_publications')
    .select('id, property_id, video_url, caption, connection_ids, scheduled_at, created_at')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Queue a video to be published at a future time.
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { video_url, caption = '', connection_ids, scheduled_at, property_id = null } =
    await request.json()

  if (!video_url) return NextResponse.json({ error: 'Mangler video_url' }, { status: 400 })
  if (!Array.isArray(connection_ids) || connection_ids.length === 0) {
    return NextResponse.json({ error: 'Mangler connection_ids' }, { status: 400 })
  }
  if (!scheduled_at) return NextResponse.json({ error: 'Mangler scheduled_at' }, { status: 400 })

  const when = new Date(scheduled_at)
  if (isNaN(when.getTime())) {
    return NextResponse.json({ error: 'Ugyldig tidspunkt' }, { status: 400 })
  }
  if (when.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Tidspunktet må være i framtiden' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // Verify the connections belong to this user
  const { data: connections, error: connErr } = await supabase
    .from('social_connections')
    .select('id')
    .eq('user_id', user.id)
    .in('id', connection_ids)

  if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 })
  const validIds = (connections ?? []).map(c => c.id)
  if (validIds.length === 0) {
    return NextResponse.json({ error: 'Ingen gyldige tilkoblinger funnet' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('scheduled_publications')
    .insert({
      user_id:        user.id,
      property_id,
      video_url,
      caption,
      connection_ids: validIds,
      scheduled_at:   when.toISOString(),
      platform:       'video',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, scheduled: data })
}

// Cancel a queued scheduled post.
export async function DELETE(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Mangler id' }, { status: 400 })

  const supabase = getServiceClient()
  const { error } = await supabase
    .from('scheduled_publications')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
