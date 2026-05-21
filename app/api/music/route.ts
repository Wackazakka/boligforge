import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET() {
  const { data, error } = await getSupabase()
    .from('music_files')
    .select('id, name, url, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return Response.json({ files: [] })
  return Response.json({ files: data || [] })
}

export async function DELETE(request: Request) {
  const { id } = await request.json()
  if (!id) return Response.json({ error: 'Mangler id' }, { status: 400 })
  await getSupabase().from('music_files').delete().eq('id', id)
  return Response.json({ ok: true })
}
