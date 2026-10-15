import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ABONNEMENTER, unlockProperty, utloperEtterNesteMaaned, type AbonnementId } from '../../../../lib/boliger'

// Stripe-webhook for bolig-modellen (16/10).
//   checkout.session.completed  type=bolig       → lås opp boligen (purchase)
//                               type=abonnement  → sørg for abonnementsrad + kundeid på org
//   invoice.paid                (abonnement)     → ny saldo-post for perioden (idempotent per faktura)
//   customer.subscription.updated/deleted        → status på abonnementsraden
// invoice.paid er selvforsynt: mangler abonnementsraden (events kan komme i
// vilkårlig rekkefølge), lages den fra Stripe-abonnementets metadata.

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

const idOf = (x: string | { id: string } | null | undefined) => (typeof x === 'string' ? x : x?.id ?? null)

type SubRow = { id: string; organization_id: string; user_id: string | null; kind: string; scope: string; boliger_per_month: number }

function statusFra(stripeStatus: Stripe.Subscription.Status): 'active' | 'past_due' | 'cancelled' {
  if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') return 'cancelled'
  if (stripeStatus === 'past_due' || stripeStatus === 'unpaid' || stripeStatus === 'incomplete' || stripeStatus === 'paused') return 'past_due'
  return 'active'
}

function periode(sub: Stripe.Subscription) {
  const item = sub.items?.data?.[0]
  return {
    current_period_start: item?.current_period_start ? new Date(item.current_period_start * 1000).toISOString() : null,
    current_period_end:   item?.current_period_end   ? new Date(item.current_period_end * 1000).toISOString()   : null,
  }
}

