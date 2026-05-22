import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({})
  const { default_voice_id, cloned_voice_id, ...rest } = data
  return NextResponse.json({ ...rest, voice_id: default_voice_id, cloned_voice_id })
}
