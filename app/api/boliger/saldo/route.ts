import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'
import { hentSaldo, PRIS, ABONNEMENTER } from '../../../../lib/boliger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Erstatter /api/video/credits (16/10). Saldo i boliger, ikke videoer.
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  try {
    const saldo = await hentSaldo(sb, user.id)
    return NextResponse.json({ ...saldo, priser: PRIS, abonnementer_tilbud: ABONNEMENTER })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
