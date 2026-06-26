'use client'

// Superadmin: video-avatar-kø. Se meglere som venter på avatar-opprettelse, last
// ned opptaket, lag avataren i LiveAvatar-dashbordet, og koble avatar_id → ferdig.

import { useEffect, useState } from 'react'

type Entry = {
  user_id: string
  name: string | null
  email: string | null
  videoUrl: string | null
  hasVoice: boolean
  avatar_id: string | null
  uploaded_at: string | null
  consent: { consented_at?: string; name?: string } | null
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 18, marginBottom: 14 }

export default function AvatarQueuePage() {
  const [pending, setPending] = useState<Entry[]>([])
  const [done, setDone] = useState<Entry[]>([])
  const [avatars, setAvatars] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/admin/avatar-queue')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Feil')
      setPending(d.pending || []); setDone(d.done || [])
      fetch('/api/admin/avatar-queue?avatars=1').then(x => x.json()).then(x => setAvatars(x.avatars || [])).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function connect(user_id: string) {
    const avatar_id = (inputs[user_id] || '').trim()
    if (!avatar_id) return
    setSaving(user_id)
    try {
      const r = await fetch('/api/admin/avatar-queue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id, avatar_id }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Feil')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setSaving(null) }
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Laster kø…</p>
  if (error) return <p style={{ color: '#dc2626' }}>{error} {error.includes('tilgang') && '— logg inn som superadmin.'}</p>

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Video-avatar-kø</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Last ned opptaket → lag avataren i <a href="https://app.liveavatar.com" target="_blank" rel="noreferrer">LiveAvatar-dashbordet</a> → lim inn / velg avatar_id → koble. Da blir meglerens avatar aktiv.
      </p>

      <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 10 }}>
        Venter ({pending.length})
      </h2>
      {pending.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>Ingen i kø. 🎉</p>}
      {pending.map(e => (
        <div key={e.user_id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{e.name || '(uten navn)'}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{e.email} · {e.user_id.slice(0, 8)}…</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Stemme: {e.hasVoice ? '✅ klonet + bundet' : '⚠️ ingen klonet stemme'}
                {e.consent?.consented_at && <> · Samtykke: {new Date(e.consent.consented_at).toLocaleDateString('no')}</>}
              </div>
            </div>
            {e.videoUrl && (
              <a href={e.videoUrl} target="_blank" rel="noreferrer"
                style={{ alignSelf: 'flex-start', background: 'var(--blue)', color: '#fff', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                ⬇ Last ned opptak
              </a>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {avatars.length > 0 && (
              <select onChange={ev => setInputs(p => ({ ...p, [e.user_id]: ev.target.value }))}
                value={inputs[e.user_id] || ''} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13 }}>
                <option value="">Velg avatar…</option>
                {avatars.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id.slice(0, 8)}…)</option>)}
              </select>
            )}
            <input placeholder="eller lim inn avatar_id"
              value={inputs[e.user_id] || ''} onChange={ev => setInputs(p => ({ ...p, [e.user_id]: ev.target.value }))}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', fontSize: 13, minWidth: 220 }} />
            <button onClick={() => connect(e.user_id)} disabled={saving === e.user_id || !(inputs[e.user_id] || '').trim()}
              style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (inputs[e.user_id] || '').trim() ? 1 : 0.5 }}>
              {saving === e.user_id ? 'Kobler…' : 'Koble → aktiver'}
            </button>
          </div>
        </div>
      ))}

      <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', margin: '28px 0 10px' }}>
        Aktive ({done.length})
      </h2>
      {done.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Ingen ennå.</p>}
      {done.map(e => (
        <div key={e.user_id} style={{ ...card, marginBottom: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 14 }}><strong>{e.name || e.email}</strong> · <span style={{ color: 'var(--muted)', fontSize: 12 }}>avatar {String(e.avatar_id).slice(0, 10)}…</span></span>
            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✅ aktiv {e.hasVoice ? '· klonet stemme' : ''}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
