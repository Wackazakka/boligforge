'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '499 kr/mnd',
    videos: '3 videoer per måned',
    desc: 'For enkeltmeglere som vil komme i gang',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '999 kr/mnd',
    videos: '10 videoer per måned',
    desc: 'For aktive meglere med høyt volum',
    featured: true,
  },
  {
    id: 'office',
    name: 'Kontor',
    price: '699 kr/megler/mnd',
    videos: '7 videoer per megler',
    desc: 'For hele meglerhuset med quantity-prising',
  },
]

function Logo() {
  return (
    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
      <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#0f0f0f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>R</span>
      <span style={{ fontSize: '15px', fontWeight: 550, color: '#0f0f0f' }}>Reel<span style={{ color: '#737373' }}>Home</span></span>
    </Link>
  )
}

function StepDots({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '40px' }}>
      {[1, 2].map(s => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 600,
            background: s <= current ? '#0f0f0f' : '#f5f5f5',
            color:      s <= current ? '#fff'    : '#a3a3a3',
            transition: 'background 0.2s',
          }}>
            {s < current ? '✓' : s}
          </div>
          {s < 2 && (
            <div style={{ width: '40px', height: '1px', background: current > s ? '#0f0f0f' : '#eaeaea', transition: 'background 0.3s' }} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]           = useState(1)
  const [orgName, setOrgName]     = useState('')
  const [agentCount, setAgentCount] = useState(3)
  const [loading, setLoading]     = useState(false)
  const [activatingPlan, setActivatingPlan] = useState<string | null>(null)
  const [error, setError]         = useState('')

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/onboarding/create-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: orgName }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Noe gikk galt')
    } else {
      setStep(2)
    }
  }

  async function handleSelectPlan(planId: string) {
    setActivatingPlan(planId)
    setError('')

    const res = await fetch('/api/onboarding/activate-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan:     planId,
        quantity: planId === 'office' ? agentCount : 1,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setActivatingPlan(null)
      setError(data.error || 'Noe gikk galt')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
      <div style={{ marginBottom: '48px' }}>
        <Logo />
      </div>

      <StepDots current={step} />

      {/* ── Steg 1: Organisasjonsnavn ── */}
      {step === 1 && (
        <div className="app-card" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f0f0f', marginBottom: '6px' }}>
            Navn på meglerhuset
          </h1>
          <p style={{ fontSize: '14px', color: '#737373', marginBottom: '28px' }}>
            Dette vises på videoer og i kundekommunikasjon.
          </p>

          <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="app-label">Firmanavn</label>
              <input
                type="text"
                required
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="app-input"
                placeholder="Nordvik Eiendom AS"
                autoFocus
              />
            </div>
            {error && <p className="app-error">{error}</p>}
            <button
              type="submit"
              disabled={loading || !orgName.trim()}
              className="app-btn-primary w-full"
            >
              {loading ? 'Oppretter…' : 'Fortsett →'}
            </button>
          </form>
        </div>
      )}

      {/* ── Steg 2: Velg plan ── */}
      {step === 2 && (
        <div style={{ width: '100%', maxWidth: '760px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f0f0f', marginBottom: '6px', textAlign: 'center' }}>
            Velg plan
          </h1>
          <p style={{ fontSize: '14px', color: '#737373', marginBottom: '36px', textAlign: 'center' }}>
            Start gratis i 14 dager — ingen kortinfo nødvendig.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
            {PLANS.map(plan => (
              <div
                key={plan.id}
                className="app-card"
                style={{
                  padding: '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  border: plan.featured ? '2px solid #2563eb' : undefined,
                  position: 'relative',
                }}
              >
                {plan.featured && (
                  <span style={{
                    position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                    background: '#2563eb', color: '#fff', fontSize: '11px', fontWeight: 600,
                    padding: '3px 12px', borderRadius: '99px', whiteSpace: 'nowrap',
                  }}>
                    Mest populær
                  </span>
                )}

                <div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#0f0f0f', marginBottom: '4px' }}>{plan.name}</div>
                  <div style={{ fontSize: '13px', color: '#737373' }}>{plan.desc}</div>
                </div>

                <div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f0f0f', lineHeight: 1.2 }}>{plan.price}</div>
                  <div style={{ fontSize: '13px', color: '#2563eb', fontWeight: 500, marginTop: '4px' }}>{plan.videos}</div>
                </div>

                {plan.id === 'office' && (
                  <div>
                    <label className="app-label">Antall meglere</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={agentCount}
                      onChange={e => setAgentCount(Math.max(1, Number(e.target.value)))}
                      className="app-input"
                      style={{ width: '80px' }}
                    />
                    <p style={{ fontSize: '12px', color: '#a3a3a3', marginTop: '6px' }}>
                      {agentCount * 7} videoer/mnd · {agentCount * 699} kr/mnd
                    </p>
                  </div>
                )}

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={activatingPlan !== null}
                  className={plan.featured ? 'app-btn-primary w-full' : 'app-btn-secondary w-full'}
                  style={{ marginTop: 'auto' }}
                >
                  {activatingPlan === plan.id ? 'Starter prøveperiode…' : 'Start gratis prøveperiode'}
                </button>
              </div>
            ))}
          </div>

          {error && <p className="app-error" style={{ textAlign: 'center' }}>{error}</p>}

          <p style={{ fontSize: '13px', color: '#a3a3a3', textAlign: 'center', marginTop: '16px' }}>
            Kanseller når som helst. Ingen bindingstid.
          </p>
        </div>
      )}
    </div>
  )
}
