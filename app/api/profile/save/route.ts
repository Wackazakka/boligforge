import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, title, phone, email, website, voice_id, cloned_voice_id, tone_of_voice, hashtags, portrait_url } = body

    const supabase = getSupabase()
    const { error } = await supabase.from('agent_profiles').upsert(
      {
        user_id: '00000000-0000-0000-0000-000000000001',
        name,
        title,
        phone,
        email,
        website,
        default_voice_id: voice_id,
        ...(cloned_voice_id !== undefined ? { cloned_voice_id } : {}),
        tone_of_voice,
        hashtags,
        ...(portrait_url !== undefined ? { portrait_url } : {}),
      },
      { onConflict: 'user_id' }
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
