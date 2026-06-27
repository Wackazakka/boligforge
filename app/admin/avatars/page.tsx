'use client'

// Superadmin: bla i alle LiveAvatar-avatarer med forhåndsvisning, klikk for å sette
// demo-avataren. Bilder med ensfarget grønn/blå bakgrunn er greenscreen-varianter.

import { useEffect, useState } from 'react'

type Avatar = { id: string; name: string; preview_url: string }

export default function AvatarsPage() {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [setting, setSetting] = useState<string | null>(null)

  function load() {
    fetch('/api/admin/avatars').then(r => r.json()).then(d => {
      if (d.error) { setError(d.error); return }
      setAvatars(d.avatars || []); setCurrent(d.current || null)
    }).catch(e => setError(String(e))).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function use(id: string) {
    setSetting(id)
    try {
      const r = await fetch('/api/admin/avatars', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar_id: id }),
      })
      const d = await r.json()
      if (r.ok) setCurrent(d.current)
    } finally { setSetting(null) }
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Laster avatarer…</p>
  if (error) return <p style={{ color: '#dc2626' }}>{error} {error.includes('tilgang') && '— logg inn som superadmin.'}</p>

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Avatarer ({avatars.length})</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 18 }}>
        Klikk «Bruk som demo» for å sette avataren på digital-visning-demoen. Avatarer med ensfarget grønn/blå bakgrunn er ment for kompositering — velg heller en med ekte bakgrunn (kontor o.l.).
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
        {avatars.map(a => {
          const active = a.id === current
          return (
            <div key={a.id} style={{ border: active ? '2px solid var(--blue)' : '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.preview_url} alt={a.name} loading="lazy"
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', background: 'var(--surface-2)' }} />
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{a.name}</div>
                <button onClick={() => use(a.id)} disabled={active || setting === a.id}
                  style={{
                    marginTop: 6, width: '100%', padding: '6px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: active ? 'default' : 'pointer',
                    border: 'none', color: '#fff', background: active ? '#16a34a' : 'var(--blue, #2563eb)', opacity: setting === a.id ? 0.6 : 1,
                  }}>
                  {active ? '✓ Aktiv demo' : setting === a.id ? 'Setter…' : 'Bruk som demo'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
