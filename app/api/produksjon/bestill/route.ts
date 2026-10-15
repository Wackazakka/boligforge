import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getUser } from '../../../../lib/supabase/server'
import { BETALING_AAPEN } from '../../../../lib/betaling'
import { unlockProperty } from '../../../../lib/boliger'
import {
  NIVAA, bestillingerDenneMaaneden, prisForBestilling, viProdusererSaldo, trekkViProduserer, etterBestilling,
  type Nivaa, type Stil, type Presentasjon, type Publisering, type Tidspunkt,
} from '../../../../lib/produksjon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// «Bestill produksjon» (Vedlegg 3). GET = prisforslag for skjemaet,
// POST = legg inn ordren. Betaling: «Vi produserer»-saldo hvis den finnes,
// ellers Stripe (BETALING_AAPEN) eller faktura. Boligen låses opp ved
// bestilling (source 'production') så produksjonen kan lages på den.

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function orgIdFor(client: ReturnType<typeof sb>, userId: string) {
  const { data } = await client.from('organization_members').select('organization_id').eq('user_id', userId).limit(1).maybeSingle()
  return (data?.organization_id as string | undefined) ?? null
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const client = sb()
  const [antall, orgId] = await Promise.all([bestillingerDenneMaaneden(client, user.id), orgIdFor(client, user.id)])
  const saldo = await viProdusererSaldo(client, orgId, user.id)
  return NextResponse.json({
    bestillingerDenneMaaneden: antall,
    saldoIgjen: saldo.reduce((s, e) => s + e.remaining, 0),
    priser: {
      story: prisForBestilling('story', antall),
      film: prisForBestilling('film', antall),
    },
    betalingAapen: BETALING_AAPEN,
  })
}

type Body = {
  propertyId?: string
  nivaa?: string
  stil?: string
  maaMed?: string
  ikkeNevn?: string
  prisVisning?: string
  presentasjon?: string
  publisering?: string
  kanaler?: string[]
  tidspunkt?: string
  tidspunktDato?: string | null
  hjemPlakat?: boolean
  frist?: string | null
  bilderMaaMed?: string[]
  bilderIkkeBruk?: string[]
}

