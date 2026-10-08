import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

// Produktgjennomgangene: hvilke som er sett og om de er skrudd av, lagret PÅ
// KONTOEN (profiles.tour_state) — ikke bare i nettleserens localStorage.
// Uten dette kom gjennomgangene tilbake på hver ny maskin/nettleser (Nina på
// PC + telefon, Lars på testkontoer i flere nettlesere — 8/10).
//
// Form: { av: boolean, sett: string[] }  (sett = tour-nøkler uten uid-suffiks)
// Skriv går via service_role etter auth-sjekk, så profiles trenger ingen ny
// RLS-policy for dette.

type TourState = { av: boolean; sett: string[] }

const MAKS_NOEKLER = 50
const MAKS_LENGDE = 80

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function normaliser(raw: unknown): TourState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { av?: unknown; sett?: unknown }
  const sett = Array.isArray(r.sett)
    ? r.sett.filter((k): k is string => typeof k === 'string' && k.length <= MAKS_LENGDE).slice(-MAKS_NOEKLER)
    : []
  return { av: r.av === true, sett }
}

async function les(userId: string): Promise<TourState> {
  const { data } = await service().from('profiles').select('tour_state').eq('id', userId).maybeSingle()
  return normaliser(data?.tour_state)
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await les(user.id))
}

/** Body: { av?: boolean, sett?: string, nullstill?: boolean } — flettes inn i det som ligger der. */
export async function PUT(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { av?: unknown; sett?: unknown; nullstill?: unknown }
  const naa = await les(user.id)
  const neste: TourState = { ...naa, sett: [...naa.sett] }

  if (typeof body.av === 'boolean') neste.av = body.av
  if (body.nullstill === true) neste.sett = []
  if (typeof body.sett === 'string' && body.sett.length > 0 && body.sett.length <= MAKS_LENGDE && !neste.sett.includes(body.sett)) {
    neste.sett = [...neste.sett, body.sett].slice(-MAKS_NOEKLER)
  }

  const { error } = await service().from('profiles').update({ tour_state: neste }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(neste)
}
