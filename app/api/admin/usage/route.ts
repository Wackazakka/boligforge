// Superadmin: aggregert avatar-bruk per megler for en måned (fakturerings-grunnlag).
// Aggregerer i JS (lavt volum) — summerer minutter per megler + per leverandør.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

const SUPERADMIN_EMAIL = process.env.LARS_EMAIL ?? ''

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(request: Request) {
  const user = await getUser()
  if (!user || user.email !== SUPERADMIN_EMAIL) return NextResponse.json({ error: 'Ikke tilgang' }, { status: 403 })

  // month=YYYY-MM (default inneværende)
  const monthParam = new URL(request.url).searchParams.get('month')
  const now = new Date()
  const [y, m] = monthParam ? monthParam.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1]
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString()
  const end = new Date(Date.UTC(y, m, 1)).toISOString()

  const supabase = svc()
  const { data: rows, error } = await supabase
    .from('reelhome_avatar_usage')
    .select('user_id, provider, duration_seconds, started_at')
    .gte('started_at', start).lt('started_at', end)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byUser = new Map<string, { user_id: string; seconds: number; liveavatar: number; did: number; sessions: number }>()
  for (const r of rows || []) {
    const uid = r.user_id || 'ukjent'
    const e = byUser.get(uid) || { user_id: uid, seconds: 0, liveavatar: 0, did: 0, sessions: 0 }
    e.seconds += r.duration_seconds || 0
    if (r.provider === 'liveavatar') e.liveavatar += r.duration_seconds || 0
    if (r.provider === 'did') e.did += r.duration_seconds || 0
    e.sessions += 1
    byUser.set(uid, e)
  }

  const ids = [...byUser.keys()].filter(k => k !== 'ukjent')
  const names = new Map<string, { name: string; email: string }>()
  if (ids.length) {
    const { data: profiles } = await supabase.from('agent_profiles').select('user_id, name, email').in('user_id', ids)
    for (const p of profiles || []) names.set(p.user_id, { name: p.name, email: p.email })
  }

  const meglere = [...byUser.values()].map(e => ({
    ...e,
    minutes: Math.round(e.seconds / 60),
    liveavatar_min: Math.round(e.liveavatar / 60),
    did_min: Math.round(e.did / 60),
    name: names.get(e.user_id)?.name || null,
    email: names.get(e.user_id)?.email || null,
  })).sort((a, b) => b.seconds - a.seconds)

  const totalMin = Math.round((rows || []).reduce((s, r) => s + (r.duration_seconds || 0), 0) / 60)
  return NextResponse.json({ month: `${y}-${String(m).padStart(2, '0')}`, totalMinutes: totalMin, meglere })
}