const er = <T extends string>(v: unknown, lovlige: readonly T[]): v is T => typeof v === 'string' && (lovlige as readonly string[]).includes(v)
const tekst = (v: unknown, maks = 2000) => (typeof v === 'string' ? v.trim().slice(0, maks) : '') || null
const liste = (v: unknown, maks = 60) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, maks) : [])

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const b = (await request.json().catch(() => ({}))) as Body

  if (!b.propertyId || !er(b.nivaa, ['story', 'film'] as const)) {
    return NextResponse.json({ error: 'Mangler bolig eller nivå' }, { status: 400 })
  }
  const nivaa: Nivaa = b.nivaa
  const stil: Stil = er(b.stil, ['noytral', 'luksus', 'familie', 'nyetablert'] as const) ? b.stil : 'noytral'
  const presentasjon: Presentasjon = er(b.presentasjon, ['egen', 'ai', 'uten'] as const) ? b.presentasjon : (nivaa === 'story' ? 'uten' : 'ai')
  const publisering: Publisering = er(b.publisering, ['reelhome', 'filer'] as const) ? b.publisering : 'filer'
  const tidspunkt: Tidspunkt = er(b.tidspunkt, ['straks', 'dato', 'serie'] as const) ? b.tidspunkt : 'straks'
  const kanaler = liste(b.kanaler, 10).filter(k => k === 'facebook' || k === 'instagram')
  const tidspunktDato = tidspunkt === 'dato' && typeof b.tidspunktDato === 'string' && !Number.isNaN(Date.parse(b.tidspunktDato)) ? new Date(b.tidspunktDato).toISOString() : null
  const frist = typeof b.frist === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.frist) ? b.frist : null
  if (publisering === 'reelhome' && kanaler.length === 0) {
    return NextResponse.json({ error: 'Velg minst én kanal, eller velg «bare filer»' }, { status: 400 })
  }

  const client = sb()
  const { data: prop } = await client.from('properties').select('id, user_id, address, hjem_url, finn_url, images').eq('id', b.propertyId).maybeSingle()
  if (!prop || prop.user_id !== user.id) return NextResponse.json({ error: 'Boligen tilhører ikke din konto' }, { status: 403 })
  const bilder = new Set<string>((prop.images as string[] | null) ?? [])
  const bilderMaaMed = liste(b.bilderMaaMed).filter(u => bilder.has(u))
  const bilderIkkeBruk = liste(b.bilderIkkeBruk).filter(u => bilder.has(u) && !bilderMaaMed.includes(u))

  const orgId = await orgIdFor(client, user.id)
  const antall = await bestillingerDenneMaaneden(client, user.id)
  const { pris, rabattProsent } = prisForBestilling(nivaa, antall)

  // Betaling: saldo → 0 kr; ellers Stripe (åpent) eller faktura.
  let betaling: 'saldo' | 'stripe' | 'faktura' = 'faktura'
  let entitlementId: string | null = null
  let prisNok = pris
  const saldo = await viProdusererSaldo(client, orgId, user.id)
  if (saldo.length) {
    entitlementId = await trekkViProduserer(client, saldo)
    if (entitlementId) { betaling = 'saldo'; prisNok = 0 }
  }
  if (betaling !== 'saldo' && BETALING_AAPEN) betaling = 'stripe'

  const { data: ordre, error } = await client
    .from('produksjonsordrer')
    .insert({
      property_id: prop.id, organization_id: orgId, user_id: user.id,
      nivaa, stil, maa_med: tekst(b.maaMed), ikke_nevn: tekst(b.ikkeNevn), pris_visning: tekst(b.prisVisning),
      presentasjon, publisering, kanaler, tidspunkt, tidspunkt_dato: tidspunktDato,
      hjem_plakat: b.hjemPlakat !== false, frist,
      bilder_maa_med: bilderMaaMed, bilder_ikke_bruk: bilderIkkeBruk,
      pris_nok: prisNok, rabatt_prosent: betaling === 'saldo' ? 0 : rabattProsent, betaling,
      betalt_at: betaling === 'saldo' ? new Date().toISOString() : null,
      entitlement_id: entitlementId,
      notat_intern: betaling === 'saldo' && nivaa === 'story' ? 'Story trukket som én bolig fra saldo (Vedlegg 1 sier en halv).' : null,
    })
    .select('*')
    .single()
  if (error || !ordre) {
    // Gi tilbake saldotrekket hvis ordren ikke ble lagret.
    if (entitlementId) {
      const e = saldo.find(x => x.id === entitlementId)
      if (e) await client.from('bolig_entitlements').update({ remaining: e.remaining }).eq('id', e.id)
    }
    return NextResponse.json({ error: error?.message ?? 'Kunne ikke lagre bestillingen' }, { status: 500 })
  }

  // Stripe: betal først, webhooken låser opp og markerer betalt.
  if (betaling === 'stripe') {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })
    const site = process.env.NEXT_PUBLIC_SITE_URL
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: user.email,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'nok', unit_amount: prisNok * 100, tax_behavior: 'exclusive',
            product_data: { name: `ReelHome produksjon · ${NIVAA[nivaa].navn}`, description: prop.address ?? undefined },
          },
        }],
        metadata: { type: 'produksjon', order_id: ordre.id, property_id: prop.id, user_id: user.id, organization_id: orgId ?? '', pris_nok: String(prisNok) },
        success_url: `${site}/dashboard/properties/${prop.id}?bestilt=1`,
        cancel_url: `${site}/dashboard/properties/${prop.id}?bestilling_avbrutt=${ordre.id}`,
      })
      await client.from('produksjonsordrer').update({ stripe_session_id: session.id }).eq('id', ordre.id)
      return NextResponse.json({ ok: true, ordre, url: session.url })
    } catch (e) {
      console.error('[produksjon/bestill] Stripe:', e)
      await client.from('produksjonsordrer').update({ status: 'avbrutt', notat_intern: 'Stripe-sesjon feilet' }).eq('id', ordre.id)
      return NextResponse.json({ error: 'Kunne ikke starte betaling' }, { status: 500 })
    }
  }

  // Saldo/faktura: boligen låses opp nå, og vi varsles.
  await unlockProperty(client, { propertyId: prop.id, userId: user.id, source: 'production', priceNok: prisNok })
  await etterBestilling(ordre, { address: prop.address as string | null, url: (prop.hjem_url ?? prop.finn_url) as string | null, email: user.email ?? null })
  return NextResponse.json({ ok: true, ordre })
}
