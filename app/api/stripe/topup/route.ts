import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getUser } from '../../../../lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

// Antall videoer per topup-pakke (brukes i webhook og metadata)
const TOPUP_VIDEOS: Record<string, number> = {
  starter: 3,
  pro:     5,
  office:  5,
  trial:   3,
  free:    3,
}

// Pre-opprettede Stripe price IDs per plan
function priceIdForPlan(plan: string): string | null {
  const map: Record<string, string | undefined> = {
    starter: process.env.STRIPE_PRICE_TOPUP_STARTER,
    pro:     process.env.STRIPE_PRICE_TOPUP_PRO,
    office:  process.env.STRIPE_PRICE_TOPUP_OFFICE,
    trial:   process.env.STRIPE_PRICE_TOPUP_STARTER,
    free:    process.env.STRIPE_PRICE_TOPUP_STARTER,
  }
  return map[plan] ?? process.env.STRIPE_PRICE_TOPUP_STARTER ?? null
}

export async function POST() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Hent brukerens plan
  const { data: vc } = await supabase
    .from('video_credits')
    .select('plan')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan   = vc?.plan ?? 'starter'
  const priceId = priceIdForPlan(plan)
  const videos  = TOPUP_VIDEOS[plan] ?? 3

  if (!priceId) {
    return NextResponse.json({ error: 'Topup price ID ikke konfigurert for plan: ' + plan }, { status: 500 })
  }

  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?credits_purchased=1`,
    cancel_url:  `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?cancelled=1`,
    customer_email: user.email,
    metadata: {
      type:              'topup',
      user_id:           user.id,
      plan,
      credits_purchased: String(videos),
    },
  })

  return NextResponse.json({ url: session.url })
}
