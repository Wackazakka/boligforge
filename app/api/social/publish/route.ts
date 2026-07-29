import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { getServiceClient, publishVideoToConnections } from '@/lib/social/publish-core'

// Publiseringslogikken lever i lib/social/publish-core.ts (Next-fri) slik at den
// deles av dette endepunktet, cron-en og Netlify Background Function-en som
// fullfører Instagram-publisering asynkront.
export { publishVideoToConnections }

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

  // Instagram-oppføringer er `pending` (fullføres i bakgrunnen) — de teller ikke
  // som feil. Kun terminale FB/LinkedIn-feil senker samlestatusen.
  const allOk = results.every(r => r.success || r.pending)

  // Historikk logges i reelhome_publications inne i publishVideoToConnections
  // (FB/LinkedIn terminalt; Instagram som 'processing' → oppdateres av worker-en).

  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 })
}
