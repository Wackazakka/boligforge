'use client'

import { useEffect, useState } from 'react'

interface Seller {
  id: string
  name: string
  email: string
  ref_code: string
  commission_rate: number
  rate_y1: number; rate_y2: number; rate_y3: number; rate_y4: number
  manager_rate: number | null
  parent_id: string | null
  parent_name: string | null
  active: boolean
  customer_count: number
  total_commission: number
  created_at: string
}

const pct = (n: number) => `${+(Number(n) * 100).toFixed(1)}`
const schedule = (s: Seller) => `${pct(s.rate_y1)}/${pct(s.rate_y2)}/${pct(s.rate_y3)}/${pct(s.rate_y4)}%`

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 20 }
const input: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '10px 12px', color: 'var(--ink)', fontSize: 14, outline: 'none', width: '100%' }
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }
const btn: React.CSSProperties = { background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }

function osloPeriodNow(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit' }).format(new Date())
}

export default function SellersAdminPage() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [refCode, setRefCode] = useState('')
  const [rateY1, setRateY1] = useState('25'); const [rateY2, setRateY2] = useState('25')
  const [rateY3, setRateY3] = useState('25'); const [rateY4, setRateY4] = useState('25')
  const [discountRate, setDiscountRate] = useState('25')
  const [managerRate, setManagerRate] = useState(''); const [parentId, setParentId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [period, setPeriod] = useState(osloPeriodNow())
  const [computing, setComputing] = useState(false)
  const [computeMsg, setComputeMsg] = useState('')

  useEffect(() => { fetchSellers() }, [])

  async function fetchSellers() {
    setLoading(true)
    const res = await fetch('/api/admin/sellers')
    const data = await res.json()
    setSellers(data.sellers ?? [])
    setLoading(false)
  }

  async function createSeller(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setCreateMsg(null)
    const res = await fetch('/api/admin/sellers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, email, ref_code: refCode,
        rate_y1: Number(rateY1) / 100, rate_y2: Number(rateY2) / 100, rate_y3: Number(rateY3) / 100, rate_y4: Number(rateY4) / 100,
        discount_rate: Number(discountRate) / 100,
        parent_id: parentId || null,
        manager_rate: managerRate === '' ? null : Number(managerRate) / 100,
      }),
    })
    const data = await res.json()
    if (!res.ok) setCreateMsg({ ok: false, text: data.error ?? 'Noe gikk galt' })
    else {
      setCreateMsg({ ok: true, text: `Opprettet! Vanlig: ${data.ref_url} · Rabatt: ${data.discount_url}${data.emailSent ? ' · E-post sendt.' : ' · (E-post ikke sendt)'}` })
      setName(''); setEmail(''); setRefCode(''); setRateY1('25'); setRateY2('25'); setRateY3('25'); setRateY4('25'); setDiscountRate('25'); setManagerRate(''); setParentId('')
      fetchSellers()
    }
    setCreating(false)
  }

  async function computeCommissions() {
    setComputing(true); setComputeMsg('')
    const res = await fetch('/api/admin/commissions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period }),
    })
    const data = await res.json()
    if (!res.ok) setComputeMsg(data.error ?? 'Feil ved beregning')
    else {
      const total = (data.results ?? []).reduce((s: number, r: { commission_amount: number }) => s + r.commission_amount, 0)
      setComputeMsg(`Beregnet ${period}: ${data.results.length} selgere, total provisjon ${total.toLocaleString('nb-NO')} kr`)
      fetchSellers()
    }
    setComputing(false)
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 800 }}>Selgere</h1>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>Opprett selger</h2>
        <form onSubmit={createSeller} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label style={label}>Navn</label><input style={input} value={name} onChange={e => setName(e.target.value)} required placeholder="Ola Hansen" /></div>
            <div><label style={label}>E-post</label><input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="ola@example.com" /></div>
            <div><label style={label}>Ref-kode</label><input style={input} value={refCode} onChange={e => setRefCode(e.target.value)} required placeholder="hansen123" /></div>
          </div>
          <div>
            <label style={label}>Provisjon (%) — trapp per kunde over 4 år</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 6 }}>
              {([['År 1', rateY1, setRateY1], ['År 2', rateY2, setRateY2], ['År 3', rateY3, setRateY3], ['År 4 og senere', rateY4, setRateY4]] as const).map(([lbl, val, set]) => (
                <div key={lbl}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{lbl}</div>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...input, paddingRight: 28 }} type="number" min={0} max={100} step="0.5" value={val} onChange={e => set(e.target.value)} required />
                    <span style={{ position: 'absolute', right: 12, top: 11, color: 'var(--muted)', fontSize: 13 }}>%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label style={label}>Rabatt til kunden (%) — på abonnement</label>
            <div style={{ position: 'relative', width: 110 }}>
              <input style={{ ...input, paddingRight: 28 }} type="number" min={0} max={100} step="0.5" value={discountRate} onChange={e => setDiscountRate(e.target.value)} required />
              <span style={{ position: 'absolute', right: 12, top: 11, color: 'var(--muted)', fontSize: 13 }}>%</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>Rekruttert av / sjef (valgfritt)</label>
              <select style={{ ...input, cursor: 'pointer' }} value={parentId} onChange={e => setParentId(e.target.value)}>
                <option value="">— Ingen (toppnivå) —</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.ref_code})</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Sjef-sats (%, valgfritt — gjør denne til salgssjef)</label>
              <div style={{ position: 'relative', width: 140 }}>
                <input style={{ ...input, paddingRight: 28 }} type="number" min={0} max={100} step="0.5" value={managerRate} onChange={e => setManagerRate(e.target.value)} placeholder="—" />
                <span style={{ position: 'absolute', right: 12, top: 11, color: 'var(--muted)', fontSize: 13 }}>%</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button style={{ ...btn, opacity: creating ? 0.7 : 1 }} disabled={creating}>{creating ? '...' : 'Opprett selger'}</button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Ref-kode: 3–40 tegn (a–z, 0–9, - _). Trappen teller fra hver kundes (org) registrering.</span>
          </div>
        </form>
        {createMsg && <div style={{ marginTop: 12, fontSize: 13, color: createMsg.ok ? 'var(--green)' : '#dc2626', wordBreak: 'break-all' }}>{createMsg.text}</div>}
      </div>

      <div style={{ ...card, display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
        <div><label style={label}>Beregn provisjon for periode</label><input style={{ ...input, width: 140 }} value={period} onChange={e => setPeriod(e.target.value)} placeholder="2026-06" /></div>
        <button style={{ background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '11px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: computing ? 0.7 : 1 }} disabled={computing} onClick={computeCommissions}>{computing ? 'Beregner...' : 'Beregn'}</button>
        {computeMsg && <div style={{ fontSize: 13, color: 'var(--ink-3)', flex: 1 }}>{computeMsg}</div>}
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>Alle selgere ({sellers.length})</h2>
        {loading ? <p style={{ color: 'var(--muted)' }}>Laster...</p> : sellers.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Ingen selgere ennå.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                <th style={{ padding: '8px 12px 8px 0' }}>Navn</th><th style={{ padding: 8 }}>Ref-kode</th><th style={{ padding: 8 }}>Sats år 1–4</th><th style={{ padding: 8 }}>Sjef / nivå</th><th style={{ padding: 8 }}>Kunder</th><th style={{ padding: 8 }}>Provisjon (sum)</th><th style={{ padding: 8 }}>Status</th><th style={{ padding: 8 }}></th>
              </tr></thead>
              <tbody>
                {sellers.map(s => (
                  <tr key={s.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 12px 12px 0', fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: 8, fontFamily: 'var(--mono)', color: 'var(--blue)' }}>{s.ref_code}</td>
                    <td style={{ padding: 8, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{schedule(s)}</td>
                    <td style={{ padding: 8, fontSize: 12, color: 'var(--ink-3)' }}>{s.manager_rate != null ? `Sjef ${pct(s.manager_rate)}%` : (s.parent_name ?? '—')}</td>
                    <td style={{ padding: 8 }}>{s.customer_count}</td>
                    <td style={{ padding: 8 }}>{Number(s.total_commission).toLocaleString('nb-NO')} kr</td>
                    <td style={{ padding: 8 }}><span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, background: s.active ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)', color: s.active ? 'var(--green)' : '#dc2626' }}>{s.active ? 'aktiv' : 'inaktiv'}</span></td>
                    <td style={{ padding: 8 }}><a href={`/admin/sellers/${s.id}`} style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 600 }}>Detaljer →</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
