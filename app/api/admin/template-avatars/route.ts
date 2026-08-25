import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

const SUPERADMIN_EMAIL = process.env.LARS_EMAIL ?? ''
// Fallback hvis ikke i DB — UTLEDET fra katalogen, aldri en egen kopi.
// En haandkopiert liste her hang igjen med Hannas gamle stemme da katalogen
// ble byttet til bergensk (25/8) — duplikatet er naa fjernet for godt.
import { TEMPLATE_AVATARS } from '../../../../lib/template-avatars'
const DEFAULTS = TEMPLATE_AVATARS.map(({ id, name, desc, voiceId, portraitUrl }) => ({ id, name, desc, voiceId, portraitUrl }))

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY mangler')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// GET — return current template avatar config
export async function GET() {
  try {
    const supabase = getServiceClient()
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'template_avatars')
      .maybeSingle()

    const avatars = data?.value ?? DEFAULTS
    return NextResponse.json({ avatars })
  } catch {
    return NextResponse.json({ avatars: DEFAULTS })
  }
}

// PATCH — update a single avatar's voiceId (superadmin only)
export async function PATCH(request: Request) {
  const user = await getUser()
  if (!user || user.email !== SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Ikke tilgang' }, { status: 403 })
  }

  const { id, voiceId } = await request.json()
  if (!id || !voiceId) {
    return NextResponse.json({ error: 'Mangler id eller voiceId' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // Load current config (from DB or defaults)
  const { data: existing } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'template_avatars')
    .maybeSingle()

  const avatars = (existing?.value ?? DEFAULTS).map((a: typeof DEFAULTS[0]) =>
    a.id === id ? { ...a, voiceId } : a
  )

  await supabase
    .from('app_config')
    .upsert({ key: 'template_avatars', value: avatars }, { onConflict: 'key' })

  return NextResponse.json({ ok: true, avatars })
}
