'use client'

// Superadmin: avatar-bruk per megler (minutter) — fakturerings-grunnlag.
// Estimert beløp = minutter × pris/min (default 7 kr, justerbar).

import { useEffect, useState } from 'react'

type Row = {
  user_id: string; name: string | null; email: string | null
  minutes: number; liveavatar_min: number; did_min: number; sessions: number
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 18 }

export default function UsagePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [month, setMonth] = useState('')
  const [totalMin, setTotalMin] = useState(0)
  const [pris, setPris] = useState(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/usage').then(r => r.json()).then(d => {
      if (d.error) { setError(d.error); return }
      setRows(d.meglere || []); setMonth(d.month || ''); setTotalMin(d.totalMinutes || 0)
    }).catch(e => setError(String(e))).finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={{ color: 'var(--muted)' }}>Laster bruk…</p>
  if (error) return <p style={{ color: '#dc2626' }}>{error} {error.includes('tilgang') && '— logg inn som superadmin.'}</p>

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Avatar-bruk</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Måned {month} · totalt {totalMin} min · {rows.length} meglere</p>

      <div style={{ ...card, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13 }}>Pris per minutt (kr):</label>
        <input type="number" value={pris} onChange={e => setPris(Number(e.target.value) || 0)}
          style={{ width: 80, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)' }} />
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Estimert total: <strong style={{ color: 'var(--ink)' }}>{(totalMin * pris).toLocaleString('nb-NO')} kr</strong></span>
      </div>

      {rows.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>Ingen registrert bruk denne måneden.</p> : (
        <div style={card}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>
                <th style={{ padding: '8px 6px' }}>Megler</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Min</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>LiveAvatar</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>D-ID</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Sesjoner</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Est. beløp</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.user_id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 6px' }}>{r.name || r.email || r.user_id.slice(0, 8) + '…'}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>{r.minutes}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--muted)' }}>{r.liveavatar_min}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--muted)' }}>{r.did_min}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--muted)' }}>{r.sessions}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{(r.minutes * pris).toLocaleString('nb-NO')} kr</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
