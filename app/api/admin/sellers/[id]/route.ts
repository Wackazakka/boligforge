import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://reelhome.ai'
const SUPERADMIN_EMAIL = process.env.LARS_EMAIL ?? ''

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
async function requireAdmin(): Promise<boolean> {
  const user = await getUser()
  return !!user && !!SUPERADMIN_EMAIL && user.email === SUPERADMIN_EMAIL
}

// GET /api/admin/sellers/[id] — detail: attributed orgs (customers), commissions, links.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const admin = sb()

  const { data: seller, error } = await admin.from('reelhome_sellers').select('*').eq('id', id).single()
  if (error || !seller) return NextResponse.json({ error: 'Selger ikke funnet' }, { status: 404 })

  let parent_name: string | null = null
  if (seller.parent_id) {
    const { data: par } = await admin.from('reelhome_sellers').select('name').eq('id', seller.parent_id).maybeSingle()
    parent_name = (par?.name as string) ?? null
  }

  // Attributed orgs (customers).
  const { data: refs } = await admin.from('reelhome_org_referrals').select('org_id').eq('seller_ref', seller.ref_code)
  const orgIds = (refs ?? []).map(r => r.org_id as string)

  const orgInfo = new Map<string, { name: string; created_at: string }>()
  if (orgIds.length) {
    const { data: orgs } = await admin.from('organizations').select('id, name, created_at').in('id', orgIds)
    for (const o of orgs ?? []) orgInfo.set(o.id as string, { name: (o.name as string) ?? '(uten navn)', created_at: o.created_at as string })
  }

  const payMap = new Map<string, { last: string; total: number }>()
  if (orgIds.length) {
    const { data: pays } = await admin.from('reelhome_payments').select('org_id, amount, created_at').in('org_id', orgIds)
    for (const p of pays ?? []) {
      const oid = p.org_id as string
      const cur = payMap.get(oid) ?? { last: '', total: 0 }
      cur.total += Number(p.amount)
      if (!cur.last || (p.created_at as string) > cur.last) cur.last = p.created_at as string
      payMap.set(oid, cur)
    }
  }

  const customers = orgIds
    .map(oid => ({
      org_id: oid,
      name: orgInfo.get(oid)?.name ?? '(ukjent)',
      created_at: orgInfo.get(oid)?.created_at ?? null,
      last_payment_at: payMap.get(oid)?.last || null,
      total_paid: payMap.get(oid)?.total ?? 0,
    }))
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))

  const { data: commissions } = await admin
    .from('reelhome_seller_commissions')
    .select('*')
    .eq('seller_id', id)
    .order('period', { ascending: false })
  const total_commission = (commissions ?? []).reduce((s, c) => s + Number(c.commission_amount), 0)

  return NextResponse.json({
    seller,
    customers,
    commissions: commissions ?? [],
    total_commission,
    parent_name,
    ref_url: `${BASE_URL}/?ref=${seller.ref_code}`,
    discount_url: `${BASE_URL}/?ref=${seller.ref_code}&rabatt=1`,
    portal_url: `${BASE_URL}/agent/${seller.ref_code}?token=${seller.portal_token}`,
    recruit_url: seller.recruit_token ? `${BASE_URL}/bli-selger?t=${seller.recruit_token}` : null,
    is_manager: seller.manager_rate != null,
  })
}

// PATCH /api/admin/sellers/[id] — active / rates / discount / manager_rate / parent_id.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const admin = sb()
  const body = await req.json().catch(() => ({}))

  const update: Record<string, unknown> = {}
  if (typeof body.active === 'boolean') update.active = body.active

  const parseRate = (v: unknown): number | null => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null
  }
  for (const k of ['rate_y1', 'rate_y2', 'rate_y3', 'rate_y4', 'discount_rate'] as const) {
    if (body[k] !== undefined) {
      const r = parseRate(body[k])
      if (r === null) return NextResponse.json({ error: `Ugyldig sats for ${k} (0–1)` }, { status: 400 })
      update[k] = r
    }
  }
  if (update.rate_y1 !== undefined) update.commission_rate = update.rate_y1

  if (body.manager_rate !== undefined) {
    if (body.manager_rate === null || body.manager_rate === '') update.manager_rate = null
    else {
      const r = parseRate(body.manager_rate)
      if (r === null) return NextResponse.json({ error: 'Ugyldig sjef-sats (0–1)' }, { status: 400 })
      update.manager_rate = r
    }
  }

  if (body.parent_id !== undefined) {
    const newParent = typeof body.parent_id === 'string' && body.parent_id ? body.parent_id : null
    if (newParent) {
      if (newParent === id) return NextResponse.json({ error: 'En selger kan ikke være sin egen sjef' }, { status: 400 })
      const { data: all } = await admin.from('reelhome_sellers').select('id, parent_id')
      const parentOf = new Map((all ?? []).map(s => [s.id as string, s.parent_id as string | null]))
      let cur: string | null = newParent
      let depth = 0
      while (cur && depth < 50) {
        if (cur === id) return NextResponse.json({ error: 'Ugyldig: dette ville laget en sirkel i hierarkiet' }, { status: 400 })
        cur = parentOf.get(cur) ?? null
        depth++
      }
    }
    update.parent_id = newParent
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Ingenting å oppdatere' }, { status: 400 })

  const { error } = await admin.from('reelhome_sellers').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, ...update })
}

// DELETE /api/admin/sellers/[id] — hard-delete.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const { error } = await sb().from('reelhome_sellers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
