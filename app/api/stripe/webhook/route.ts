import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { VIDEOS_BY_PLAN, FREE_VIDEOS_PER_MONTH, setPlanForUsers, orgMemberIds } from '../../../../lib/video-credits'

export const runtime = 'nodejs'

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// 'YYYY-MM' in Europe/Oslo for a unix-seconds timestamp (or now) — affiliate payment period.
function osloPeriod(unixSeconds?: number): string {
  const d = unixSeconds ? new Date(unixSeconds * 1000) : new Date()
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit' }).format(d)
}

export async function POST(request: Request) {
  const body = await request.text()
  const sig  = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const stripe   = getStripe()
  const supabase = getSupabase()

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
      // Checkout fullført → sjekk type (extra_credits eller subscription)
      // ----------------------------------------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // ── Ekstra videokreditter (engangskjøp: legacy buy-credits + ny topup) ──
        if (
          session.metadata?.type === 'extra_credits' ||
          session.metadata?.type === 'topup'
        ) {
          const userId  = session.metadata.user_id
          const credits = parseInt(session.metadata.credits_purchased ?? '0', 10)
          const type    = session.metadata.type

          if (!userId || !credits) {
            console.warn(`Webhook: ${type} mangler user_id eller credits_purchased`, session.id)
            break
          }

          // Les nåværende extra_credits, inkrementer
          const { data: row } = await supabase
            .from('video_credits')
            .select('extra_credits')
            .eq('user_id', userId)
            .maybeSingle()

          const current = row?.extra_credits ?? 0

          const { error } = await supabase
            .from('video_credits')
            .upsert(
              { user_id: userId, extra_credits: current + credits },
              { onConflict: 'user_id' }
            )

          if (error) {
            console.error(`Supabase update failed (${type}):`, error)
            return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
          }

          console.log(`Bruker ${userId} [${type}]: +${credits} ekstra videokreditter (nå ${current + credits})`)

          // Affiliate-logg: logg topup-betalingen (tilskrevet brukerens org).
          try {
            if (session.amount_total != null) {
              const { data: prof } = await supabase.from('profiles').select('organization_id').eq('id', userId).maybeSingle()
              await supabase.from('reelhome_payments').upsert(
                {
                  org_id: (prof?.organization_id as string) ?? null,
                  stripe_event_id: event.id,
                  stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
                  plan: 'topup',
                  kind: 'topup',
                  amount: session.amount_total / 100,
                  currency: session.currency ?? 'nok',
                  period: osloPeriod(event.created),
                },
                { onConflict: 'stripe_event_id', ignoreDuplicates: true }
              )
            }
          } catch (e) {
            console.error('[affiliate] topup-logg feilet:', (e as Error).message)
          }
          break
        }

        // ── Abonnement ───────────────────────────────────────────────
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

        // Sett kvoten i video_credits (per bruker) — det er tabellen
        // /api/video/generate faktisk håndhever. Kontor-planen er per sete:
        // alle medlemmer i org-en får sin egen månedskvote.
        const included = VIDEOS_BY_PLAN[plan]
        if (included == null) {
          console.warn(`Webhook: ukjent plan "${plan}" — ingen kvote satt`, session.id)
          break
        }

        const quantity = parseInt(session.metadata?.quantity ?? '1', 10)
        let userIds: string[]
        if (plan === 'office' || plan === 'kontor') {
          userIds = await orgMemberIds(supabase, organizationId)
          if (!userIds.length && session.metadata?.user_id) userIds = [session.metadata.user_id]
          if (userIds.length > quantity) {
            console.warn(`Org ${organizationId}: ${userIds.length} medlemmer, men bare ${quantity} betalte seter`)
          }
        } else {
          userIds = session.metadata?.user_id ? [session.metadata.user_id] : []
        }

        const vcError = await setPlanForUsers(supabase, userIds, plan, included)
        if (vcError) {
          console.error('Supabase video_credits update failed (checkout.session.completed):', vcError)
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
        }

        console.log(`Org ${organizationId} oppgradert til "${plan}" — ${included} videoer/mnd for ${userIds.length} bruker(e)`)
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

        const { data: cancelledOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        const { error } = await supabase
          .from('organizations')
          .update({ plan: 'cancelled' })
          .eq('stripe_customer_id', customerId)

        if (error) {
          console.error('Supabase update failed (customer.subscription.deleted):', error)
          return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
        }

        // Nedgrader medlemmenes videokvote til gratis-nivået. Kjøpte
        // extra_credits beholdes — de ruller over uavhengig av plan.
        if (cancelledOrg?.id) {
          const memberIds = await orgMemberIds(supabase, cancelledOrg.id)
          const vcError = await setPlanForUsers(supabase, memberIds, 'cancelled', FREE_VIDEOS_PER_MONTH)
          if (vcError) console.error('video_credits downgrade failed (customer.subscription.deleted):', vcError)
        }

        console.log(`Kunde ${customerId} — abonnement kansellert`)
        break
      }

      // ----------------------------------------------------------------
      // Abonnement-faktura betalt → logg for affiliate-provisjon (per org)
      // ----------------------------------------------------------------
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        try {
          const amount = (invoice.amount_paid ?? 0) / 100
          if (amount > 0) {
            const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null
            let orgId: string | null = null
            if (customerId) {
              const { data: org } = await supabase.from('organizations').select('id').eq('stripe_customer_id', customerId).maybeSingle()
              orgId = (org?.id as string) ?? null
            }
            await supabase.from('reelhome_payments').upsert(
              {
                org_id: orgId,
                stripe_event_id: event.id,
                stripe_invoice_id: invoice.id,
                stripe_customer_id: customerId,
                plan: null,
                kind: 'invoice',
                amount,
                currency: invoice.currency ?? 'nok',
                period: osloPeriod(event.created),
              },
              { onConflict: 'stripe_event_id', ignoreDuplicates: true }
            )
          }
        } catch (e) {
          console.error('[affiliate] invoice.paid-logg feilet:', (e as Error).message)
        }
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
