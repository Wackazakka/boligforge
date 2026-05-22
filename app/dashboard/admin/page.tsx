'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Member {
  id: string
  user_id: string
  role: string
  created_at: string
  profile: {
    name: string | null
    email: string | null
    portrait_url: string | null
  } | null
}

export default function AdminPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  async function loadMembers() {
    setLoading(true)
    const res = await fetch('/api/org/members')
    if (!res.ok) {
      const d = await res.json()
      setError(d.error || 'Kunne ikke laste meglere')
    } else {
      const d = await res.json()
      setMembers(d.members ?? [])
    }
    setLoading(false)
  }

  async function removeMember(memberId: string) {
    if (!confirm('Er du sikker på at du vil fjerne denne megleren?')) return
    setRemoving(memberId)
    const res = await fetch('/api/org/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    })
    if (res.ok) {
      setMembers(prev => prev.filter(m => m.id !== memberId))
    }
    setRemoving(null)
  }

  useEffect(() => { loadMembers() }, [])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Meglere</h1>
          <p className="text-sm text-gray-500 mt-0.5">{members.length} megler{members.length !== 1 ? 'e' : ''}</p>
        </div>
        <Link
          href="/dashboard/admin/invite"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Inviter megler
        </Link>
      </div>

      <div className="space-y-3">
        {members.map(member => (
          <div
            key={member.id}
            className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg px-4 py-3"
          >
            {member.profile?.portrait_url ? (
              <img
                src={member.profile.portrait_url}
                alt=""
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-gray-400 text-sm font-medium">
                  {member.profile?.name?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {member.profile?.name ?? 'Ikke satt opp ennå'}
              </p>
              <p className="text-xs text-gray-500 truncate">{member.profile?.email ?? '—'}</p>
            </div>

            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              member.role === 'admin'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {member.role === 'admin' ? 'Admin' : 'Megler'}
            </span>

            {member.role !== 'admin' && (
              <button
                onClick={() => removeMember(member.id)}
                disabled={removing === member.id}
                className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-40"
              >
                {removing === member.id ? '...' : 'Fjern'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
