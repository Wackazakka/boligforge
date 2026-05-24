import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('social_connections')
    .select('id, platform, page_id, page_name, token_expires_at, created_at')
    .eq('user_id', user.id)
    .order('platform')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
