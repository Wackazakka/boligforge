'use client'
export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

interface History { period: string; gross_amount: number; commission_amount: number; own_commission?: number; override_commission?: number; customer_count: number }
interface TeamRow { name: string; ref_code: string; amount: number }
interface Recruit { id: string; name: string; ref_code: string; manager_rate: number | null }
interface Transaction { date: string; amount: number; commission: number; rate: number; customer: string; kind: string }
interface Schedule { rate_y1: number; rate_y2: number; rate_y3: number; rate_y4: number }
interface Summary {
  name: string; ref_code: string; schedule: Schedule; active: boolean
  is_manager: boolean; manager_rate: number | null; recruit_url: string | null
  can_promote: boolean; my_manager_rate: number | null; direct_recruits: Recruit[]
  customer_count: number
  current: { period: string; gross: number; own: number; override: number; commission: number }
  team: TeamRow[]; history: History[]; transactions: Transaction[]
}

const fmt = (n: number) => Number(n).toLocaleString('nb-NO')
const pct = (n: number) => +(Number(n) * 100).toFixed(1)
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
const ACCENT = '#2563eb'
const MONEY = '#059669'

function AgentPortal() {
  const params = useParams<{ ref_code: string }>()
  const searchParams = useSearchParams()
  const refCode = (params?.ref_code as string) ?? ''

  const [token, setToken] = useState<string | null>(null)
  const [data, setData] = useState<Summary | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [recruitRates, setRecruitRates] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    const storeKey = `reelhome_agent_token_${refCode}`
    const urlToken = searchParams.get('token')
    const stored = typeof window !== 'undefined' ? localStorage.getItem(storeKey) : null
    const t = urlToken || stored
    if (urlToken && typeof window !== 'undefined') localStorage.setItem(storeKey, urlToken)
    if (!t) { setState('error'); return }
    setToken(t)
    fetch(`/api/agent/summary?ref_code=${encodeURIComponent(refCode)}&token=${encodeURIComponent(t)}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Summary) => {
        setData(d)
        const rr: Record<string, string> = {}
        ;(d.direct_recruits || []).forEach(r => { rr[r.id] = r.manager_rate != null ? String(+(r.manager_rate * 100).toFixed(1)) : '' })
        setRecruitRates(rr)
        setState('ok')
      })
      .catch(() => setState('error'))
  }, [refCode, searchParams])

  async function saveRecruit(childId: string) {
    if (!data || !token) return
    setSavingId(childId)
    const val = recruitRates[childId] ?? ''
    await fetch('/api/agent/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref_code: data.ref_code, token, child_id: childId, manager_rate: val === '' ? null : Number(val) / 100 }),
    }).catch(() => {})
    setSavingId(null)
  }

  if (state === 'loading') return <Shell><p style={{ color: '#6b7280' }}>Laster...</p></Shell>
  if (state === 'error' || !data) return (
    <Shell>
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Ugyldig lenke</h2>
        <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Bruk lenken du fikk på e-post. Kontakt ReelHome hvis du trenger en ny.</p>
      </div>
    </Shell>
  )

  const exportUrl = `/api/agent/export?ref_code=${encodeURIComponent(refCode)}&token=${encodeURIComponent(token ?? '')}`

  return (
    <Shell>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 900 }}>Hei, {data.name} 👋</h1>
        <p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>Selger-portal · kode <span style={{ fontFamily: 'monospace', color: ACCENT }}>{data.ref_code}</span></p>
        {data.is_manager && data.manager_rate != null ? (
          <div style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>
            Salgssjef · <b style={{ color: '#111' }}>{pct(data.manager_rate)}%</b> på egne salg, og differansen (din sats − selgers sats) på salgene til teamet ditt.
          </div>
        ) : (
          <div style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>
            Provisjon per kunde: <b style={{ color: '#111' }}>{pct(data.schedule.rate_y1)}%</b> år 1 · {pct(data.schedule.rate_y2)}% år 2 · {pct(data.schedule.rate_y3)}% år 3 · {pct(data.schedule.rate_y4)}% år 4 og senere
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Aktive kunder</div>
          <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8 }}>{data.customer_count}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Provisjon denne måneden ({data.current.period})</div>
          <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8, color: MONEY }}>{fmt(data.current.commission)} kr</div>
          {data.current.override > 0
            ? <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Egne salg {fmt(data.current.own)} kr · Override {fmt(data.current.override)} kr</div>
            : <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>av {fmt(data.current.gross)} kr omsetning</div>}
        </div>
      </div>

      {data.is_manager && data.recruit_url && (
        <div style={{ ...card, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>Verv nye selgere</h2>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6b7280' }}>Del denne lenken med folk du vil ha på laget. De registrerer seg selv og havner under deg — du tjener override på salgene deres.</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input readOnly value={data.recruit_url} onFocus={e => e.currentTarget.select()} style={{ flex: 1, minWidth: 220, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', color: '#374151', fontSize: 13, fontFamily: 'monospace' }} />
            <button onClick={() => navigator.clipboard?.writeText(data.recruit_url!)} style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Kopier</button>
          </div>
        </div>
      )}

      {data.can_promote && data.direct_recruits.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>Administrer teamet ditt</h2>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6b7280' }}>Gi en selger lov til å verve egne selgere: sett en verve-sats (override de tjener på sine vervede). Tomt = kan ikke verve. Maks {pct(data.my_manager_rate ?? 0)}% (din sats).</p>
          {data.direct_recruits.map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid #f0f0f0', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}><b>{r.name}</b> <span style={{ fontFamily: 'monospace', color: ACCENT, fontSize: 13 }}>{r.ref_code}</span></div>
              <div style={{ position: 'relative', width: 96 }}>
                <input type="number" min={0} max={pct(data.my_manager_rate ?? 0)} step="0.5" placeholder="—" value={recruitRates[r.id] ?? ''} onChange={e => setRecruitRates({ ...recruitRates, [r.id]: e.target.value })}
                  style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 24px 9px 11px', color: '#111', fontSize: 14, width: 96, outline: 'none' }} />
                <span style={{ position: 'absolute', right: 9, top: 10, color: '#9ca3af', fontSize: 13 }}>%</span>
              </div>
              <button onClick={() => saveRecruit(r.id)} disabled={savingId === r.id} style={{ background: '#f3f4f6', color: '#111', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: savingId === r.id ? 'default' : 'pointer', opacity: savingId === r.id ? 0.6 : 1 }}>{savingId === r.id ? '...' : 'Lagre'}</button>
            </div>
          ))}
        </div>
      )}

      {data.team.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>Override fra teamet ditt ({data.current.period})</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>Det du tjener på salgene til selgerne du har rekruttert, denne måneden.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ textAlign: 'left', color: '#9ca3af', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                <th style={{ padding: '8px 12px 8px 0' }}>Selger</th><th style={{ padding: 8 }}>Kode</th><th style={{ padding: 8 }}>Din override</th>
              </tr></thead>
              <tbody>{data.team.map((t, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 12px 12px 0' }}>{t.name}</td>
                  <td style={{ padding: 8, fontFamily: 'monospace', color: ACCENT }}>{t.ref_code}</td>
                  <td style={{ padding: 8, color: MONEY, fontWeight: 600 }}>{fmt(t.amount)} kr</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Provisjon siste måneder</h2>
          <a href={exportUrl} style={{ background: ACCENT, color: '#fff', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Last ned faktureringsgrunnlag</a>
        </div>
        {data.history.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Ingen avsluttede måneder ennå. Tallene oppdateres når ReelHome beregner månedens provisjon.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ textAlign: 'left', color: '#9ca3af', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              <th style={{ padding: '8px 12px 8px 0' }}>Periode</th><th style={{ padding: 8 }}>Omsetning</th><th style={{ padding: 8 }}>Provisjon</th><th style={{ padding: 8 }}>Kunder</th>
            </tr></thead>
            <tbody>{data.history.map(h => (
              <tr key={h.period} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 12px 12px 0', fontFamily: 'monospace' }}>{h.period}</td>
                <td style={{ padding: 8 }}>{fmt(h.gross_amount)} kr</td>
                <td style={{ padding: 8, color: MONEY, fontWeight: 600 }}>{fmt(h.commission_amount)} kr</td>
                <td style={{ padding: 8 }}>{h.customer_count}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>Salg som gir provisjon</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>Hver betaling fra kundene du har henvist. Kundene er anonymisert.</p>
        {data.transactions.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Ingen salg ennå.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ textAlign: 'left', color: '#9ca3af', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                <th style={{ padding: '8px 12px 8px 0' }}>Dato</th><th style={{ padding: 8 }}>Type</th><th style={{ padding: 8 }}>Kunde</th><th style={{ padding: 8 }}>Beløp</th><th style={{ padding: 8 }}>Sats</th><th style={{ padding: 8 }}>Din provisjon</th>
              </tr></thead>
              <tbody>{data.transactions.map((t, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 12px 12px 0', color: '#6b7280' }}>{new Date(t.date).toLocaleDateString('nb-NO')}</td>
                  <td style={{ padding: 8 }}>{t.kind}</td>
                  <td style={{ padding: 8, color: '#6b7280' }}>{t.customer}</td>
                  <td style={{ padding: 8 }}>{fmt(t.amount)} kr</td>
                  <td style={{ padding: 8, color: '#6b7280' }}>{pct(t.rate)}%</td>
                  <td style={{ padding: 8, color: MONEY, fontWeight: 600 }}>{fmt(t.commission)} kr</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f8', color: '#111', padding: '40px 20px', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}><span style={{ fontSize: 22, fontWeight: 900, color: ACCENT }}>ReelHome<span style={{ color: '#111' }}>.ai</span></span></div>
        {children}
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<Shell><p style={{ color: '#6b7280' }}>Laster...</p></Shell>}>
      <AgentPortal />
    </Suspense>
  )
}
