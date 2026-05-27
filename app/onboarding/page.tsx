'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { createOrgAction, createSoloOrgAction } from './actions'

function Logo() {
  return (
    <Link href="/" className="rh-lockup" style={{ textDecoration: 'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand-kit/reelhome-mark.svg" alt="" width="36" height="36" />
      <span className="rh-wm" style={{ fontSize: '24px' }}>ReelHome<span className="rh-ai">.ai</span></span>
    </Link>
  )
}

type AccountType = 'solo' | 'team_admin' | null

export default function OnboardingPage() {
  const [accountType, setAccountType] = useState<AccountType>(null)
  const [orgError,  orgFormAction,  orgPending]  = useActionState(createOrgAction, null)
  const [soloError, soloFormAction, soloPending] = useActionState(createSoloOrgAction, null)

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
      <div style={{ marginBottom: '48px' }}>
        <Logo />
      </div>

      {/* Step 1 — role selection */}
      {accountType === null && (
        <div className="app-card" style={{ width: '100%', maxWidth: '480px', padding: '40px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f0f0f', marginBottom: '8px' }}>
            Hvordan bruker du ReelHome?
          </h1>
          <p style={{ fontSize: '14px', color: '#737373', marginBottom: '28px' }}>
            Vi tilpasser opplevelsen basert på din situasjon.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => setAccountType('solo')}
              style={{
                textAlign: 'left',
                padding: '20px',
                cursor: 'pointer',
                border: '1.5px solid #e5e5e5',
                borderRadius: '10px',
                background: '#fff',
                width: '100%',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '15px', color: '#0f0f0f', marginBottom: '4px' }}>
                Jeg jobber alene
              </div>
              <div style={{ fontSize: '13px', color: '#737373' }}>
                Frittstående megler — ingen team eller kontorsystem.
              </div>
            </button>

            <button
              onClick={() => setAccountType('team_admin')}
              style={{
                textAlign: 'left',
                padding: '20px',
                cursor: 'pointer',
                border: '1.5px solid #e5e5e5',
                borderRadius: '10px',
                background: '#fff',
                width: '100%',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '15px', color: '#0f0f0f', marginBottom: '4px' }}>
                Jeg representerer et meglerhus
              </div>
              <div style={{ fontSize: '13px', color: '#737373' }}>
                Konto for hele kontoret — inviter kollegaer etterpå.
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Step 2a — solo: no org name needed, just confirm */}
      {accountType === 'solo' && (
        <div className="app-card" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
          <button
            onClick={() => setAccountType(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#737373', marginBottom: '20px', padding: 0 }}
          >
            &larr; Tilbake
          </button>

          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f0f0f', marginBottom: '6px' }}>
            Kom i gang som solist
          </h1>
          <p style={{ fontSize: '14px', color: '#737373', marginBottom: '28px' }}>
            Vi oppretter din personlige konto. Du kan legge til et firmanavn senere.
          </p>

          <form action={soloFormAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {soloError && <p className="app-error">{soloError}</p>}

            <button
              type="submit"
              disabled={soloPending}
              className="app-btn-primary w-full"
            >
              {soloPending ? 'Starter…' : 'Start gratis prøveperiode →'}
            </button>
          </form>

          <p style={{ fontSize: '12px', color: '#a3a3a3', textAlign: 'center', marginTop: '20px' }}>
            14 dager gratis · Ingen kortinfo nødvendig · Kanseller når som helst
          </p>
        </div>
      )}

      {/* Step 2b — team admin: enter org name */}
      {accountType === 'team_admin' && (
        <div className="app-card" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
          <button
            onClick={() => setAccountType(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#737373', marginBottom: '20px', padding: 0 }}
          >
            &larr; Tilbake
          </button>

          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f0f0f', marginBottom: '6px' }}>
            Navn på meglerhuset
          </h1>
          <p style={{ fontSize: '14px', color: '#737373', marginBottom: '28px' }}>
            Dette vises på videoer og i kundekommunikasjon.
          </p>

          <form action={orgFormAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input type="hidden" name="accountType" value="team_admin" />

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

            {orgError && <p className="app-error">{orgError}</p>}

            <button
              type="submit"
              disabled={orgPending}
              className="app-btn-primary w-full"
            >
              {orgPending ? 'Starter…' : 'Start gratis prøveperiode →'}
            </button>
          </form>

          <p style={{ fontSize: '12px', color: '#a3a3a3', textAlign: 'center', marginTop: '20px' }}>
            14 dager gratis · Ingen kortinfo nødvendig · Kanseller når som helst
          </p>
        </div>
      )}
    </div>
  )
}
