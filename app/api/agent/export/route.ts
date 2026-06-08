import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateForPayment } from '@/lib/commission'

export const runtime = 'nodejs'

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
async function validateSeller(refCode: string, token: string) {
  const { data } = await sb()
    .from('reelhome_sellers')
    .select('id, name, ref_code, portal_token, rate_y1, rate_y2, rate_y3, rate_y4')
    .ilike('ref_code', refCode)
    .eq('portal_token', token)
    .maybeSingle()
  return data ?? null
}

const csvRow = (cells: (string | number)[]) =>
  cells.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')

// GET /api/agent/export?ref_code=..&token=..
// CSV faktureringsgrunnlag: månedlig oppsummering + linje for linje (kunder anonymisert).
export async function GET(req: NextRequest) {
  const refCode = req.nextUrl.searchParams.get('ref_code')
  const token = req.nextUrl.searchParams.get('token')
  if (!refCode || !token) return NextResponse.json({ error: 'Mangler parametre' }, { status: 400 })

  const seller = await validateSeller(refCode, token)
  if (!seller) return NextResponse.json({ error: 'Ugyldig lenke' }, { status: 401 })

  const admin = sb()

  const { data: comms } = await admin
    .from('reelhome_seller_commissions')
    .select('period, gross_amount, commission_amount, customer_count')
    .eq('seller_id', seller.id)
    .order('period', { ascending: false })

  const { data: refs } = await admin.from('reelhome_org_referrals').select('org_id').eq('seller_ref', seller.ref_code)
  const orgIds = (refs ?? []).map(r => r.org_id as string)
  const labels = new Map<string, string>()
  ;[...orgIds].sort().forEach((oid, i) => labels.set(oid, `Kunde ${i + 1}`))

  const signup = new Map<string, string>()
  if (orgIds.length) {
    const { data: orgs } = await admin.from('organizations').select('id, created_at').in('id', orgIds)
    for (const o of orgs ?? []) signup.set(o.id as string, o.created_at as string)
  }

  let pays: { org_id: string; amount: number; created_at: string; kind: string; period: string }[] = []
  if (orgIds.length) {
    const { data } = await admin
      .from('reelhome_payments')
      .select('org_id, amount, created_at, kind, period')
      .in('org_id', orgIds)
      .order('created_at', { ascending: false })
    pays = (data ?? []) as typeof pays
  }

  const lines: string[] = []
  lines.push(`Faktureringsgrunnlag — ${seller.name} (${seller.ref_code})`)
  lines.push('')
  lines.push('MÅNEDLIG OPPSUMMERING')
  lines.push(csvRow(['Periode', 'Brutto omsetning (kr)', 'Provisjon (kr)', 'Antall kunder']))
  for (const c of comms ?? []) {
    lines.push(csvRow([c.period, c.gross_amount, c.commission_amount, c.customer_count]))
  }
  lines.push('')
  lines.push('TRANSAKSJONER (linje for linje)')
  lines.push(csvRow(['Dato', 'Type', 'Kunde', 'Beløp (kr)', 'Provisjon (kr)', 'Periode']))
  for (const p of pays) {
    const start = signup.get(p.org_id) ?? ''
    const rate = start ? rateForPayment(seller, start, p.created_at) : Number(seller.rate_y1)
    lines.push(csvRow([
      new Date(p.created_at).toLocaleDateString('nb-NO'),
      p.kind === 'topup' ? 'Topup' : 'Abonnement',
      labels.get(p.org_id) ?? 'Kunde',
      Number(p.amount),
      Number(p.amount) * rate,
      p.period ?? '',
    ]))
  }

  const csv = '﻿' + lines.join('\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="faktureringsgrunnlag-${seller.ref_code}.csv"`,
    },
  })
}
