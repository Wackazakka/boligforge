import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../lib/supabase/server'

// Kjedeoversikt: en kjede ER en organization; kontorer er orgs med
// parent_organization_id satt til kjedens id. Kjedeadmin = admin-medlem av
// forelder-orgen. Aggregerer i JS (lavt volum, samme mønster som backoffice).
// property_videos har ingen organization_id — videotall går via medlemmenes
// user_ids (profiles.organization_id-fan-out, som dashboardet).

export const runtime = 'nodejs'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = sb()

  const { data: membership } = await client
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  const isSuper = !!process.env.LARS_EMAIL && user.email === process.env.LARS_EMAIL
  if (!membership?.organization_id || (membership.role !== 'admin' && !isSuper)) {
    return NextResponse.json({ error: 'Kun kjedeadmin har tilgang' }, { status: 403 })
  }
  const chainId = membership.organization_id

  const { data: chainOrg } = await client
    .from('organizations')
    .select('id, name')
    .eq('id', chainId)
    .maybeSingle()

  // Kontorer under kjeden
  const { data: offices } = await client
    .from('organizations')
    .select('id, name, plan, created_at')
    .eq('parent_organization_id', chainId)
    .order('created_at')

  if (!offices || offices.length === 0) {
    return NextResponse.json({ chainName: chainOrg?.name ?? '', offices: [], totals: { offices: 0, members: 0, videos: 0, creditsUsed: 0, creditsTotal: 0 } })
  }

  const officeIds = offices.map(o => o.id)

  // Medlemmer per kontor (profiles.organization_id-fan-out)
  const { data: profiles } = await client
    .from('profiles')
    .select('id, organization_id')
    .in('organization_id', officeIds)

  const membersByOffice = new Map<string, string[]>()
  const userToOffice = new Map<string, string>()
  for (const p of profiles ?? []) {
    if (!p.organization_id) continue
    const list = membersByOffice.get(p.organization_id) ?? []
    list.push(p.id)
    membersByOffice.set(p.organization_id, list)
    userToOffice.set(p.id, p.organization_id)
  }
  const allMemberIds = Array.from(userToOffice.keys())

  // Videotall per kontor
  const videosByOffice = new Map<string, number>()
  if (allMemberIds.length > 0) {
    const { data: videos } = await client
      .from('property_videos')
      .select('id, user_id')
      .in('user_id', allMemberIds)
      .not('video_url', 'is', null)
      .neq('video_url', '')
    for (const v of videos ?? []) {
      const office = userToOffice.get(v.user_id)
      if (office) videosByOffice.set(office, (videosByOffice.get(office) ?? 0) + 1)
    }
  }

  // Kreditter per kontor (video_credits er per bruker — summer over medlemmene)
  const creditsByOffice = new Map<string, { used: number; total: number }>()
  if (allMemberIds.length > 0) {
    const { data: credits } = await client
      .from('video_credits')
      .select('user_id, used_this_month, included_per_month, extra_credits')
      .in('user_id', allMemberIds)
    for (const c of credits ?? []) {
      const office = userToOffice.get(c.user_id)
      if (!office) continue
      const agg = creditsByOffice.get(office) ?? { used: 0, total: 0 }
      agg.used  += c.used_this_month ?? 0
      agg.total += (c.included_per_month ?? 0) + (c.extra_credits ?? 0)
      creditsByOffice.set(office, agg)
    }
  }

  const rows = offices.map(o => ({
    id:           o.id,
    name:         o.name,
    plan:         o.plan,
    members:      (membersByOffice.get(o.id) ?? []).length,
    videos:       videosByOffice.get(o.id) ?? 0,
    creditsUsed:  creditsByOffice.get(o.id)?.used ?? 0,
    creditsTotal: creditsByOffice.get(o.id)?.total ?? 0,
  }))

  const totals = {
    offices:      rows.length,
    members:      rows.reduce((s, r) => s + r.members, 0),
    videos:       rows.reduce((s, r) => s + r.videos, 0),
    creditsUsed:  rows.reduce((s, r) => s + r.creditsUsed, 0),
    creditsTotal: rows.reduce((s, r) => s + r.creditsTotal, 0),
  }

  return NextResponse.json({ chainName: chainOrg?.name ?? '', offices: rows, totals })
}
