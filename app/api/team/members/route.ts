import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

export const runtime = 'nodejs'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── GET — list org members ────────────────────────────────────────────────────
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = sb()

  // Get caller's org + role
  const { data: profile } = await client
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'Ikke tilknyttet en organisasjon' }, { status: 404 })
  }
  if (profile.role !== 'admin') {
    return NextResponse.json({ error: 'Kun admin kan se dette' }, { status: 403 })
  }

  const orgId = profile.organization_id

  // All members in org
  const { data: members, error } = await client
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Video counts per member
  const memberIds = (members ?? []).map(m => m.id)
  const { data: videos } = memberIds.length
    ? await client.from('property_videos').select('user_id').in('user_id', memberIds)
    : { data: [] }

  const videoCountMap: Record<string, number> = {}
  for (const v of videos ?? []) {
    videoCountMap[v.user_id] = (videoCountMap[v.user_id] ?? 0) + 1
  }

  // Get emails from auth.users via admin API
  const { data: authData } = await client.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const u of authData?.users ?? []) {
    if (u.email) emailMap[u.id] = u.email
  }

  // Credits this month per member
  const { data: credits } = memberIds.length
    ? await client.from('video_credits').select('user_id, used_this_month, included_per_month, extra_credits').in('user_id', memberIds)
    : { data: [] }

  const creditMap: Record<string, { used: number; total: number }> = {}
  for (const c of credits ?? []) {
    creditMap[c.user_id] = { used: c.used_this_month ?? 0, total: (c.included_per_month ?? 0) + (c.extra_credits ?? 0) }
  }

  // Total org credits this month
  const totalUsed  = Object.values(creditMap).reduce((s, c) => s + c.used, 0)
  const totalTotal = Object.values(creditMap).reduce((s, c) => s + c.total, 0)

  const enriched = (members ?? []).map(m => ({
    id:          m.id,
    full_name:   m.full_name ?? '(Ikke satt opp)',
    email:       emailMap[m.id] ?? '—',
    role:        m.role,
    video_count: videoCountMap[m.id] ?? 0,
    credits:     creditMap[m.id] ?? { used: 0, total: 0 },
  }))

  return NextResponse.json({
    members: enriched,
    org_credits: { used: totalUsed, total: totalTotal },
  })
}

// ── DELETE — remove member from org ──────────────────────────────────────────
export async function DELETE(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { memberId } = await request.json()
  if (!memberId) return NextResponse.json({ error: 'Mangler memberId' }, { status: 400 })

  const client = sb()

  // Caller must be admin
  const { data: profile } = await client
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.organization_id || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Kun admin kan fjerne meglere' }, { status: 403 })
  }

  // Can't remove yourself
  if (memberId === user.id) {
    return NextResponse.json({ error: 'Du kan ikke fjerne deg selv' }, { status: 400 })
  }

  // Verify target belongs to same org
  const { data: target } = await client
    .from('profiles')
    .select('organization_id')
    .eq('id', memberId)
    .maybeSingle()

  if (target?.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: 'Megleren tilhører ikke din organisasjon' }, { status: 403 })
  }

  // Set organization_id to null (remove from org without deleting profile)
  const { error } = await client
    .from('profiles')
    .update({ organization_id: null, role: null })
    .eq('id', memberId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
