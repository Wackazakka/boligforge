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
        <div className="text-4xl mb-4">✉️</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Invitasjon sendt!</h2>
        <p className="text-sm text-gray-500 mb-6">
          {email} vil motta en e-post med lenke for å komme i gang.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => { setEmail(''); setStatus('idle') }}
            className="text-sm text-blue-600 hover:underline"
          >
            Inviter en til
          </button>
          <span className="text-gray-300">|</span>
          <Link href="/dashboard/admin" className="text-sm text-gray-500 hover:underline">
            Tilbake til oversikt
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <Link href="/dashboard/admin" className="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-block">
        ← Tilbake
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Inviter megler</h1>
      <p className="text-sm text-gray-500 mb-8">
        Megleren mottar en e-post med lenke for å opprette konto og sette opp sin profil.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">E-postadresse</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="megler@firma.no"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'loading' || !email.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {status === 'loading' ? 'Sender...' : 'Send invitasjon'}
        </button>
      </form>
    </div>
  )
}
