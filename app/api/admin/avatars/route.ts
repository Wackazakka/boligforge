// Superadmin: bla i LiveAvatars offentlige avatarer (med forhåndsvisningsbilde) og
// sett én som demo-avatar med ett klikk. Demoen kjører på test-megleren.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

export const runtime = 'nodejs'
const SUPERADMIN_EMAIL = process.env.LARS_EMAIL ?? ''
const DEMO_MEGLER = 'e5829322-8f3a-43c6-b441-3e88863f0ea7' // test-megler for digital-visning-demoen

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
async function requireAdmin() {
  const user = await getUser()
  return !!user && user.email === SUPERADMIN_EMAIL
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Ikke tilgang' }, { status: 403 })

  const res = await fetch('https://api.liveavatar.com/v1/avatars/public?page_size=100', {
    headers: { 'X-API-KEY': process.env.LIVEAVATAR_API_KEY! },
  })
  const d = await res.json().catch(() => ({}))
  const avatars = (d?.data?.results || []).map((a: Record<string, unknown>) => ({
    id: a.id, name: a.name, preview_url: a.preview_url,
  }))

  const { data: prof } = await svc()
    .from('agent_profiles').select('liveavatar_avatar_id').eq('user_id', DEMO_MEGLER).maybeSingle()

  return NextResponse.json({ avatars, current: prof?.liveavatar_avatar_id || null })
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Ikke tilgang' }, { status: 403 })

  const { avatar_id } = await request.json().catch(() => ({}))
  if (!avatar_id) return NextResponse.json({ error: 'Mangler avatar_id' }, { status: 400 })

  const { error } = await svc()
    .from('agent_profiles').update({ liveavatar_avatar_id: String(avatar_id) }).eq('user_id', DEMO_MEGLER)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, current: avatar_id })
}
