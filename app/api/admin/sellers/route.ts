import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { sellerWelcomeHtml } from '@/lib/seller-email'

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

// GET /api/admin/sellers — list with customer count (orgs) + all-time commission.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = sb()

  const { data: sellers, error } = await admin.from('reelhome_sellers').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: refs } = await admin.from('reelhome_org_referrals').select('seller_ref').not('seller_ref', 'is', null)
  const countMap = new Map<string, number>()
  for (const r of refs ?? []) {
    const k = r.seller_ref as string
    countMap.set(k, (countMap.get(k) ?? 0) + 1)
  }

  const { data: comms } = await admin.from('reelhome_seller_commissions').select('seller_id, commission_amount')
  const commMap = new Map<string, number>()
  for (const c of comms ?? []) commMap.set(c.seller_id as string, (commMap.get(c.seller_id as string) ?? 0) + Number(c.commission_amount))

  const nameById = new Map((sellers ?? []).map(s => [s.id, s.name]))
  const result = (sellers ?? []).map(s => ({
    ...s,
    customer_count: countMap.get(s.ref_code) ?? 0,
    total_commission: commMap.get(s.id) ?? 0,
    parent_name: s.parent_id ? nameById.get(s.parent_id) ?? null : null,
  }))

  return NextResponse.json({ sellers: result })
}

// POST /api/admin/sellers — create a seller.
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = sb()

  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim()
  const code = String(body.ref_code ?? '').trim().toLowerCase().replace(/\s+/g, '')

  if (!name || !email) return NextResponse.json({ error: 'Navn og e-post er påkrevd' }, { status: 400 })
  if (!/^[a-z0-9_-]{3,40}$/.test(code)) {
    return NextResponse.json({ error: 'Ugyldig ref-kode (3–40 tegn: a–z, 0–9, - eller _)' }, { status: 400 })
  }

  const { data: existing } = await admin.from('reelhome_sellers').select('id').ilike('ref_code', code).maybeSingle()
  if (existing) return NextResponse.json({ error: 'Ref-koden er allerede i bruk' }, { status: 409 })

  const parseRate = (v: unknown, def: number): number => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : def
  }
  const rate_y1 = parseRate(body.rate_y1, 0.25)
  const rate_y2 = parseRate(body.rate_y2, rate_y1)
  const rate_y3 = parseRate(body.rate_y3, rate_y2)
  const rate_y4 = parseRate(body.rate_y4, rate_y3)
  const discount_rate = parseRate(body.discount_rate, 0.25)
  const parent_id = typeof body.parent_id === 'string' && body.parent_id ? body.parent_id : null
  const mr = Number(body.manager_rate)
  const manager_rate = body.manager_rate !== undefined && body.manager_rate !== null && body.manager_rate !== '' && Number.isFinite(mr) && mr >= 0 && mr <= 1 ? mr : null

  const portal_token = randomBytes(24).toString('base64url')
  const recruit_token = randomBytes(18).toString('base64url')
  const { data: seller, error } = await admin
    .from('reelhome_sellers')
    .insert({ name, email, ref_code: code, portal_token, recruit_token, commission_rate: rate_y1, rate_y1, rate_y2, rate_y3, rate_y4, discount_rate, parent_id, manager_rate })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ref_url = `${BASE_URL}/?ref=${code}`
  const discount_url = `${BASE_URL}/?ref=${code}&rabatt=1`
  const portal_url = `${BASE_URL}/agent/${code}?token=${portal_token}`

  let emailSent = false
  try {
    if (process.env.RESEND_API_KEY) {
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: 'ReelHome <noreply@reelhome.ai>',
        to: email,
        subject: 'Din ReelHome selger-portal',
        html: sellerWelcomeHtml(name, ref_url, discount_url, portal_url, Math.round(discount_rate * 100)),
      })
      emailSent = true
    }
  } catch (e) {
    console.error('[admin/sellers] welcome email failed:', (e as Error).message)
  }

  return NextResponse.json({ seller, ref_url, discount_url, portal_url, emailSent })
}
