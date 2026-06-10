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

// Org-medlemskap leses fra organization_members — samme kilde som /api/org/* —
// slik at Team- og Admin-sidene aldri spriker. profiles brukes kun til navn.
async function getMembership(client: ReturnType<typeof sb>, userId: string) {
  const { data } = await client
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

// ── GET — list org members ────────────────────────────────────────────────────
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = sb()

  const membership = await getMembership(client, user.id)
  if (!membership?.organization_id) {
    return NextResponse.json({ error: 'Ikke tilknyttet en organisasjon' }, { status: 404 })
  }
  if (membership.role !== 'admin') {
    return NextResponse.json({ error: 'Kun admin kan se dette' }, { status: 403 })
  }

  const orgId = membership.organization_id

  // All members in org
  const { data: members, error } = await client
    .from('organization_members')
    .select('user_id, role, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const memberIds = (members ?? []).map(m => m.user_id)

  // Names from profiles
  const { data: profiles } = memberIds.length
    ? await client.from('profiles').select('id, full_name').in('id', memberIds)
    : { data: [] }
  const nameMap: Record<string, string> = {}
  for (const p of profiles ?? []) {
    if (p.full_name) nameMap[p.id] = p.full_name
  }

  // Video counts per member
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
    id:          m.user_id,
    full_name:   nameMap[m.user_id] ?? '(Ikke satt opp)',
    email:       emailMap[m.user_id] ?? '—',
    role:        m.role,
    video_count: videoCountMap[m.user_id] ?? 0,
    credits:     creditMap[m.user_id] ?? { used: 0, total: 0 },
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

  const membership = await getMembership(client, user.id)
  if (!membership?.organization_id || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Kun admin kan fjerne meglere' }, { status: 403 })
  }

  // Can't remove yourself
  if (memberId === user.id) {
    return NextResponse.json({ error: 'Du kan ikke fjerne deg selv' }, { status: 400 })
  }

  // Verify target belongs to same org
  const target = await getMembership(client, memberId)
  if (target?.organization_id !== membership.organization_id) {
    return NextResponse.json({ error: 'Megleren tilhører ikke din organisasjon' }, { status: 403 })
  }

  const { error } = await client
    .from('organization_members')
    .delete()
    .eq('user_id', memberId)
    .eq('organization_id', membership.organization_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hold profiles i sync (kun hvis profilen peker på denne org-en)
  await client
    .from('profiles')
    .update({ organization_id: null, role: null })
    .eq('id', memberId)
    .eq('organization_id', membership.organization_id)

  return NextResponse.json({ success: true })
}
