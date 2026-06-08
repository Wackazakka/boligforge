import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { sellerWelcomeHtml } from '@/lib/seller-email'
import { depthOf, MAX_DEPTH } from '@/lib/commission'

export const runtime = 'nodejs'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://reelhome.ai'

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Slå opp den vervende sjefen via recruit_token — må være en AKTIV SJEF (manager_rate satt)
// OG ikke allerede på maks dybde (rekrutter ville oversteget 3-nivå-grensen).
async function getManager(token: string) {
  const admin = sb()
  const { data } = await admin
    .from('reelhome_sellers')
    .select('id, name, ref_code, manager_rate, active')
    .eq('recruit_token', token)
    .maybeSingle()
  if (!data || !data.active || data.manager_rate == null) return null
  const { data: all } = await admin.from('reelhome_sellers').select('id, parent_id')
  const parentMap = new Map<string, string | null>((all ?? []).map(s => [s.id as string, s.parent_id as string | null]))
  if (depthOf(data.id, parentMap) >= MAX_DEPTH) return null
  return data
}

// GET /api/recruit?t=token -> { ok, manager_name } hvis token hører til en aktiv sjef.
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t')
  if (!t) return NextResponse.json({ ok: false }, { status: 400 })
  const mgr = await getManager(t)
  if (!mgr) return NextResponse.json({ ok: false }, { status: 404 })
  return NextResponse.json({ ok: true, manager_name: mgr.name })
}

// POST /api/recruit { t, name, email, ref_code } -> oppretter ny selger under sjefen.
export async function POST(req: NextRequest) {
  const admin = sb()
  const body = await req.json().catch(() => ({}))
  const t = String(body.t ?? '')
  const mgr = await getManager(t)
  if (!mgr) return NextResponse.json({ error: 'Ugyldig eller utløpt rekrutteringslenke' }, { status: 401 })

  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim()
  const code = String(body.ref_code ?? '').trim().toLowerCase().replace(/\s+/g, '')
  if (!name || !email) return NextResponse.json({ error: 'Navn og e-post er påkrevd' }, { status: 400 })
  if (!/^[a-z0-9_-]{3,40}$/.test(code)) {
    return NextResponse.json({ error: 'Ugyldig ref-kode (3–40 tegn: a–z, 0–9, - eller _)' }, { status: 400 })
  }

  const { data: existing } = await admin.from('reelhome_sellers').select('id').ilike('ref_code', code).maybeSingle()
  if (existing) return NextResponse.json({ error: 'Ref-koden er allerede i bruk — velg en annen' }, { status: 409 })

  const portal_token = randomBytes(24).toString('base64url')
  const recruit_token = randomBytes(18).toString('base64url')
  // Nye rekrutter er vanlige selgere — flat 25 % gjennom 4-års-trappen (admin kan justere).
  const { data: seller, error } = await admin.from('reelhome_sellers').insert({
    name, email, ref_code: code, portal_token, recruit_token,
    commission_rate: 0.25, rate_y1: 0.25, rate_y2: 0.25, rate_y3: 0.25, rate_y4: 0.25,
    discount_rate: 0.25, parent_id: mgr.id, manager_rate: null, active: true,
  }).select().single()
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
        html: sellerWelcomeHtml(name, ref_url, discount_url, portal_url, 25),
      })
      emailSent = true
    }
  } catch (e) {
    console.error('[recruit] welcome email failed:', (e as Error).message)
  }

  return NextResponse.json({ ok: true, ref_url, portal_url, emailSent, seller_id: seller.id })
}
