'use client'

import { useEffect, useState } from 'react'

type Member = {
  id: string
  full_name: string
  email: string
  role: string
  video_count: number
  credits: { used: number; total: number }
}

type OrgCredits = { used: number; total: number }

export default function TeamPage() {
  const [members, setMembers]         = useState<Member[]>([])
  const [orgCredits, setOrgCredits]   = useState<OrgCredits>({ used: 0, total: 0 })
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [removing, setRemoving]       = useState<string | null>(null)

  // Invite form
  const [showInvite, setShowInvite]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [inviteError, setInviteError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/team/members')
      const d   = await res.json()
      if (!res.ok) { setError(d.error || 'Kunne ikke laste team'); return }
      setMembers(d.members ?? [])
      setOrgCredits(d.org_credits ?? { used: 0, total: 0 })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleRemove(memberId: string, name: string) {
    if (!confirm(`Fjerne ${name} fra organisasjonen?`)) return
    setRemoving(memberId)
    try {
      const res = await fetch('/api/team/members', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ memberId }),
      })
      if (res.ok) setMembers(prev => prev.filter(m => m.id !== memberId))
    } finally {
      setRemoving(null)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteStatus('loading')
    setInviteError('')
    const res = await fetch('/api/team/invite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: inviteEmail.trim() }),
    })
    const d = await res.json()
    if (!res.ok) {
      setInviteError(d.error || 'Noe gikk galt')
      setInviteStatus('err')
    } else {
      setInviteStatus('ok')
    }
  }

  const usedPct = orgCredits.total > 0 ? Math.round((orgCredits.used / orgCredits.total) * 100) : 0

  if (loading) return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
      {[1, 2, 3].map(i => <div key={i} style={{ height: '64px', borderRadius: '10px', background: 'var(--line)', opacity: 0.4, marginBottom: '8px' }} />)}
    </div>
  )

  if (error) return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
      <div className="app-error">{error}</div>
    </div>
  )

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '40px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>Team</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {members.length} megler{members.length !== 1 ? 'e' : ''} i organisasjonen
          </p>
        </div>
        <button
          onClick={() => { setShowInvite(v => !v); setInviteStatus('idle'); setInviteEmail('') }}
          className="app-btn-primary"
          style={{ fontSize: '13px', padding: '8px 16px' }}
        >
          + Inviter megler
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="app-card" style={{ padding: '20px 24px' }}>
          {inviteStatus === 'ok' ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <p style={{ fontSize: '24px', marginBottom: '8px' }}>✉️</p>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', marginBottom: '4px' }}>Invitasjon sendt!</p>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>{inviteEmail} vil motta en e-post med lenke for å komme i gang.</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button onClick={() => { setInviteStatus('idle'); setInviteEmail('') }} className="app-btn-secondary" style={{ fontSize: '13px' }}>
                  Inviter en til
                </button>
                <button onClick={() => setShowInvite(false)} className="app-btn-ghost" style={{ fontSize: '13px' }}>
                  Lukk
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  E-postadresse
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="megler@firma.no"
                  required
                  className="app-input"
                  autoFocus
                />
              </div>
              {inviteStatus === 'err' && <div className="app-error">{inviteError}</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" disabled={inviteStatus === 'loading' || !inviteEmail.trim()} className="app-btn-primary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                  {inviteStatus === 'loading' ? 'Sender…' : 'Send invitasjon'}
                </button>
                <button type="button" onClick={() => setShowInvite(false)} className="app-btn-ghost" style={{ fontSize: '13px' }}>
                  Avbryt
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Credit overview */}
      <div className="app-card" style={{ padding: '20px 24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '14px' }}>Kredittbruk denne måneden</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
          <span style={{ color: 'var(--ink)' }}>Videoer brukt</span>
          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
            {orgCredits.used} / {orgCredits.total || '—'}
          </span>
        </div>
        {orgCredits.total > 0 && (
          <div style={{ height: '6px', borderRadius: '99px', overflow: 'hidden', background: 'var(--line)' }}>
            <div style={{
              height: '100%', borderRadius: '99px',
              width: `${usedPct}%`,
              background: usedPct >= 100 ? '#ef4444' : usedPct >= 80 ? '#f59e0b' : 'var(--blue)',
              transition: 'width 0.4s',
            }} />
          </div>
        )}
      </div>

      {/* Member list */}
      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '12px' }}>Meglere</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {members.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--muted)' }}>
              <p style={{ fontSize: '28px', marginBottom: '8px' }}>👥</p>
              <p>Ingen meglere ennå. Inviter den første!</p>
            </div>
          ) : members.map(m => (
            <div
              key={m.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: '10px', padding: '14px 16px',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                background: 'var(--surface-2)', border: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--muted)' }}>
                  {m.full_name[0]?.toUpperCase() ?? '?'}
                </span>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.full_name}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </p>
              </div>

              {/* Videos this month */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{m.video_count}</p>
                <p style={{ fontSize: '11px', color: 'var(--muted)' }}>videoer</p>
              </div>

              {/* Credits */}
              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '52px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: m.credits.used >= m.credits.total && m.credits.total > 0 ? '#ef4444' : 'var(--ink)' }}>
                  {m.credits.used}/{m.credits.total || '—'}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--muted)' }}>kreditter</p>
              </div>

              {/* Role badge */}
              <span className={m.role === 'admin' ? 'app-badge-gold' : 'app-badge-muted'} style={{ flexShrink: 0 }}>
                {m.role === 'admin' ? 'Admin' : 'Megler'}
              </span>

              {/* Remove — only non-admins */}
              {m.role !== 'admin' && (
                <button
                  onClick={() => handleRemove(m.id, m.full_name)}
                  disabled={removing === m.id}
                  className="app-btn-danger"
                  style={{ flexShrink: 0 }}
                >
                  {removing === m.id ? '…' : 'Fjern'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
