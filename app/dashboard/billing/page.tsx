'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AccountTabs from '../profile/AccountTabs'

interface Credits {
  plan: string
  used_this_month: number
  included_per_month: number
  extra_credits: number
  available: number
  extra_credit_price_nok: number
  reset_at: string
}

const PLANS = [
  {
    id:       'starter',
    name:     'Starter',
    price:    '2 090 kr/mnd',
    videos:   '3 videoer per måned',
    desc:     'For enkeltmeglere som vil komme i gang',
  },
  {
    id:       'pro',
    name:     'Pro',
    price:    '3 990 kr/mnd',
    videos:   '10 videoer per måned',
    desc:     'For aktive meglere med høyt volum',
    featured: true,
  },
  {
    id:       'office',
    name:     'Kontor',
    price:    '1 990 kr/megler/mnd',
    videos:   '7 videoer per megler',
    desc:     'For hele meglerhuset med quantity-prising',
  },
]

const PLAN_LABELS: Record<string, { label: string; price: string }> = {
  starter: { label: 'Starter',       price: 'kr 2 090/mnd' },
  pro:     { label: 'Pro',           price: 'kr 3 990/mnd' },
  office:  { label: 'Kontor',        price: 'kr 1 990/mnd per megler' },
  trial:   { label: 'Prøveperiode',  price: '14 dager gratis' },
  free:    { label: 'Prøveperiode',  price: '14 dager gratis' },
}

// Plan-spesifikke topup-pakker (fast antall, fast pris)
const TOPUP_PACKAGES: Record<string, { qty: number; pricePerUnit: number; total: number }> = {
  starter: { qty: 1, pricePerUnit: 989, total: 989 },
  pro:     { qty: 1, pricePerUnit: 989, total: 989 },
  office:  { qty: 1, pricePerUnit: 989, total: 989 },
  trial:   { qty: 1, pricePerUnit: 989, total: 989 },
  free:    { qty: 1, pricePerUnit: 989, total: 989 },
}

