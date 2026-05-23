'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function InvitePage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setError('')

    const res = await fetch('/api/org/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Noe gikk galt')
      setStatus('error')
    } else {
      setStatus('success')
    }
  }

  if (status === 'success') {
    return (
      <div className="max-w-md mx-auto px-6 py-12 text-center">
        <div className="text-4xl mb-4" style={{ filter: 'grayscale(0.3)' }}>✉️</div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
          Invitasjon sendt!
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          {email} vil motta en e-post med lenke for å komme i gang.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => { setEmail(''); setStatus('idle') }}
            className="text-sm"
            style={{ color: 'var(--gold)' }}
          >
            Inviter en til
          </button>
          <span style={{ color: 'var(--line-2)' }}>|</span>
          <Link href="/dashboard/admin" className="text-sm" style={{ color: 'var(--muted)' }}>
            Tilbake til oversikt
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <Link href="/dashboard/admin" className="app-btn-ghost inline-block mb-6 text-sm px-0">
        ← Tilbake
      </Link>
      <h1
        className="text-xl font-semibold mb-1"
        style={{ color: 'var(--ink)', fontFamily: 'var(--sans)' }}
      >
        Inviter megler
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
        Megleren mottar en e-post med lenke for å opprette konto og sette opp sin profil.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="app-label">E-postadresse</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="megler@firma.no"
            required
            className="app-input"
          />
        </div>

        {status === 'error' && <div className="app-error">{error}</div>}

        <button
          type="submit"
          disabled={status === 'loading' || !email.trim()}
          className="app-btn-primary w-full"
        >
          {status === 'loading' ? 'Sender...' : 'Send invitasjon'}
        </button>
      </form>
    </div>
  )
}
