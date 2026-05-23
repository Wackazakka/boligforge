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
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="app-error">{error}</div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{ color: 'var(--ink)', fontFamily: 'var(--sans)' }}
          >
            Meglere
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            {members.length} megler{members.length !== 1 ? 'e' : ''}
          </p>
        </div>
        <Link href="/dashboard/admin/invite" className="app-btn-primary" style={{ padding: '8px 16px', fontSize: '13px', textDecoration: 'none', display: 'inline-block' }}>
          + Inviter megler
        </Link>
      </div>

      <div className="space-y-2">
        {members.map(member => (
          <div
            key={member.id}
            className="flex items-center gap-4"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: '10px',
              padding: '12px 16px',
            }}
          >
            {member.profile?.portrait_url ? (
              <img
                src={member.profile.portrait_url}
                alt=""
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                style={{ border: '1px solid var(--line-2)' }}
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                  {member.profile?.name?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
                {member.profile?.name ?? 'Ikke satt opp ennå'}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                {member.profile?.email ?? '—'}
              </p>
            </div>

            <span className={member.role === 'admin' ? 'app-badge-gold' : 'app-badge-muted'}>
              {member.role === 'admin' ? 'Admin' : 'Megler'}
            </span>

            {member.role !== 'admin' && (
              <button
                onClick={() => removeMember(member.id)}
                disabled={removing === member.id}
                className="app-btn-danger"
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
