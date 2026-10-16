import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'
import { ensureUnlocked, taIBrukForVideoUrl, kanGenerere, harGratisIgjen, GENERERINGSTAK } from '../../../../lib/boliger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Status for boligsiden: er boligen tatt i bruk, hvor mange genereringer er
// brukt av taket, og har megleren gratisboligen igjen. ?propertyId=
export async function GET(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const propertyId = new URL(request.url).searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'Mangler propertyId' }, { status: 400 })
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const [k, gratis] = await Promise.all([kanGenerere(sb, user.id, propertyId), harGratisIgjen(sb, user.id)])
  if (!k.ok && k.code === 'NOT_OWNER') return NextResponse.json({ error: 'Fant ikke boligen på kontoen din' }, { status: 403 })
  const tattIBruk = k.ok ? k.unlocked : false
  const genereringer = k.ok ? k.antall : k.antall
  return NextResponse.json({
    tattIBruk,
    genereringer,
    tak: GENERERINGSTAK,
    igjen: tattIBruk ? null : Math.max(0, GENERERINGSTAK - genereringer),
    gratisBoligIgjen: gratis,
  })
}

// «Ta boligen i bruk» (16/10): kalles før nedlasting (klienten) og av
// publiserings-/planleggingsrutene (serveren). Første bolig gratis →
// abonnementssaldo → ellers 402 med pris. Idempotent: en brukt bolig gir ok.
// Body: { propertyId } eller { videoUrl }
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { propertyId?: unknown; videoUrl?: unknown }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const res = typeof body.propertyId === 'string'
    ? await ensureUnlocked(sb, user.id, body.propertyId)
    : typeof body.videoUrl === 'string'
      ? await taIBrukForVideoUrl(sb, user.id, body.videoUrl)
      : null
  if (!res) return NextResponse.json({ error: 'Oppgi propertyId eller videoUrl' }, { status: 400 })

  if (res.ok) return NextResponse.json({ ok: true, source: res.unlock.source, ny: res.ny, propertyId: res.unlock.property_id })
  if (res.code === 'NOT_OWNER' || res.code === 'UKJENT_VIDEO') {
    return NextResponse.json({ error: 'Fant ikke boligen på kontoen din' }, { status: 403 })
  }
  return NextResponse.json(
    {
      error: 'Boligen må tas i bruk før du kan laste ned eller publisere',
      code: 'BOLIG_IKKE_BETALT',
      pris_nok: res.pris,
      boliger_denne_maaneden: res.boligerDenneMaaneden,
    },
    { status: 402 },
  )
}