// Finn eller opprett raden i bolig_subscriptions for et Stripe-abonnement.
async function ensureSubscriptionRow(supabase: SupabaseClient, sub: Stripe.Subscription): Promise<SubRow | null> {
  const { data: existing } = await supabase
    .from('bolig_subscriptions')
    .select('id, organization_id, user_id, kind, scope, boliger_per_month')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle()
  if (existing) {
    await supabase.from('bolig_subscriptions')
      .update({ status: statusFra(sub.status), ...periode(sub), updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    return existing as SubRow
  }

  const abonnement = sub.metadata?.abonnement as AbonnementId | undefined
  const plan = abonnement ? ABONNEMENTER[abonnement] : null
  const organizationId = sub.metadata?.organization_id
  if (!plan || !organizationId) {
    console.warn('[webhook] abonnement uten gyldig metadata', sub.id, sub.metadata)
    return null
  }
  const { data, error } = await supabase
    .from('bolig_subscriptions')
    .insert({
      organization_id:        organizationId,
      user_id:                plan.scope === 'medlem' ? (sub.metadata?.user_id ?? null) : null,
      kind:                   plan.kind,
      scope:                  plan.scope,
      boliger_per_month:      plan.boligerPerMnd,
      price_nok_month:        plan.prisPerMnd,
      status:                 statusFra(sub.status),
      stripe_subscription_id: sub.id,
      ...periode(sub),
    })
    .select('id, organization_id, user_id, kind, scope, boliger_per_month')
    .single()
  if (error) {
    // Samtidig event rakk først: hent raden.
    const { data: again } = await supabase
      .from('bolig_subscriptions')
      .select('id, organization_id, user_id, kind, scope, boliger_per_month')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle()
    return (again as SubRow | null) ?? null
  }

  await supabase.from('organizations')
    .update({ stripe_customer_id: idOf(sub.customer), stripe_subscription_id: sub.id, plan: abonnement })
    .eq('id', organizationId)
  return data as SubRow
}

// Én saldo-post per betalt faktura. «Ubrukte boliger overføres til neste
// måned» = posten gjelder ut neste kalendermåned.
async function fyllSaldoForFaktura(supabase: SupabaseClient, row: SubRow, invoiceId: string, paidAt: Date) {
  const note = `invoice:${invoiceId}`
  const { data: finnes } = await supabase.from('bolig_entitlements').select('id').eq('note', note).maybeSingle()
  if (finnes) return false
  const { error } = await supabase.from('bolig_entitlements').insert({
    organization_id: row.organization_id,
    user_id:         row.user_id,
    kind:            row.kind,
    quantity:        row.boliger_per_month,
    remaining:       row.boliger_per_month,
    source:          'subscription',
    subscription_id: row.id,
    period_start:    paidAt.toISOString().slice(0, 10),
    expires_at:      utloperEtterNesteMaaned(paidAt),
    note,
  })
  if (error) throw new Error(`bolig_entitlements insert: ${error.message}`)
  return true
}

export async function POST(request: Request) {
  const body = await request.text()
  const sig  = request.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const stripe   = getStripe()
  const supabase = getSupabase()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const meta = session.metadata ?? {}

        if (meta.type === 'bolig') {
          const propertyId = meta.property_id
          const userId     = meta.user_id
          const pris       = parseInt(meta.pris_nok ?? '0', 10)
          if (!propertyId || !userId) {
            console.warn('[webhook] bolig-kjøp mangler metadata', session.id)
            break
          }
          const unlock = await unlockProperty(supabase, { propertyId, userId, source: 'purchase', priceNok: pris, stripeSessionId: session.id })
          if (!unlock) return NextResponse.json({ error: 'Kunne ikke låse opp boligen' }, { status: 500 })
          if (meta.organization_id && session.customer) {
            await supabase.from('organizations').update({ stripe_customer_id: idOf(session.customer) }).eq('id', meta.organization_id).is('stripe_customer_id', null)
          }
          console.log(`[webhook] bolig ${propertyId} låst opp for ${userId} (${pris} kr)`)

          try {
            if (session.amount_total != null) {
              await supabase.from('reelhome_payments').upsert({
                org_id: meta.organization_id || null,
                stripe_event_id: event.id,
                stripe_customer_id: idOf(session.customer),
                plan: 'bolig',
                kind: 'bolig',
                amount: session.amount_total / 100,
                currency: session.currency ?? 'nok',
                period: osloPeriod(event.created),
              }, { onConflict: 'stripe_event_id', ignoreDuplicates: true })
            }
          } catch (e) {
            console.error('[affiliate] bolig-logg feilet:', (e as Error).message)
          }
          break
        }

        if (meta.type === 'abonnement') {
          const subId = idOf(session.subscription)
          if (!subId) { console.warn('[webhook] abonnement-session uten subscription', session.id); break }
          const sub = await stripe.subscriptions.retrieve(subId)
          const row = await ensureSubscriptionRow(supabase, sub)
          if (!row) return NextResponse.json({ error: 'Kunne ikke registrere abonnementet' }, { status: 500 })
          console.log(`[webhook] abonnement ${meta.abonnement} registrert for org ${row.organization_id}`)
          break
        }

        console.warn('[webhook] checkout uten kjent type (gammel kjøpsvei?)', session.id, meta)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subId = idOf(invoice.parent?.subscription_details?.subscription ?? null)

        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          const row = await ensureSubscriptionRow(supabase, sub)
          if (!row) return NextResponse.json({ error: 'Abonnement uten metadata' }, { status: 500 })
          const ny = await fyllSaldoForFaktura(supabase, row, invoice.id, new Date((invoice.status_transitions?.paid_at ?? event.created) * 1000))
          console.log(`[webhook] faktura ${invoice.id}: ${ny ? `+${row.boliger_per_month} boliger` : 'alt registrert'} (${row.kind}, org ${row.organization_id})`)
        }

        // Affiliate-logg (uendret fra før).
        try {
          const amount = (invoice.amount_paid ?? 0) / 100
          if (amount > 0) {
            const customerId = idOf(invoice.customer)
            let orgId: string | null = null
            if (customerId) {
              const { data: org } = await supabase.from('organizations').select('id').eq('stripe_customer_id', customerId).maybeSingle()
              orgId = (org?.id as string) ?? null
            }
            await supabase.from('reelhome_payments').upsert({
              org_id: orgId,
              stripe_event_id: event.id,
              stripe_invoice_id: invoice.id,
              stripe_customer_id: customerId,
              plan: null,
              kind: 'invoice',
              amount,
              currency: invoice.currency ?? 'nok',
              period: osloPeriod(event.created),
            }, { onConflict: 'stripe_event_id', ignoreDuplicates: true })
          }
        } catch (e) {
          console.error('[affiliate] invoice.paid-logg feilet:', (e as Error).message)
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const row = await ensureSubscriptionRow(supabase, sub)
        if (!row) break
        const status = event.type === 'customer.subscription.deleted' ? 'cancelled' : statusFra(sub.status)
        await supabase.from('bolig_subscriptions')
          .update({ status, ...periode(sub), updated_at: new Date().toISOString() })
          .eq('id', row.id)

        if (status === 'cancelled') {
          // organizations.plan er bare et visningsfelt i backoffice: 'cancelled'
          // når kontoret ikke har flere aktive abonnementer.
          const { count } = await supabase.from('bolig_subscriptions')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', row.organization_id)
            .eq('status', 'active')
          if (!count) await supabase.from('organizations').update({ plan: 'cancelled' }).eq('id', row.organization_id)
        }
        console.log(`[webhook] abonnement ${sub.id} → ${status}`)
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
