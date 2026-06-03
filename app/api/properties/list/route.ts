import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('properties')
    .select('id, finn_id, address, price, size_bra, rooms, images, finn_url, hjem_url, status, sold_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
