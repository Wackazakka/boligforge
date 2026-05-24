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

export async function DELETE(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { connectionId } = await request.json()
  if (!connectionId) return NextResponse.json({ error: 'Mangler connectionId' }, { status: 400 })

  const supabase = getServiceClient()
  const { error } = await supabase
    .from('social_connections')
    .delete()
    .eq('id', connectionId)
    .eq('user_id', user.id)   // safety: can only delete own connections

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
