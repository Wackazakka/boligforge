import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Vis felles system-spor (user_id = null) + brukerens egne opplastinger.
  const { data, error } = await getServiceClient()
    .from('music_files')
    .select('id, name, url, created_at, user_id')
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return Response.json({ files: [] })
  // `own` = brukerens eget spor (kan slettes). System-spor har own=false.
  const files = (data || []).map(({ user_id, ...f }) => ({ ...f, own: user_id === user.id }))
  return Response.json({ files })
}

export async function DELETE(request: Request) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return Response.json({ error: 'Mangler id' }, { status: 400 })

  // Kun brukerens egne opplastinger kan slettes. System-spor (user_id = null)
  // og andre brukeres spor røres ikke (eq user_id treffer dem ikke).
  const { data: deleted } = await getServiceClient()
    .from('music_files')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')

  if (!deleted || deleted.length === 0) {
    return Response.json({ error: 'Du kan bare slette dine egne opplastede spor.' }, { status: 403 })
  }
  return Response.json({ ok: true })
}
