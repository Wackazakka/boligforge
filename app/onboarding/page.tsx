'use client'

import { useState } from 'react'
import Link from 'next/link'

function Logo() {
  return (
    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
      <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#0f0f0f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>R</span>
      <span style={{ fontSize: '15px', fontWeight: 550, color: '#0f0f0f' }}>Reel<span style={{ color: '#737373' }}>Home</span></span>
    </Link>
  )
}

export default function OnboardingPage() {
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res  = await fetch('/api/onboarding/create-org', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: orgName }),
    })
    const data = await res.json()

    if (!res.ok) {
      setLoading(false)
      setError(data.error || 'Noe gikk galt')
      return
    }

    // Hard navigasjon — bypasser Next.js RSC router-cache
    // slik at dashboard alltid leser fersk profil fra databasen
    window.location.href = '/dashboard'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
      <div style={{ marginBottom: '48px' }}>
        <Logo />
      </div>

      <div className="app-card" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f0f0f', marginBottom: '6px' }}>
          Navn på meglerhuset
        </h1>
        <p style={{ fontSize: '14px', color: '#737373', marginBottom: '28px' }}>
          Dette vises på videoer og i kundekommunikasjon.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
            {loading ? 'Starter…' : 'Start gratis prøveperiode →'}
          </button>
        </form>

        <p style={{ fontSize: '12px', color: '#a3a3a3', textAlign: 'center', marginTop: '20px' }}>
          14 dager gratis · Ingen kortinfo nødvendig · Kanseller når som helst
        </p>
      </div>
    </div>
  )
}
