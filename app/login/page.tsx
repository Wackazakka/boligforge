'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError('Feil e-post eller passord.')
    } else {
      window.location.href = '/dashboard/profile'
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/dashboard/profile`,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMessage('Sjekk e-posten din for en tilbakestillingslenke.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="app-card w-full max-w-sm" style={{ padding: '32px' }}>
        <div className="mb-8">
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '20px' }}>
            <span style={{ width: '22px', height: '22px', borderRadius: '5px', background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>R</span>
            <span style={{ fontSize: '15px', fontWeight: 550, color: 'var(--ink)', letterSpacing: '-0.015em' }}>
              Reel<span style={{ color: 'var(--muted)' }}>Home</span>
            </span>
          </a>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {mode === 'login' ? 'Logg inn på din konto' : 'Tilbakestill passord'}
          </p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="app-label">E-post</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="app-input"
                placeholder="din@epost.no"
              />
            </div>
            <div>
              <label className="app-label">Passord</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="app-input"
              />
            </div>
            {error && <p className="app-error">{error}</p>}
            <button type="submit" disabled={loading} className="app-btn-primary w-full">
              {loading ? 'Logger inn…' : 'Logg inn'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('reset'); setError('') }}
              className="app-btn-ghost w-full text-xs text-center"
            >
              Glemt passord?
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="app-label">E-post</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="app-input"
                placeholder="din@epost.no"
              />
            </div>
            {error && <p className="app-error">{error}</p>}
            {message && <p className="app-success">{message}</p>}
            <button type="submit" disabled={loading} className="app-btn-primary w-full">
              {loading ? 'Sender…' : 'Send tilbakestillingslenke'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setMessage('') }}
              className="app-btn-ghost w-full text-xs text-center"
            >
              ← Tilbake til innlogging
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
