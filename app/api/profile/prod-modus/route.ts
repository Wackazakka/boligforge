import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

// Produksjonsmodus (16/10): «story» (rask story 9:16 med kun tekst, forenklet
// side) eller «film» (full editor). Lagres på kontoen (profiles.prod_modus) så
// valget følger megleren mellom maskiner, som tour-state. null = ikke valgt.

export type ProdModus = 'story' | 'film'

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await service().from('profiles').select('prod_modus').eq('id', user.id).maybeSingle()
  const modus = data?.prod_modus === 'story' || data?.prod_modus === 'film' ? data.prod_modus : null
  return NextResponse.json({ modus })
}

/** Body: { modus: 'story' | 'film' | null } */
export async function PUT(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { modus?: unknown }
  const modus = body.modus === 'story' || body.modus === 'film' ? body.modus : null
  const { error } = await service().from('profiles').update({ prod_modus: modus }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ modus })
}
