import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  const body = await request.text()
  const sig  = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {

      // ----------------------------------------------------------------
      // Checkout fullført → oppdater org med kunde-ID, abonnement og plan
      // ----------------------------------------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const organizationId = session.metadata?.organization_id
        const plan           = session.metadata?.plan

        if (!organizationId || !plan) {
          console.warn('Webhook: mangler metadata på session', session.id)
          break
        }

        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id

        const customerId = typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id

        const { error } = await supabase
          .from('organizations')
          .update({
            stripe_customer_id:     customerId     ?? null,
            stripe_subscription_id: subscriptionId ?? null,
            plan,
          })
          .eq('id', organizationId)

        if (error) {
          console.error('Supabase update failed (checkout.session.completed):', error)
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
        }

        console.log(`Org ${organizationId} oppgradert til plan "${plan}"`)
        break
      }

      // ----------------------------------------------------------------
      // Abonnement kansellert → sett plan til 'cancelled'
      // ----------------------------------------------------------------
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId   = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id

        if (!customerId) break

        const { error } = await supabase
          .from('organizations')
          .update({ plan: 'cancelled' })
          .eq('stripe_customer_id', customerId)

        if (error) {
          console.error('Supabase update failed (customer.subscription.deleted):', error)
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
        }

        console.log(`Kunde ${customerId} — abonnement kansellert`)
        break
      }

      default:
        // Ignorer ukjente events
        break
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
