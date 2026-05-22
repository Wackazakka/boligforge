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

  const { data, error } = await getServiceClient()
    .from('music_files')
    .select('id, name, url, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return Response.json({ files: [] })
  return Response.json({ files: data || [] })
}

export async function DELETE(request: Request) {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return Response.json({ error: 'Mangler id' }, { status: 400 })

  await getServiceClient().from('music_files').delete().eq('id', id)
  return Response.json({ ok: true })
}
