'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

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
      window.location.href = '/dashboard'
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '24px' }}>
      <div className="app-card" style={{ width: '100%', maxWidth: '380px', padding: '40px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '32px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#0f0f0f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>R</span>
          <span style={{ fontSize: '15px', fontWeight: 550, color: '#0f0f0f' }}>Reel<span style={{ color: '#737373' }}>Home</span></span>
        </Link>

        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f0f0f', marginBottom: '6px' }}>Logg inn</h1>
        <p style={{ fontSize: '14px', color: '#737373', marginBottom: '28px' }}>
          Ny bruker?{' '}
          <Link href="/auth/signup" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
            Opprett konto
          </Link>
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="app-input"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="app-error">{error}</p>}
          <button type="submit" disabled={loading} className="app-btn-primary w-full" style={{ marginTop: '4px' }}>
            {loading ? 'Logger inn…' : 'Logg inn'}
          </button>
        </form>
      </div>
    </div>
  )
}