export default function BillingPage() {
  const [credits,        setCredits]        = useState<Credits | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [checkoutPlan,   setCheckoutPlan]   = useState<string | null>(null)
  const [agentCount,     setAgentCount]     = useState(3)
  const [checkoutError,  setCheckoutError]  = useState('')
  const [buyingCredits,  setBuyingCredits]  = useState(false)
  const [buyError,       setBuyError]       = useState('')

  useEffect(() => {
    fetch('/api/video/credits')
      .then(r => r.json())
      .then(d => { setCredits(d); setCreditsLoading(false) })
      .catch(() => setCreditsLoading(false))
  }, [])

  async function handleSelectPlan(planId: string) {
    setCheckoutPlan(planId)
    setCheckoutError('')

    const res = await fetch('/api/stripe/checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        plan:     planId,
        quantity: planId === 'office' ? agentCount : 1,
      }),
    })
    const data = await res.json()

    if (!res.ok || !data.url) {
      setCheckoutPlan(null)
      setCheckoutError(data.error || 'Kunne ikke starte betaling')
    } else {
      window.location.href = data.url
    }
  }

  async function handleBuyCredits() {
    setBuyingCredits(true)
    setBuyError('')
    const res = await fetch('/api/stripe/buy-credits', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),   // qty determined server-side by plan
    })
    const data = await res.json()
    if (!res.ok || !data.url) {
      setBuyingCredits(false)
      setBuyError(data.error || 'Kunne ikke starte betaling')
    } else {
      window.location.href = data.url
    }
  }

  const planInfo   = credits ? (PLAN_LABELS[credits.plan] ?? PLAN_LABELS.trial) : null
  const usedPct    = credits ? Math.min(100, Math.round((credits.used_this_month / credits.included_per_month) * 100)) : 0
  const resetDate  = credits ? new Date(credits.reset_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' }) : ''
  const progressColor = usedPct >= 100 ? '#c84b4b' : usedPct >= 80 ? '#c87f30' : 'var(--blue)'

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
      <AccountTabs />

      {/* ── Plan selection ── */}
      <div style={{ marginBottom: '48px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
          Velg plan
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '28px' }}>
          Første betaling trekkes når prøveperioden utløper. Kanseller når som helst.
        </p>

        <div className="billing-plans-grid">
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className="app-card"
              style={{
                padding:  '24px',
                display:  'flex',
                flexDirection: 'column',
                gap:      '14px',
                border:   plan.featured ? '2px solid #2563eb' : undefined,
                position: 'relative',
              }}
            >
              {plan.featured && (
                <span style={{
                  position:  'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                  background: '#2563eb', color: '#fff', fontSize: '11px', fontWeight: 600,
                  padding:   '3px 12px', borderRadius: '99px', whiteSpace: 'nowrap',
                }}>
                  Anbefalt
                </span>
              )}

              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '3px' }}>{plan.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{plan.desc}</div>
              </div>

              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>{plan.price}</div>
                <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 500, marginTop: '3px' }}>{plan.videos}</div>
              </div>

              {plan.id === 'office' && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                    Antall meglere
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={agentCount}
                    onChange={e => setAgentCount(Math.max(1, Number(e.target.value)))}
                    className="app-input"
                    style={{ width: '72px' }}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                    {agentCount * 7} videoer/mnd · {agentCount * 699} kr/mnd
                  </p>
                </div>
              )}

              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={checkoutPlan !== null}
                className={plan.featured ? 'app-btn-primary w-full' : 'app-btn-secondary w-full'}
                style={{ marginTop: 'auto' }}
              >
                {checkoutPlan === plan.id ? 'Venter…' : 'Velg'}
              </button>
            </div>
          ))}
        </div>

        {checkoutError && (
          <p className="app-error" style={{ textAlign: 'center', marginTop: '12px' }}>{checkoutError}</p>
        )}
      </div>

      {/* ── Current usage ── */}
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: '40px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '20px' }}>
          Nåværende bruk
        </h2>

        {creditsLoading ? (
          <div style={{ height: '120px', borderRadius: '12px', background: 'var(--line)', opacity: 0.4 }} />
        ) : !credits ? (
          <p className="app-error">Kunne ikke laste faktureringsinformasjon.</p>
        ) : (
          <>
            <div className="app-card" style={{ padding: '24px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, background: '#fef9c3', color: '#854d0e', padding: '2px 10px', borderRadius: '99px' }}>
                    {planInfo?.label}
                  </span>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>{planInfo?.price}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '11px', color: 'var(--muted)' }}>Nullstilles</p>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{resetDate}</p>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--ink)' }}>Videoer brukt denne måneden</span>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                    {credits.used_this_month} / {credits.included_per_month}
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: '99px', overflow: 'hidden', background: 'var(--line)' }}>
                  <div style={{ height: '100%', borderRadius: '99px', width: `${usedPct}%`, background: progressColor, transition: 'width 0.4s' }} />
                </div>
                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
                  {credits.available > 0
                    ? `${credits.available} video${credits.available !== 1 ? 'er' : ''} igjen`
                    : 'Ingen videoer igjen denne måneden'}
                </p>
              </div>
            </div>

            {/* ── Kjøp ekstra videoer ── */}
            {(() => {
              const plan = credits?.plan ?? 'starter'
              const pkg  = TOPUP_PACKAGES[plan] ?? TOPUP_PACKAGES.starter
              return (
                <div className="app-card" id="extra-credits" style={{ padding: '24px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
                    Kjøp enkeltvideo
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
                    Engangskjøp — kreditten utløper ikke og brukes opp før månedlige kreditter.
                  </p>

                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: '16px',
                    padding: '16px 20px', borderRadius: '10px',
                    border: '2px solid var(--line)', background: 'var(--surface)',
                  }}>
                    <div>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink)' }}>
                        1 video
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                        {pkg.pricePerUnit} kr — engangskjøp
                      </div>
                    </div>

                    <button
                      onClick={handleBuyCredits}
                      disabled={buyingCredits}
                      className="app-btn-primary"
                    >
                      {buyingCredits ? 'Venter…' : `Kjøp for ${pkg.total} kr`}
                    </button>
                  </div>

                  {buyError && (
                    <p className="app-error" style={{ marginTop: '10px' }}>{buyError}</p>
                  )}
                </div>
              )
            })()}

            <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
              Spørsmål?{' '}
              <a href="mailto:hei@reelhome.no" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                hei@reelhome.no
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
