import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { setting, url } = await request.json()
    if (!setting || !url) {
      return NextResponse.json({ error: 'Missing setting or url' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.from('agent_settings_images').insert({
      setting_type: setting,
      image_url: url,
      user_id: user.id,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
