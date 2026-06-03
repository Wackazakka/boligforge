import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getUser } from '../../../../lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

// Plan-spesifikke topup-pakker. Prisen per video er aldri lavere enn 199 kr.
const TOPUP_PACKAGES: Record<string, { qty: number; pricePerUnit: number }> = {
  starter: { qty: 3, pricePerUnit: 299 },  // 897 kr totalt
  pro:     { qty: 5, pricePerUnit: 249 },  // 1 245 kr totalt
  office:  { qty: 5, pricePerUnit: 249 },  // 1 245 kr totalt
  trial:   { qty: 3, pricePerUnit: 299 },
  free:    { qty: 3, pricePerUnit: 299 },
}

export async function POST(request: Request) {
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
  const { data: credits } = await supabase
    .from('video_credits')
    .select('plan')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = credits?.plan ?? 'starter'
  const pkg  = TOPUP_PACKAGES[plan] ?? TOPUP_PACKAGES.starter
  const totalNok = pkg.qty * pkg.pricePerUnit

  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: pkg.qty,
        price_data: {
          currency:    'nok',
          unit_amount: pkg.pricePerUnit * 100,  // øre
          product_data: {
            name:        `${pkg.qty} ekstra videoer`,
            description: `Enkeltvideoer for ReelHome — ${pkg.pricePerUnit} kr per video`,
          },
        },
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?credits_purchased=1`,
    cancel_url:  `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?cancelled=1`,
    customer_email: user.email,
    metadata: {
      type:              'extra_credits',
      user_id:           user.id,
      credits_purchased: String(pkg.qty),
    },
  })

  return NextResponse.json({ url: session.url, total: totalNok })
}
