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

// History of published (and failed) posts — used by the calendar.
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getServiceClient()

  // Fetch from legacy publications table
  const { data: legacyData } = await supabase
    .from('publications')
    .select('id, property_id, platform, page_name, caption, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  // Also fetch published/failed from scheduled_publications (with connection info)
  const { data: schedData } = await supabase
    .from('scheduled_publications')
    .select('id, property_id, connection_ids, caption, status, scheduled_at, created_at')
    .eq('user_id', user.id)
    .in('status', ['published', 'failed'])
    .order('created_at', { ascending: false })
    .limit(200)

  // Fetch connections to resolve page names and platforms
  const allConnIds = (schedData ?? []).flatMap(r => r.connection_ids ?? [])
  const { data: conns } = allConnIds.length > 0
    ? await supabase.from('social_connections').select('id, platform, page_name').in('id', allConnIds)
    : { data: [] }
  const connMap = new Map((conns ?? []).map(c => [c.id, c]))

  const schedEntries = (schedData ?? []).flatMap(r =>
    (r.connection_ids ?? []).map((cid: string) => {
      const conn = connMap.get(cid)
      return {
        id:          `${r.id}:${cid}`,
        property_id: r.property_id,
        platform:    conn?.platform ?? 'unknown',
        page_name:   conn?.page_name ?? 'Ukjent',
        caption:     r.caption,
        status:      r.status,
        created_at:  r.created_at,
      }
    })
  )

  const all = [...(legacyData ?? []), ...schedEntries]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json(all)
}
