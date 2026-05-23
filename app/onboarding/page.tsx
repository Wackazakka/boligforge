'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createOrgAction } from './actions'

function Logo() {
  return (
    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
      <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#0f0f0f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>R</span>
      <span style={{ fontSize: '15px', fontWeight: 550, color: '#0f0f0f' }}>Reel<span style={{ color: '#737373' }}>Home</span></span>
    </Link>
  )
}

export default function OnboardingPage() {
  const [error, formAction, isPending] = useActionState(createOrgAction, null)

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

        <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="app-label" htmlFor="orgName">Firmanavn</label>
            <input
              id="orgName"
              name="orgName"
              type="text"
              required
              className="app-input"
              placeholder="Nordvik Eiendom AS"
              autoFocus
            />
          </div>

          {error && <p className="app-error">{error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="app-btn-primary w-full"
          >
            {isPending ? 'Starter…' : 'Start gratis prøveperiode →'}
          </button>
        </form>

        <p style={{ fontSize: '12px', color: '#a3a3a3', textAlign: 'center', marginTop: '20px' }}>
          14 dager gratis · Ingen kortinfo nødvendig · Kanseller når som helst
        </p>
      </div>
    </div>
  )
}
