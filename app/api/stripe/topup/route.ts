import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getUser } from '../../../../lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

// Én enhetlig modell: alle ekstra-/enkeltvideoer koster 989 kr, uansett plan.
const SINGLE_VIDEO_PRICE_NOK = 989

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

  const plan = vc?.plan ?? 'starter'

  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      quantity: 1,
      price_data: {
        currency:    'nok',
        unit_amount: SINGLE_VIDEO_PRICE_NOK * 100,
        product_data: {
          name:        'Enkeltvideo — ReelHome',
          description: `Engangskjøp av 1 videokreditt — ${SINGLE_VIDEO_PRICE_NOK} kr`,
        },
      },
    }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?credits_purchased=1`,
    cancel_url:  `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?cancelled=1`,
    customer_email: user.email,
    metadata: {
      type:              'topup',
      user_id:           user.id,
      plan,
      credits_purchased: '1',
    },
  })

  return NextResponse.json({ url: session.url })
}
