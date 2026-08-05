'use client'

// Kjede-dashbord: nasjonal kjedeleder ser kontorene sine med nøkkeltall og
// oppretter nye kontorer (inviterer kontorsjef). Mønster: team/page.tsx
// (skall/lasting/rader) + admin/page.tsx (stat-kort).

import { useEffect, useState } from 'react'

type Office = {
  id: string
  name: string
  plan: string
  members: number
  videos: number
  creditsUsed: number
  creditsTotal: number
}

type ChainData = {
  chainName: string
  offices: Office[]
  totals: { offices: number; members: number; videos: number; creditsUsed: number; creditsTotal: number }
}

const nb = (n: number) => n.toLocaleString('nb-NO')

export default function KjedePage() {
  const [data, setData] = useState<ChainData | null>(null)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [officeName, setOfficeName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [message, setMessage] = useState('')

  async function load() {
    try {
      const res = await fetch('/api/chain')
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Kunne ikke hente kjedeoversikten'); return }
      setData(d)
    } catch {
      setError('Kunne ikke hente kjedeoversikten')
    }
  }

  useEffect(() => { load() }, [])

  async function createOffice(e: React.FormEvent) {
    e.preventDefault()
    if (!officeName.trim() || !adminEmail.trim() || status === 'loading') return
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch('/api/chain/offices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: officeName.trim(), adminEmail: adminEmail.trim() }),
      })
      const d = await res.json()
      if (!res.ok) { setStatus('err'); setMessage(d.error || 'Noe gikk galt'); return }
      setStatus('ok')
      setMessage(`Kontoret «${d.officeName}» er opprettet — invitasjon sendt til ${adminEmail.trim()}.`)
      setOfficeName('')
      setAdminEmail('')
      load()
    } catch {
      setStatus('err')
      setMessage('Noe gikk galt — prøv igjen')
    }
  }

  if (error) {
    return (
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
        <div className="app-error">{error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ height: '64px', borderRadius: '10px', background: 'var(--line)', opacity: 0.4 }} />
        ))}
      </div>
    )
  }

  const { totals } = data
  const stats = [
    { label: 'Kontorer', value: nb(totals.offices) },
    { label: 'Meglere', value: nb(totals.members) },
    { label: 'Videoer', value: nb(totals.videos) },
    { label: 'Kreditter brukt', value: `${nb(totals.creditsUsed)} av ${nb(totals.creditsTotal)}` },
  ]

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Topp */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>Kjede{data.chainName ? ` — ${data.chainName}` : ''}</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            Samlet oversikt over kontorene i kjeden. Hver kontorsjef styrer sitt eget team.
          </p>
        </div>
        <button
          className="app-btn-primary"
          style={{ fontSize: '13px', padding: '8px 16px' }}
          onClick={() => setShowForm(s => !s)}
        >
          {showForm ? 'Lukk' : '+ Opprett kontor'}
        </button>
      </div>

      {/* Opprett kontor */}
      {showForm && (
        <form onSubmit={createOffice} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label className="app-label" htmlFor="officeName">Kontornavn</label>
            <input id="officeName" className="app-input" value={officeName}
              onChange={e => setOfficeName(e.target.value)} placeholder="F.eks. Oslo-kontoret" />
          </div>
          <div>
            <label className="app-label" htmlFor="adminEmail">Kontorsjefens e-post</label>
            <input id="adminEmail" className="app-input" type="email" value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)} placeholder="sjef@meglerhuset.no" />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Kontorsjefen får en invitasjon på e-post, blir admin for kontoret og kan invitere sine meglere fra Team-siden.
          </p>
          <button type="submit" className="app-btn-primary" disabled={status === 'loading'} style={{ alignSelf: 'flex-start', fontSize: '13px', padding: '8px 16px' }}>
            {status === 'loading' ? 'Oppretter…' : 'Opprett kontor og send invitasjon'}
          </button>
        </form>
      )}
      {message && (
        <div className={status === 'ok' ? 'app-success' : 'app-error'}>{message}</div>
      )}

      {/* Stat-kort */}
      {data.offices.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '16px 20px' }}>
              <p style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
              <p style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, marginTop: '4px' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Kontorliste */}
      {data.offices.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>Ingen kontorer ennå</p>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.6 }}>
            Opprett kjedens første kontor og inviter kontorsjefen. Sjefen setter opp sitt eget team,
            mens du beholder samlet oversikt her.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.offices.map(o => {
            const pct = o.creditsTotal > 0 ? Math.round((o.creditsUsed / o.creditsTotal) * 100) : 0
            return (
              <div key={o.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 180px', minWidth: '140px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{o.name}</span>
                    <span className="app-badge-muted">{o.plan}</span>
                  </div>
                  <div style={{ marginTop: '8px', height: '6px', borderRadius: '99px', overflow: 'hidden', background: 'var(--line)', maxWidth: '220px' }}>
                    <div style={{
                      height: '100%', width: `${Math.min(100, pct)}%`,
                      background: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : 'var(--blue)',
                      transition: 'width 0.4s',
                    }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{nb(o.members)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>meglere</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{nb(o.videos)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>videoer</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{nb(o.creditsUsed)} / {nb(o.creditsTotal)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>kreditter</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
