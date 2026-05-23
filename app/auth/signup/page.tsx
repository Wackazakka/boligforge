'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

export default function SignupPage() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)
  const [showPw, setShowPw]     = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '24px' }}>
        <div className="app-card" style={{ width: '100%', maxWidth: '380px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>✉️</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0f0f0f', marginBottom: '8px' }}>Sjekk e-posten din</h2>
          <p style={{ fontSize: '14px', color: '#737373' }}>
            Vi har sendt en bekreftelseslenke til <strong>{email}</strong>.
            Klikk på lenken for å aktivere kontoen.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '24px' }}>
      <div className="app-card" style={{ width: '100%', maxWidth: '380px', padding: '40px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '32px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#0f0f0f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>R</span>
          <span style={{ fontSize: '15px', fontWeight: 550, color: '#0f0f0f' }}>Reel<span style={{ color: '#737373' }}>Home</span></span>
        </Link>

        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f0f0f', marginBottom: '6px' }}>Opprett konto</h1>
        <p style={{ fontSize: '14px', color: '#737373', marginBottom: '4px' }}>
          Kom i gang gratis — ingen kortinfo nødvendig.
        </p>
        <p style={{ fontSize: '13px', color: '#a3a3a3', marginBottom: '24px' }}>
          Har du allerede konto?{' '}
          <Link href="/auth/login" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
            Logg inn
          </Link>
        </p>

        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="app-label">Fullt navn</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="app-input"
              placeholder="Ola Nordmann"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="app-label">E-post</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="app-input"
              placeholder="deg@firma.no"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="app-label">Passord</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="app-input"
                placeholder="Minst 8 tegn"
                autoComplete="new-password"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Skjul passord' : 'Vis passord'}
                style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                  color: '#a3a3a3', display: 'flex', alignItems: 'center',
                }}
              >
                {showPw ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          {error && <p className="app-error">{error}</p>}
          <button type="submit" disabled={loading || !name.trim()} className="app-btn-primary w-full" style={{ marginTop: '4px' }}>
            {loading ? 'Oppretter konto…' : 'Kom i gang'}
          </button>
          <p style={{ fontSize: '12px', color: '#a3a3a3', textAlign: 'center' }}>
            Ved å registrere deg godtar du våre{' '}
            <Link href="/terms" style={{ color: '#737373' }}>vilkår</Link>.
          </p>
        </form>
      </div>
    </div>
  )
}
