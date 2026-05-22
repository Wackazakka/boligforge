import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('user_id', '00000000-0000-0000-0000-000000000001')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({})
  const { default_voice_id, cloned_voice_id, ...rest } = data
  return NextResponse.json({ ...rest, voice_id: default_voice_id, cloned_voice_id })
}
