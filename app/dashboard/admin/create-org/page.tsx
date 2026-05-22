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
      <div className="text-4xl mb-4">🏢</div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Opprett ditt meglerfirma</h1>
      <p className="text-sm text-gray-500 mb-8">
        Gi firmaet et navn for å komme i gang. Du kan deretter invitere meglere.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Firmanavn</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="f.eks. Krogsveen Oslo"
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
          disabled={status === 'loading' || !name.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {status === 'loading' ? 'Oppretter...' : 'Opprett firma'}
        </button>
      </form>
    </div>
  )
}
