import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getUser } from '../../../../lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  pro:     process.env.STRIPE_PRICE_PRO!,
  office:  process.env.STRIPE_PRICE_OFFICE!,
}

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const plan: string = body.plan
  const quantity: number = body.quantity ?? 1

  if (!plan || !PRICE_IDS[plan]) {
    return NextResponse.json({ error: 'Ugyldig plan' }, { status: 400 })
  }

  if (plan === 'office' && (!Number.isInteger(quantity) || quantity < 1)) {
    return NextResponse.json({ error: 'Ugyldig antall meglere' }, { status: 400 })
  }

  // Hent organisasjonen til brukeren
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, organizations(id, slug, stripe_customer_id)')
    .eq('id', user.id)
    .maybeSingle()

  const orgRaw = profile?.organizations
  const org = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as {
    id: string
    slug: string
    stripe_customer_id?: string
  } | null

  // Bygg session-parametere
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: PRICE_IDS[plan],
        quantity: plan === 'office' ? quantity : 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?cancelled=1`,
    metadata: {
      plan,
      quantity:        String(plan === 'office' ? quantity : 1),
      user_id:         user.id,
      organization_id: org?.id ?? '',
    },
  }

  // Gjenbruk eksisterende Stripe-kunde hvis finnes
  if (org?.stripe_customer_id) {
    sessionParams.customer = org.stripe_customer_id
  } else {
    sessionParams.customer_email = user.email
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams)
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Kunne ikke opprette checkout-sesjon' }, { status: 500 })
  }
}
