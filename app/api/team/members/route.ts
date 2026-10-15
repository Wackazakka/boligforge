import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'
import { kontorOversikt, maanedStart } from '../../../../lib/boliger'

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

  // Boliger låst opp per megler denne måneden + kontorets saldo (16/10 —
  // erstatter kredittene).
  const oversikt = await kontorOversikt(client, orgId, memberIds)

  // Bestillinger per megler denne måneden (ordrekøen), til oversikten.
  const { data: ordrer } = memberIds.length
    ? await client.from('produksjonsordrer').select('user_id, status, nivaa, created_at').in('user_id', memberIds).neq('status', 'avbrutt').gte('created_at', maanedStart())
    : { data: [] }
  const ordreMap: Record<string, { antall: number; aapne: number }> = {}
  for (const o of ordrer ?? []) {
    const r = ordreMap[o.user_id] ?? (ordreMap[o.user_id] = { antall: 0, aapne: 0 })
    r.antall += 1
    if (o.status !== 'publisert') r.aapne += 1
  }

  const { data: orgRow } = await client.from('organizations').select('faktura_samlet').eq('id', orgId).maybeSingle()

  const enriched = (members ?? []).map(m => ({
    id:          m.user_id,
    full_name:   nameMap[m.user_id] ?? '(Ikke satt opp)',
    email:       emailMap[m.user_id] ?? '—',
    role:        m.role,
    video_count: videoCountMap[m.user_id] ?? 0,
    boliger:     oversikt.perMegler[m.user_id] ?? { boliger: 0, produksjoner: 0, kostnad: 0 },
    bestillinger: ordreMap[m.user_id] ?? { antall: 0, aapne: 0 },
    boliger_liste: oversikt.boligerPerMegler[m.user_id] ?? [],
  }))

  const boligerDenneMaaneden = enriched.reduce((s, m) => s + m.boliger.boliger, 0)
  const produksjonerDenneMaaneden = enriched.reduce((s, m) => s + m.boliger.produksjoner, 0)
  const kostnadDenneMaaneden = enriched.reduce((s, m) => s + m.boliger.kostnad, 0)

  return NextResponse.json({
    members: enriched,
    meg: user.id,
    org: {
      boliger_denne_maaneden: boligerDenneMaaneden,
      produksjoner_denne_maaneden: produksjonerDenneMaaneden,
      kostnad_denne_maaneden: kostnadDenneMaaneden,
      saldo_lag_selv: oversikt.saldo.lagSelv,
      saldo_vi_produserer: oversikt.saldo.viProduserer,
      faktura_samlet: !!orgRow?.faktura_samlet,
    },
  })
}

// ── PATCH — rolle (gi/ta admin) eller fakturavalg ────────────────────────────
/** Body: { memberId, role: 'admin' | 'member' } eller { faktura_samlet: boolean } */
export async function PATCH(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { memberId?: string; role?: string; faktura_samlet?: unknown }
  const client = sb()
  const membership = await getMembership(client, user.id)
  if (!membership?.organization_id || membership.role !== 'admin') {
    return NextResponse.json({ error: 'Kun admin kan endre dette' }, { status: 403 })
  }
  const orgId = membership.organization_id

  if (typeof body.faktura_samlet === 'boolean') {
    const { error } = await client.from('organizations').update({ faktura_samlet: body.faktura_samlet }).eq('id', orgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, faktura_samlet: body.faktura_samlet })
  }

  if (body.memberId && (body.role === 'admin' || body.role === 'member')) {
    const target = await getMembership(client, body.memberId)
    if (target?.organization_id !== orgId) return NextResponse.json({ error: 'Megleren tilhører ikke din organisasjon' }, { status: 403 })
    if (body.role === 'member') {
      // Kontoret må alltid ha minst én administrator (avtalen punkt 4).
      const { count } = await client.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('role', 'admin')
      if ((count ?? 0) <= 1 && target?.role === 'admin') {
        return NextResponse.json({ error: 'Kontoret må ha minst én administrator. Gi rollen til noen andre først.' }, { status: 400 })
      }
    }
    const { error } = await client.from('organization_members').update({ role: body.role }).eq('user_id', body.memberId).eq('organization_id', orgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await client.from('profiles').update({ role: body.role === 'admin' ? 'admin' : 'agent', account_type: body.role === 'admin' ? 'team_admin' : 'team_member' })
      .eq('id', body.memberId).eq('organization_id', orgId)
    return NextResponse.json({ ok: true, role: body.role })
  }

  return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 })
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

  // Ferdige videoer tilhører kontoret (avtalen punkt 11): boligene og videoene
  // til den som slutter blir igjen hos kontoret — de flyttes til administratoren
  // som fjernet henne, så de fortsatt er synlige og kan redigeres.
  const { data: flyttet } = await client
    .from('properties')
    .update({ user_id: user.id, organization_id: membership.organization_id })
    .eq('user_id', memberId)
    .select('id')
  await client.from('property_videos').update({ user_id: user.id }).eq('user_id', memberId)
  await client.from('property_unlocks').update({ user_id: user.id }).eq('user_id', memberId)

  return NextResponse.json({ success: true, boliger_flyttet: (flyttet ?? []).length })
}
