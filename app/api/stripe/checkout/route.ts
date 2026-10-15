import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getUser } from '../../../../lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { ABONNEMENTER, boligerDenneMaaneden, prisForNesteBolig, stripeLookupKey, type AbonnementId } from '../../../../lib/boliger'

// Checkout for bolig-modellen (16/10). To kjøp:
//   { abonnement: AbonnementId }  → månedlig abonnement (pris via lookup_key
//                                   `reelhome_<id>` i Stripe, så ingen env-vars)
//   { bolig: propertyId }         → engangskjøp som låser opp én bolig til
//                                   dagens trinnpris (790/690/590)
// Webhooken (../webhook) fyller saldo og låser opp. Stripe står i TESTMODUS i
// prod til live-nøklene legges inn sammen med BETALING_AAPEN=true.

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

// Find or create a reusable forever-duration percent-off coupon for the given percent.
async function getOrCreateCoupon(stripe: Stripe, pct: number): Promise<string> {
  const id = `reelhome-disc-${String(pct).replace('.', '_')}`
  try {
    return (await stripe.coupons.retrieve(id)).id
  } catch {
    try {
      return (await stripe.coupons.create({ id, percent_off: pct, duration: 'forever', name: `ReelHome ${pct}% partnerrabatt` })).id
    } catch {
      return (await stripe.coupons.retrieve(id)).id
    }
  }
}

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { abonnement?: string; bolig?: string }
  const abonnement = body.abonnement && body.abonnement in ABONNEMENTER ? (body.abonnement as AbonnementId) : null
  const boligId = typeof body.bolig === 'string' ? body.bolig : null
  if (!abonnement && !boligId) {
    return NextResponse.json({ error: 'Oppgi abonnement eller bolig' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, organizations(id, stripe_customer_id)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  const orgRaw = membership?.organizations
  const org = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { id: string; stripe_customer_id?: string | null } | null
  if (!org?.id) return NextResponse.json({ error: 'Ikke tilknyttet en organisasjon' }, { status: 400 })

  const stripe = getStripe()
  const site = process.env.NEXT_PUBLIC_SITE_URL
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [],
    success_url: `${site}/dashboard/billing?abonnement=ok`,
    cancel_url:  `${site}/dashboard/billing?avbrutt=1`,
    metadata: {},
  }

  if (abonnement) {
    const plan = ABONNEMENTER[abonnement]
    const prices = await stripe.prices.list({ lookup_keys: [stripeLookupKey(abonnement)], active: true, limit: 1 })
    const price = prices.data[0]
    if (!price) {
      console.error('[checkout] fant ingen Stripe-pris for', abonnement)
      return NextResponse.json({ error: 'Abonnementet er ikke satt opp for betaling ennå' }, { status: 500 })
    }

    // Partnerrabatt: org-en registrerte seg via en selgers rabatt-lenke
    // (reelhome_org_referrals.discount_rate) → prosent av abonnementet, for alltid.
    let discounts: { coupon: string }[] | undefined
    try {
      const { data: refRow } = await supabase
        .from('reelhome_org_referrals').select('discount_rate').eq('org_id', org.id).maybeSingle()
      const rate = Number(refRow?.discount_rate ?? 0)
      if (rate > 0 && rate <= 1) {
        discounts = [{ coupon: await getOrCreateCoupon(stripe, +(rate * 100).toFixed(2)) }]
      }
    } catch (e) {
      console.error('[checkout] discount lookup failed:', (e as Error).message)
    }

    const metadata = {
      type: 'abonnement',
      abonnement,
      kind: plan.kind,
      scope: plan.scope,
      user_id: user.id,
      organization_id: org.id,
    }
    sessionParams.mode = 'subscription'
    sessionParams.line_items = [{ price: price.id, quantity: 1 }]
    sessionParams.metadata = metadata
    sessionParams.subscription_data = { metadata }
    if (discounts) sessionParams.discounts = discounts
  } else if (boligId) {
    const { data: prop } = await supabase
      .from('properties')
      .select('id, user_id, address')
      .eq('id', boligId)
      .maybeSingle()
    if (!prop || prop.user_id !== user.id) {
      return NextResponse.json({ error: 'Boligen tilhører ikke din konto' }, { status: 403 })
    }
    const { data: unlock } = await supabase.from('property_unlocks').select('id').eq('property_id', boligId).maybeSingle()
    if (unlock) return NextResponse.json({ error: 'Boligen er allerede låst opp' }, { status: 400 })

    const antall = await boligerDenneMaaneden(supabase, user.id)
    const pris = prisForNesteBolig(antall)
    sessionParams.line_items = [{
      quantity: 1,
      price_data: {
        currency: 'nok',
        unit_amount: pris * 100,
        tax_behavior: 'exclusive',
        product_data: {
          name: `ReelHome · ${prop.address ?? 'bolig'}`,
          description: 'Låser opp boligen: alle formater, nye versjoner og publisering inkludert',
        },
      },
    }]
    sessionParams.metadata = {
      type: 'bolig',
      property_id: boligId,
      user_id: user.id,
      organization_id: org.id,
      pris_nok: String(pris),
    }
    sessionParams.success_url = `${site}/dashboard/properties/${boligId}?betalt=1`
    sessionParams.cancel_url  = `${site}/dashboard/properties/${boligId}`
  }

  if (org.stripe_customer_id) sessionParams.customer = org.stripe_customer_id
  else sessionParams.customer_email = user.email

  try {
    const session = await stripe.checkout.sessions.create(sessionParams)
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Kunne ikke opprette checkout-sesjon' }, { status: 500 })
  }
}
