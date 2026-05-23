'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateOrgPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setStatus('loading')
    setError('')

    const res = await fetch('/api/org/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Noe gikk galt')
      setStatus('error')
    } else {
      router.push('/dashboard/admin')
    }
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <div className="text-4xl mb-4" style={{ filter: 'grayscale(0.2)' }}>🏢</div>
      <h1
        className="text-xl font-semibold mb-2"
        style={{ color: 'var(--ink)', fontFamily: 'var(--sans)' }}
      >
        Opprett ditt meglerfirma
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
        Gi firmaet et navn for å komme i gang. Du kan deretter invitere meglere.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div>
          <label className="app-label">Firmanavn</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="f.eks. Krogsveen Oslo"
            required
            className="app-input"
          />
        </div>

        {status === 'error' && <div className="app-error">{error}</div>}

        <button
          type="submit"
          disabled={status === 'loading' || !name.trim()}
          className="app-btn-primary w-full"
        >
          {status === 'loading' ? 'Oppretter...' : 'Opprett firma'}
        </button>
      </form>
    </div>
  )
}
