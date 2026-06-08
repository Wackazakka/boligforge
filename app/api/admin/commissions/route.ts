import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '@/lib/supabase/server'
import { computeAllShares, type Partner, type PaymentRow } from '@/lib/commission'

export const runtime = 'nodejs'

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
function osloPeriod(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit' }).format(new Date())
}

// POST /api/admin/commissions { period? } — compute own + override per partner (per ORG), upsert.
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = sb()

  const body = await req.json().catch(() => ({}))
  const period: string = typeof body.period === 'string' && /^\d{4}-\d{2}$/.test(body.period) ? body.period : osloPeriod()

  const { data: partners } = await admin
    .from('reelhome_sellers')
    .select('id, ref_code, parent_id, manager_rate, rate_y1, rate_y2, rate_y3, rate_y4')

  // org_id -> seller_ref
  const { data: refs } = await admin.from('reelhome_org_referrals').select('org_id, seller_ref').not('seller_ref', 'is', null)
  const custToRef = new Map<string, string>((refs ?? []).map(r => [r.org_id as string, r.seller_ref as string]))

  // org_id -> org created_at (start of the org's 4-year clock)
  const orgIds = (refs ?? []).map(r => r.org_id as string)
  const signup = new Map<string, string>()
  if (orgIds.length) {
    const { data: orgs } = await admin.from('organizations').select('id, created_at').in('id', orgIds)
    for (const o of orgs ?? []) signup.set(o.id as string, o.created_at as string)
  }

  // payments in the period (org-level) -> PaymentRow keyed by org_id.
  const { data: pays } = await admin.from('reelhome_payments').select('org_id, amount, created_at').eq('period', period)
  const payments: PaymentRow[] = (pays ?? [])
    .filter(p => p.org_id)
    .map(p => ({ user_id: p.org_id as string, amount: Number(p.amount), created_at: p.created_at as string }))

  const shares = computeAllShares((partners ?? []) as Partner[], custToRef, signup, payments)

  const results = []
  for (const p of partners ?? []) {
    const s = shares.get(p.id)
    const own = s?.own ?? 0
    const override = s?.override ?? 0
    const total = own + override
    const gross = s?.grossOwn ?? 0
    const payers = s?.ownPayers.size ?? 0
    if (total === 0 && gross === 0) continue
    await admin.from('reelhome_seller_commissions').upsert(
      {
        seller_id: p.id,
        period,
        gross_amount: gross,
        commission_amount: total,
        own_commission: own,
        override_commission: override,
        customer_count: payers,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'seller_id,period' },
    )
    results.push({ seller_id: p.id, ref_code: p.ref_code, own_commission: own, override_commission: override, commission_amount: total, gross_amount: gross, customer_count: payers })
  }

  return NextResponse.json({ period, results })
}
