import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'

// DELETE { connectionId }
export async function DELETE(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { connectionId } = await request.json()
  if (!connectionId) return NextResponse.json({ error: 'Mangler connectionId' }, { status: 400 })

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('social_connections')
    .delete()
    .eq('id', connectionId)
    .eq('user_id', user.id)   // safety: can only delete own connections

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
