'use client'

import { useEffect, useState } from 'react'

const PLANS = ['trial', 'free', 'starter', 'pro', 'office', 'cancelled']

const PLAN_COLOR: Record<string, string> = {
  trial:     '#7c3aed',
  free:      '#737373',
  starter:   '#16a34a',
  pro:       '#2563eb',
  office:    '#d97706',
  cancelled: '#dc2626',
}

type Org = {
  id: string
  name: string
  plan: string
  trial_ends_at: string | null
  created_at: string
  member_count: number
  video_count: number
}

type Stats = {
  totalOrgs: number
  activeTrials: number
  paying: number
  videosLast30: number
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)' }

export default function BackofficePage() {
  const [stats, setStats]       = useState<Stats | null>(null)
  const [orgs, setOrgs]         = useState<Org[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [editingOrg, setEditingOrg] = useState<string | null>(null)
  const [newPlan, setNewPlan]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')

  useEffect(() => {
    fetch('/api/admin/backoffice')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setStats(d.stats)
        setOrgs(d.orgs)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  async function handlePlanChange(orgId: string) {
    if (!newPlan) return
    setSaving(true)
    const res = await fetch('/api/admin/backoffice', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ orgId, plan: newPlan }),
    })
    if (res.ok) {
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, plan: newPlan } : o))
      setEditingOrg(null)
    }
    setSaving(false)
  }

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.plan.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Laster…</p>
  if (error)   return <p style={{ color: '#dc2626', fontSize: '14px' }}>⚠ {error}</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Totalt orgs',        value: stats?.totalOrgs   ?? 0 },
          { label: 'Aktive trials',       value: stats?.activeTrials ?? 0 },
          { label: 'Betalende kunder',    value: stats?.paying      ?? 0 },
          { label: 'Videoer siste 30 d',  value: stats?.videosLast30 ?? 0 },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '20px 24px' }}>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
            <p style={{ fontSize: '36px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Org list */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            Organisasjoner ({filtered.length})
          </h2>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Søk på navn eller plan…"
            style={{
              background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: '8px',
              padding: '8px 12px', color: 'var(--ink)', fontSize: '13px', width: '220px', outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 80px 160px', gap: '8px', padding: '8px 14px', fontSize: '11px', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <span>Navn</span><span>Plan</span><span>Trial</span><span>Meglere</span><span>Videoer</span><span>Plan-endring</span>
          </div>

          {filtered.map(org => {
            const trialLeft = org.trial_ends_at
              ? Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86400000)
              : null
            const editing = editingOrg === org.id

            return (
              <div
                key={org.id}
                style={{
                  ...card,
                  display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 80px 160px',
                  gap: '8px', alignItems: 'center',
                  borderRadius: '8px', padding: '12px 14px',
                  fontSize: '13px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</p>
                  <p style={{ color: 'var(--muted-2)', fontSize: '11px' }}>{org.id.slice(0, 8)}…</p>
                </div>

                <span style={{
                  display: 'inline-block', fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                  borderRadius: '99px', background: (PLAN_COLOR[org.plan] ?? '#737373') + '1a',
                  color: PLAN_COLOR[org.plan] ?? '#737373', whiteSpace: 'nowrap',
                }}>
                  {org.plan}
                </span>

                <span style={{ fontSize: '12px', color: trialLeft !== null && trialLeft > 0 ? '#7c3aed' : 'var(--muted-2)' }}>
                  {trialLeft !== null && trialLeft > 0 ? `${trialLeft}d igjen` : trialLeft !== null && trialLeft <= 0 ? 'Utløpt' : '—'}
                </span>

                <span style={{ color: 'var(--ink-3)' }}>{org.member_count}</span>
                <span style={{ color: 'var(--ink-3)' }}>{org.video_count}</span>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {editing ? (
                    <>
                      <select
                        value={newPlan}
                        onChange={e => setNewPlan(e.target.value)}
                        style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', color: 'var(--ink)', borderRadius: '6px', padding: '4px 6px', fontSize: '12px', flex: 1 }}
                      >
                        <option value="">Velg…</option>
                        {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <button
                        onClick={() => handlePlanChange(org.id)}
                        disabled={saving || !newPlan}
                        style={{ fontSize: '11px', padding: '4px 10px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}
                      >
                        {saving ? '…' : 'OK'}
                      </button>
                      <button
                        onClick={() => setEditingOrg(null)}
                        style={{ fontSize: '11px', padding: '4px 8px', background: 'none', color: 'var(--muted)', border: '1px solid var(--line-2)', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setEditingOrg(org.id); setNewPlan(org.plan) }}
                      style={{ fontSize: '11px', padding: '4px 10px', background: 'none', color: 'var(--ink-3)', border: '1px solid var(--line-2)', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Endre plan
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <p style={{ color: 'var(--muted-2)', fontSize: '13px', padding: '24px', textAlign: 'center' }}>Ingen treff</p>
          )}
        </div>
      </div>
    </div>
  )
}
