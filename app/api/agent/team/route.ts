import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { depthOf } from '@/lib/commission'

export const runtime = 'nodejs'

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
async function validateSeller(refCode: string, token: string) {
  const { data } = await sb()
    .from('reelhome_sellers')
    .select('id, ref_code, manager_rate, active, parent_id')
    .ilike('ref_code', refCode)
    .eq('portal_token', token)
    .maybeSingle()
  return data ?? null
}

// POST /api/agent/team { ref_code, token, child_id, manager_rate?: number|null }
// En øverste salgssjef gir/fjerner en DIREKTE rekrutt status som mini-sjef (override-sats,
// begrenset av salgssjefens egen sats). Åpner ett nivå til (maks 3 totalt).
export async function POST(req: NextRequest) {
  const admin = sb()
  const body = await req.json().catch(() => ({}))
  const refCode = String(body.ref_code ?? '')
  const token = String(body.token ?? '')

  const seller = await validateSeller(refCode, token)
  if (!seller) return NextResponse.json({ error: 'Ugyldig lenke' }, { status: 401 })
  if (seller.manager_rate == null) return NextResponse.json({ error: 'Bare salgssjefer kan styre team' }, { status: 403 })

  const { data: all } = await admin.from('reelhome_sellers').select('id, parent_id')
  const parentMap = new Map<string, string | null>((all ?? []).map(s => [s.id as string, s.parent_id as string | null]))
  if (depthOf(seller.id, parentMap) > 1) {
    return NextResponse.json({ error: 'Bare øverste salgssjef kan gi verve-tilgang' }, { status: 403 })
  }

  const childId = String(body.child_id ?? '')
  const { data: child } = await admin.from('reelhome_sellers').select('id, parent_id').eq('id', childId).maybeSingle()
  if (!child || child.parent_id !== seller.id) {
    return NextResponse.json({ error: 'Selgeren er ikke i ditt team' }, { status: 404 })
  }

  let manager_rate: number | null = null
  if (body.manager_rate !== null && body.manager_rate !== undefined && body.manager_rate !== '') {
    const r = Number(body.manager_rate)
    if (!Number.isFinite(r) || r < 0 || r > 1) return NextResponse.json({ error: 'Ugyldig sats (0–100%)' }, { status: 400 })
    manager_rate = Math.min(r, Number(seller.manager_rate))
  }

  const { error } = await admin.from('reelhome_sellers').update({ manager_rate }).eq('id', childId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, manager_rate })
}
