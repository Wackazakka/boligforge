'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [done, setDone]     = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://reelhome.ai/auth/reset-password',
    })

    setLoading(false)
    if (error) {
      setError('Noe gikk galt. Sjekk at e-postadressen er riktig.')
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
          <p style={{ fontSize: '14px', color: '#737373', lineHeight: 1.6 }}>
            Vi har sendt en tilbakestillingslenke til <strong>{email}</strong>.
            Sjekk spam-mappen om du ikke finner den.
          </p>
          <Link
            href="/auth/login"
            style={{ display: 'inline-block', marginTop: '24px', fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
          >
            ← Tilbake til innlogging
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '24px' }}>
      <div className="app-card" style={{ width: '100%', maxWidth: '380px', padding: '40px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '32px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png?v=1" alt="ReelHome" style={{ height: '48px', width: 'auto' }} />
        </Link>

        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f0f0f', marginBottom: '8px' }}>Glemt passord?</h1>
        <p style={{ fontSize: '14px', color: '#737373', marginBottom: '28px', lineHeight: 1.5 }}>
          Skriv inn e-postadressen din, så sender vi en lenke du kan bruke til å sette nytt passord.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              autoFocus
            />
          </div>
          {error && <p className="app-error">{error}</p>}
          <button type="submit" disabled={loading} className="app-btn-primary w-full" style={{ marginTop: '4px' }}>
            {loading ? 'Sender…' : 'Send tilbakestillingslenke'}
          </button>
        </form>

        <Link
          href="/auth/login"
          style={{ display: 'inline-block', marginTop: '20px', fontSize: '13px', color: '#737373', textDecoration: 'none' }}
        >
          ← Tilbake til innlogging
        </Link>
      </div>
    </div>
  )
}
