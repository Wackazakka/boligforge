import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, title, phone, email, website, voice_id, cloned_voice_id, tone_of_voice, hashtags, portrait_url } = body

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.from('agent_profiles').upsert(
      {
        user_id: user.id,
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
