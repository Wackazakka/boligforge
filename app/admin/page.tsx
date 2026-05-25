'use client'

import { useEffect, useState } from 'react'

const PLANS = ['trial', 'free', 'starter', 'pro', 'office', 'cancelled']

const PLAN_COLOR: Record<string, string> = {
  trial:     '#a78bfa',
  free:      '#6b7280',
  starter:   '#34d399',
  pro:       '#60a5fa',
  office:    '#f59e0b',
  cancelled: '#f87171',
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

  if (loading) return <p style={{ color: '#666', fontSize: '14px' }}>Laster…</p>
  if (error)   return <p style={{ color: '#f87171', fontSize: '14px' }}>⚠ {error}</p>

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
          <div key={s.label} style={{ background: '#1a1a1c', border: '1px solid #2a2a2c', borderRadius: '10px', padding: '20px 24px' }}>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
            <p style={{ fontSize: '36px', fontWeight: 700, color: '#f0f0f0', lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Org list */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#f0f0f0', margin: 0 }}>
            Organisasjoner ({filtered.length})
          </h2>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Søk på navn eller plan…"
            style={{
              background: '#1a1a1c', border: '1px solid #333', borderRadius: '8px',
              padding: '8px 12px', color: '#f0f0f0', fontSize: '13px', width: '220px', outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 80px 160px', gap: '8px', padding: '8px 14px', fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
                  display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 80px 160px',
                  gap: '8px', alignItems: 'center',
                  background: '#1a1a1c', border: '1px solid #2a2a2c',
                  borderRadius: '8px', padding: '12px 14px',
                  fontSize: '13px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: '#f0f0f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</p>
                  <p style={{ color: '#555', fontSize: '11px' }}>{org.id.slice(0, 8)}…</p>
                </div>

                <span style={{
                  display: 'inline-block', fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                  borderRadius: '99px', background: PLAN_COLOR[org.plan] + '22',
                  color: PLAN_COLOR[org.plan] ?? '#888', whiteSpace: 'nowrap',
                }}>
                  {org.plan}
                </span>

                <span style={{ fontSize: '12px', color: trialLeft !== null && trialLeft > 0 ? '#a78bfa' : '#555' }}>
                  {trialLeft !== null && trialLeft > 0 ? `${trialLeft}d igjen` : trialLeft !== null && trialLeft <= 0 ? 'Utløpt' : '—'}
                </span>

                <span style={{ color: '#888' }}>{org.member_count}</span>
                <span style={{ color: '#888' }}>{org.video_count}</span>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {editing ? (
                    <>
                      <select
                        value={newPlan}
                        onChange={e => setNewPlan(e.target.value)}
                        style={{ background: '#111', border: '1px solid #333', color: '#f0f0f0', borderRadius: '6px', padding: '4px 6px', fontSize: '12px', flex: 1 }}
                      >
                        <option value="">Velg…</option>
                        {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <button
                        onClick={() => handlePlanChange(org.id)}
                        disabled={saving || !newPlan}
                        style={{ fontSize: '11px', padding: '4px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}
                      >
                        {saving ? '…' : 'OK'}
                      </button>
                      <button
                        onClick={() => setEditingOrg(null)}
                        style={{ fontSize: '11px', padding: '4px 8px', background: 'none', color: '#555', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setEditingOrg(org.id); setNewPlan(org.plan) }}
                      style={{ fontSize: '11px', padding: '4px 10px', background: 'none', color: '#666', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Endre plan
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <p style={{ color: '#555', fontSize: '13px', padding: '24px', textAlign: 'center' }}>Ingen treff</p>
          )}
        </div>
      </div>
    </div>
  )
}
