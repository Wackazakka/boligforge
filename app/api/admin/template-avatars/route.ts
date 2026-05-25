import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

const SUPERADMIN_EMAIL = process.env.LARS_EMAIL ?? ''
const R2 = 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/template-avatars'

// Default template avatar config (fallback if not in DB)
const DEFAULTS = [
  { id: 'sofia',  name: 'Sofia',  desc: 'Varm og profesjonell', voiceId: 'uNsWM1StCcpydKYOjKyu', portraitUrl: `${R2}/sofia.jpg`  },
  { id: 'marius', name: 'Marius', desc: 'Klar og selvsikker',   voiceId: 's2xtA7B2CTXPPlJzch1v', portraitUrl: `${R2}/marius.jpg` },
  { id: 'ingrid', name: 'Ingrid', desc: 'Nordisk og elegant',   voiceId: 'BGEU6wFi2uNm6Kje1Yhk', portraitUrl: `${R2}/ingrid.jpg` },
  { id: 'even',   name: 'Even',   desc: 'Rolig og trygg',       voiceId: 'vUmLiNBm6MDcy1NUHaVr', portraitUrl: `${R2}/even.jpg`   },
  { id: 'hanna',  name: 'Hanna',  desc: 'Engasjert og moderne', voiceId: 'jsCqWAovK2LkecY7zXl4', portraitUrl: `${R2}/hanna.jpg`  },
  { id: 'erik',   name: 'Erik',   desc: 'Erfaren og grundig',   voiceId: 'nhvaqgRyAq6BmFs3WcdX', portraitUrl: `${R2}/erik.jpg`   },
]

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
