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
    const { setting, url } = await request.json()
    if (!setting || !url) {
      return NextResponse.json({ error: 'Missing setting or url' }, { status: 400 })
    }

    const { error } = await getSupabase().from('agent_settings_images').insert({
      setting_type: setting,
      image_url: url,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
