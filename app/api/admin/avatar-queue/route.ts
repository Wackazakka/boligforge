// Superadmin: kø for video-avatar-onboarding. Lister meglere som har lastet opp
// opptak (i bucketen) men ikke fått liveavatar_avatar_id ennå, med nedlastings-
// lenke + samtykke. POST setter avatar_id (etter manuell opprettelse i LiveAvatar).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

const SUPERADMIN_EMAIL = process.env.LARS_EMAIL ?? ''
const BUCKET = 'liveavatar-onboarding'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function requireAdmin() {
  const user = await getUser()
  return !!user && user.email === SUPERADMIN_EMAIL
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Ikke tilgang' }, { status: 403 })
  const supabase = svc()

  // ?avatars=1 → LiveAvatar-avatarer (for å velge avatar_id)
  if (new URL(request.url).searchParams.get('avatars') === '1') {
    try {
      const res = await fetch('https://api.liveavatar.com/v1/avatars', {
        headers: { 'X-API-KEY': process.env.LIVEAVATAR_API_KEY! },
      })
      const d = await res.json()
      const results = (d?.data?.results || []).map((a: Record<string, unknown>) => ({
        id: a.avatar_id || a.id, name: a.name || a.avatar_name || a.id,
      }))
      return NextResponse.json({ avatars: results })
    } catch {
      return NextResponse.json({ avatars: [] })
    }
  }

  const { data: roots } = await supabase.storage.from(BUCKET).list('', { limit: 1000 })
  const pending: unknown[] = []
  const done: unknown[] = []

  for (const r of roots || []) {
    const uid = r.name
    const { data: files } = await supabase.storage.from(BUCKET).list(uid)
    const video = files?.find(f => f.name.startsWith('avatar-video'))
    if (!video) continue

    const { data: profile } = await supabase
      .from('agent_profiles').select('name, email, liveavatar_avatar_id, liveavatar_voice_id').eq('user_id', uid).maybeSingle()

    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(`${uid}/${video.name}`, 3600)

    let consent: unknown = null
    if (files?.some(f => f.name === 'consent.json')) {
      const { data: blob } = await supabase.storage.from(BUCKET).download(`${uid}/consent.json`)
      if (blob) consent = JSON.parse(await blob.text())
    }

    const entry = {
      user_id: uid,
      name: profile?.name || null,
      email: profile?.email || null,
      videoUrl: signed?.signedUrl || null,
      hasVoice: !!profile?.liveavatar_voice_id,
      avatar_id: profile?.liveavatar_avatar_id || null,
      uploaded_at: video.created_at || null,
      consent,
    }
    if (profile?.liveavatar_avatar_id) done.push(entry); else pending.push(entry)
  }

  return NextResponse.json({ pending, done })
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Ikke tilgang' }, { status: 403 })

  const { user_id, avatar_id } = await request.json().catch(() => ({}))
  if (!user_id || !avatar_id) return NextResponse.json({ error: 'Mangler user_id eller avatar_id' }, { status: 400 })

  const supabase = svc()
  const { error } = await supabase.from('agent_profiles').upsert(
    { user_id, liveavatar_avatar_id: String(avatar_id).trim() }, { onConflict: 'user_id' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
