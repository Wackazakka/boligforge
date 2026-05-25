import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

export const runtime = 'nodejs'

const SUPERADMIN_EMAIL = process.env.LARS_EMAIL ?? ''

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function isSuperadmin(email: string | undefined) {
  return !!email && !!SUPERADMIN_EMAIL && email === SUPERADMIN_EMAIL
}

// ── GET /api/admin/backoffice ─────────────────────────────────────────────────
export async function GET() {
  const user = await getUser()
  if (!user || !isSuperadmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = sb()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  // Orgs
  const { data: orgs } = await client
    .from('organizations')
    .select('id, name, plan, trial_ends_at, created_at')
    .order('created_at', { ascending: false })

  // Profiles grouped by org (for member counts)
  const { data: profiles } = await client
    .from('profiles')
    .select('id, organization_id, full_name, role')

  // Property videos (for video counts per org)
  const { data: allVideos } = await client
    .from('property_videos')
    .select('id, user_id, created_at')

  // Build maps
  const membersByOrg: Record<string, number> = {}
  const userToOrg: Record<string, string> = {}
  for (const p of profiles ?? []) {
    if (!p.organization_id) continue
    membersByOrg[p.organization_id] = (membersByOrg[p.organization_id] ?? 0) + 1
    userToOrg[p.id] = p.organization_id
  }

  const videosByOrg: Record<string, number> = {}
  let videosLast30 = 0
  for (const v of allVideos ?? []) {
    const orgId = userToOrg[v.user_id]
    if (orgId) videosByOrg[orgId] = (videosByOrg[orgId] ?? 0) + 1
    if (v.created_at >= thirtyDaysAgo) videosLast30++
  }

  // Stats
  const totalOrgs    = orgs?.length ?? 0
  const activeTrials = orgs?.filter(o => o.trial_ends_at && o.trial_ends_at > now).length ?? 0
  const paying       = orgs?.filter(o => ['starter', 'pro', 'office'].includes(o.plan) && o.plan !== 'trial' && o.plan !== 'free').length ?? 0

  const enrichedOrgs = (orgs ?? []).map(o => ({
    ...o,
    member_count: membersByOrg[o.id] ?? 0,
    video_count:  videosByOrg[o.id]  ?? 0,
  }))

  return NextResponse.json({
    stats: { totalOrgs, activeTrials, paying, videosLast30 },
    orgs: enrichedOrgs,
  })
}

// ── PATCH /api/admin/backoffice — change plan ──────────────────────────────────
export async function PATCH(request: Request) {
  const user = await getUser()
  if (!user || !isSuperadmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { orgId, plan } = await request.json()
  if (!orgId || !plan) return NextResponse.json({ error: 'Mangler orgId eller plan' }, { status: 400 })

  const { error } = await sb()
    .from('organizations')
    .update({ plan })
    .eq('id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
