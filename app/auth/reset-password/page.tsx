'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [done, setDone]           = useState(false)
  const [ready, setReady]         = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Supabase sender brukeren hit med #access_token i URL-en etter klikk på lenken.
  // onAuthStateChange fanger opp PASSWORD_RECOVERY-hendelsen og logger brukeren inn
  // slik at updateUser() har en aktiv sesjon å jobbe med.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passordene stemmer ikke overens.')
      return
    }
    if (password.length < 8) {
      setError('Passordet må være minst 8 tegn.')
      return
    }
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (error) {
      setError('Noe gikk galt. Prøv å sende en ny tilbakestillingslenke.')
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '24px' }}>
        <div className="app-card" style={{ width: '100%', maxWidth: '380px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0f0f0f', marginBottom: '8px' }}>Passord oppdatert</h2>
          <p style={{ fontSize: '14px', color: '#737373', marginBottom: '24px' }}>
            Du kan nå logge inn med ditt nye passord.
          </p>
          <Link href="/auth/login" className="app-btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Gå til innlogging
          </Link>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '24px' }}>
        <div className="app-card" style={{ width: '100%', maxWidth: '380px', padding: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: '#737373' }}>Verifiserer lenken…</p>
        </div>
      </div>
    )
  }

  const EyeIcon = () => showPw ? (
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
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '24px' }}>
      <div className="app-card" style={{ width: '100%', maxWidth: '380px', padding: '40px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '32px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#0f0f0f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>R</span>
          <span style={{ fontSize: '15px', fontWeight: 550, color: '#0f0f0f' }}>Reel<span style={{ color: '#737373' }}>Home</span></span>
        </Link>

        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f0f0f', marginBottom: '8px' }}>Sett nytt passord</h1>
        <p style={{ fontSize: '14px', color: '#737373', marginBottom: '28px' }}>
          Velg et nytt passord på minst 8 tegn.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="app-label">Nytt passord</label>
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
                autoFocus
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
                <EyeIcon />
              </button>
            </div>
          </div>
          <div>
            <label className="app-label">Bekreft passord</label>
            <input
              type={showPw ? 'text' : 'password'}
              required
              minLength={8}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="app-input"
              placeholder="Gjenta passord"
              autoComplete="new-password"
            />
          </div>
          {error && <p className="app-error">{error}</p>}
          <button type="submit" disabled={loading} className="app-btn-primary w-full" style={{ marginTop: '4px' }}>
            {loading ? 'Oppdaterer…' : 'Lagre nytt passord'}
          </button>
        </form>
      </div>
    </div>
  )
}
