import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateForPayment, computeAllShares, depthOf, type Partner, type PaymentRow } from '@/lib/commission'

export const runtime = 'nodejs'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://reelhome.ai'

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
function osloPeriod(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit' }).format(new Date())
}
async function validateSeller(refCode: string, token: string) {
  const { data } = await sb().from('reelhome_sellers').select('*').ilike('ref_code', refCode).eq('portal_token', token).maybeSingle()
  return data ?? null
}

// GET /api/agent/summary?ref_code=..&token=..
// Aggregerte, PII-frie tall for en selger: egen provisjon + override fra teamet under.
export async function GET(req: NextRequest) {
  const refCode = req.nextUrl.searchParams.get('ref_code')
  const token = req.nextUrl.searchParams.get('token')
  if (!refCode || !token) return NextResponse.json({ error: 'Mangler parametre' }, { status: 400 })

  const seller = await validateSeller(refCode, token)
  if (!seller) return NextResponse.json({ error: 'Ugyldig lenke' }, { status: 401 })

  const admin = sb()

  // Selgerens egne, direkte kunder (orgs).
  const { data: ownRefs } = await admin.from('reelhome_org_referrals').select('org_id').eq('seller_ref', seller.ref_code)
  const ownOrgIds = (ownRefs ?? []).map(r => r.org_id as string)

  // Hele hierarkiet + alle attribusjoner + registreringsdatoer (for å beregne override).
  const { data: partners } = await admin
    .from('reelhome_sellers').select('id, ref_code, name, parent_id, manager_rate, rate_y1, rate_y2, rate_y3, rate_y4')
  const partnerById = new Map((partners ?? []).map(p => [p.id, p]))

  const parentMap = new Map<string, string | null>((partners ?? []).map(p => [p.id as string, p.parent_id as string | null]))
  const myDepth = depthOf(seller.id, parentMap)
  const canPromote = seller.manager_rate != null && myDepth <= 1
  const directRecruits = (partners ?? [])
    .filter(p => p.parent_id === seller.id)
    .map(p => ({ id: p.id, name: p.name, ref_code: p.ref_code, manager_rate: p.manager_rate != null ? Number(p.manager_rate) : null }))

  const { data: allRefs } = await admin.from('reelhome_org_referrals').select('org_id, seller_ref').not('seller_ref', 'is', null)
  const custToRef = new Map<string, string>((allRefs ?? []).map(r => [r.org_id as string, r.seller_ref as string]))

  // org_id -> org created_at (starten på hver kundes 4-års klokke).
  const allOrgIds = (allRefs ?? []).map(r => r.org_id as string)
  const signup = new Map<string, string>()
  if (allOrgIds.length) {
    const { data: orgs } = await admin.from('organizations').select('id, created_at').in('id', allOrgIds)
    for (const o of orgs ?? []) signup.set(o.id as string, o.created_at as string)
  }

  // Live tall for inneværende periode (egen + override).
  const period = osloPeriod()
  const { data: periodPays } = await admin.from('reelhome_payments').select('org_id, amount, created_at').eq('period', period)
  const payments: PaymentRow[] = (periodPays ?? [])
    .filter(p => p.org_id)
    .map(p => ({ user_id: p.org_id as string, amount: Number(p.amount), created_at: p.created_at as string }))
  const shares = computeAllShares((partners ?? []) as Partner[], custToRef, signup, payments)
  const mine = shares.get(seller.id)
  const curOwn = mine?.own ?? 0
  const curOverride = mine?.override ?? 0
  const curGross = mine?.grossOwn ?? 0

  // Override-fordeling per rekrutt.
  const team: { name: string; ref_code: string; amount: number }[] = []
  if (mine) {
    for (const [childId, amount] of mine.overrideByChild) {
      const c = partnerById.get(childId)
      team.push({ name: c?.name ?? '—', ref_code: c?.ref_code ?? '', amount })
    }
    team.sort((a, b) => b.amount - a.amount)
  }

  // Historiske (admin-beregnede) måneder (egen/override-splitt).
  const { data: history } = await admin
    .from('reelhome_seller_commissions')
    .select('period, gross_amount, commission_amount, own_commission, override_commission, customer_count')
    .eq('seller_id', seller.id)
    .order('period', { ascending: false })
    .limit(6)

  // Linje-for-linje for selgerens EGNE direkte kunder (anonymisert).
  let transactions: { date: string; amount: number; commission: number; rate: number; customer: string; kind: string }[] = []
  if (ownOrgIds.length) {
    const labels = new Map<string, string>()
    ;[...ownOrgIds].sort().forEach((oid, i) => labels.set(oid, `Kunde ${i + 1}`))
    const { data: pays } = await admin
      .from('reelhome_payments').select('org_id, amount, created_at, kind')
      .in('org_id', ownOrgIds).order('created_at', { ascending: false }).limit(200)
    transactions = (pays ?? []).map(p => {
      const amount = Number(p.amount)
      const start = signup.get(p.org_id as string) ?? ''
      const rate = seller.manager_rate != null
        ? Number(seller.manager_rate)
        : (start ? rateForPayment(seller, start, p.created_at as string) : Number(seller.rate_y1))
      return {
        date: p.created_at as string,
        amount,
        commission: amount * rate,
        rate,
        customer: labels.get(p.org_id as string) ?? 'Kunde',
        kind: (p.kind as string) === 'topup' ? 'Topup' : 'Abonnement',
      }
    })
  }

  return NextResponse.json({
    name: seller.name,
    ref_code: seller.ref_code,
    active: seller.active,
    is_manager: seller.manager_rate != null,
    manager_rate: seller.manager_rate != null ? Number(seller.manager_rate) : null,
    recruit_url: seller.manager_rate != null && seller.recruit_token ? `${BASE_URL}/bli-selger?t=${seller.recruit_token}` : null,
    can_promote: canPromote,
    my_manager_rate: seller.manager_rate != null ? Number(seller.manager_rate) : null,
    direct_recruits: directRecruits,
    schedule: {
      rate_y1: Number(seller.rate_y1),
      rate_y2: Number(seller.rate_y2),
      rate_y3: Number(seller.rate_y3),
      rate_y4: Number(seller.rate_y4),
    },
    customer_count: ownOrgIds.length,
    current: { period, gross: curGross, own: curOwn, override: curOverride, commission: curOwn + curOverride },
    team,
    history: history ?? [],
    transactions,
  })
}
