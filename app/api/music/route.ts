import { createSupabaseServerClient, getUser } from '../../../lib/supabase/server'

export async function GET() {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
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

  const supabase = await createSupabaseServerClient()
  await supabase.from('music_files').delete().eq('id', id)
  return Response.json({ ok: true })
}
