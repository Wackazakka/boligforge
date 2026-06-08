'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Customer { org_id: string; name: string; created_at: string | null; last_payment_at: string | null; total_paid: number }
interface Commission { period: string; gross_amount: number; commission_amount: number; own_commission?: number; override_commission?: number; customer_count: number }
interface Seller { id: string; name: string; email: string; ref_code: string; commission_rate: number; rate_y1: number; rate_y2: number; rate_y3: number; rate_y4: number; discount_rate: number; manager_rate: number | null; parent_id: string | null; active: boolean }
interface PartnerOpt { id: string; name: string; ref_code: string }
interface Detail { seller: Seller; customers: Customer[]; commissions: Commission[]; total_commission: number; parent_name: string | null; ref_url: string; discount_url: string; portal_url: string; recruit_url: string | null; is_manager: boolean }

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 20 }
const fmt = (n: number) => Number(n).toLocaleString('nb-NO')
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('nb-NO') : '—')
const pct = (n: number) => String(+(Number(n) * 100).toFixed(1))
const sInput: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '10px 26px 10px 12px', color: 'var(--ink)', fontSize: 14, width: 90, outline: 'none' }

export default function SellerDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [rates, setRates] = useState<{ y1: string; y2: string; y3: string; y4: string; disc: string } | null>(null)
  const [saveMsg, setSaveMsg] = useState('')
  const [partners, setPartners] = useState<PartnerOpt[]>([])
  const [parentId, setParentId] = useState(''); const [managerRate, setManagerRate] = useState(''); const [hierMsg, setHierMsg] = useState('')

  useEffect(() => {
    fetch(`/api/admin/sellers/${id}`).then(r => r.json()).then(d => {
      if (!d.error) {
        setData(d)
        setRates({ y1: pct(d.seller.rate_y1), y2: pct(d.seller.rate_y2), y3: pct(d.seller.rate_y3), y4: pct(d.seller.rate_y4), disc: pct(d.seller.discount_rate) })
        setParentId(d.seller.parent_id ?? '')
        setManagerRate(d.seller.manager_rate != null ? pct(d.seller.manager_rate) : '')
      }
      setLoading(false)
    })
    fetch('/api/admin/sellers').then(r => r.json()).then(d => setPartners((d.sellers ?? []).map((p: PartnerOpt) => ({ id: p.id, name: p.name, ref_code: p.ref_code }))))
  }, [id])

  async function saveRates() {
    if (!data || !rates) return
    setBusy(true); setSaveMsg('')
    const payload = { rate_y1: Number(rates.y1) / 100, rate_y2: Number(rates.y2) / 100, rate_y3: Number(rates.y3) / 100, rate_y4: Number(rates.y4) / 100, discount_rate: Number(rates.disc) / 100 }
    const res = await fetch(`/api/admin/sellers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (res.ok) { setData({ ...data, seller: { ...data.seller, ...payload } }); setSaveMsg('Lagret ✓') } else setSaveMsg('Kunne ikke lagre')
    setBusy(false)
  }
  async function saveHierarchy() {
    setBusy(true); setHierMsg('')
    const res = await fetch(`/api/admin/sellers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_id: parentId || null, manager_rate: managerRate === '' ? null : Number(managerRate) / 100 }) })
    const d = await res.json()
    setHierMsg(res.ok ? 'Lagret ✓' : (d.error ?? 'Kunne ikke lagre'))
    setBusy(false)
  }
  async function toggleActive() {
    if (!data) return
    setBusy(true)
    const res = await fetch(`/api/admin/sellers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !data.seller.active }) })
    if (res.ok) setData({ ...data, seller: { ...data.seller, active: !data.seller.active } })
    setBusy(false)
  }
  async function deleteSeller() {
    if (!data) return
    if (!confirm(`Slette selgeren «${data.seller.name}» (${data.seller.ref_code})? Dette kan ikke angres.`)) return
    setBusy(true)
    const res = await fetch(`/api/admin/sellers/${id}`, { method: 'DELETE' })
    if (res.ok) { router.push('/admin/sellers'); return }
    setBusy(false); alert('Kunne ikke slette selgeren.')
  }
  function exportCsv() {
    if (!data) return
    const rows = [['Periode', 'Brutto (kr)', 'Provisjon (kr)', 'Antall kunder']]
    for (const c of data.commissions) rows.push([c.period, String(c.gross_amount), String(c.commission_amount), String(c.customer_count)])
    const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `provisjon-${data.seller.ref_code}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Laster...</p>
  if (!data) return <p style={{ color: '#dc2626' }}>Selger ikke funnet. <a href="/admin/sellers" style={{ color: 'var(--blue)' }}>Tilbake</a></p>
  const { seller, customers, commissions, total_commission } = data

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800 }}>{seller.name}</h1>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--blue)' }}>{seller.ref_code}</span>
          <span style={{ color: 'var(--muted)', marginLeft: 12 }}>{seller.email}</span>
          <span style={{ color: 'var(--muted)', marginLeft: 12 }}>· trapp {pct(seller.rate_y1)}/{pct(seller.rate_y2)}/{pct(seller.rate_y3)}/{pct(seller.rate_y4)}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={toggleActive} disabled={busy} style={{ background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}>{seller.active ? 'Deaktiver' : 'Aktiver'}</button>
          <button onClick={deleteSeller} disabled={busy} style={{ background: 'transparent', color: '#dc2626', border: '1px solid #dc2626', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}>Slett</button>
          <a href="/admin/sellers" style={{ color: 'var(--muted)', fontSize: 14, textDecoration: 'none' }}>← Alle selgere</a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
        <div style={{ ...card, marginBottom: 0 }}><div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Kunder (org)</div><div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{customers.length}</div></div>
        <div style={{ ...card, marginBottom: 0 }}><div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Provisjon (all time)</div><div style={{ fontSize: 28, fontWeight: 900, marginTop: 6, color: 'var(--green)' }}>{fmt(total_commission)} kr</div></div>
        <div style={{ ...card, marginBottom: 0 }}><div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Status</div><div style={{ fontSize: 20, fontWeight: 800, marginTop: 10, color: seller.active ? 'var(--green)' : '#dc2626' }}>{seller.active ? 'Aktiv' : 'Inaktiv'}</div></div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>Provisjonstrapp</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>Provisjon per kunde (org), regnet fra org-ens registrering. År 4 gjelder år 4 og for alltid.</p>
        {rates && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
            {([['År 1', 'y1'], ['År 2', 'y2'], ['År 3', 'y3'], ['År 4+', 'y4']] as const).map(([lbl, key]) => (
              <div key={key}><div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{lbl}</div><div style={{ position: 'relative', width: 90 }}><input type="number" min={0} max={100} step="0.5" value={rates[key]} onChange={e => setRates({ ...rates, [key]: e.target.value })} style={sInput} /><span style={{ position: 'absolute', right: 10, top: 11, color: 'var(--muted)', fontSize: 13 }}>%</span></div></div>
            ))}
            <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 14 }}><div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Rabatt</div><div style={{ position: 'relative', width: 90 }}><input type="number" min={0} max={100} step="0.5" value={rates.disc} onChange={e => setRates({ ...rates, disc: e.target.value })} style={sInput} /><span style={{ position: 'absolute', right: 10, top: 11, color: 'var(--muted)', fontSize: 13 }}>%</span></div></div>
            <button onClick={saveRates} disabled={busy} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 20px', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>Lagre</button>
            {saveMsg && <span style={{ fontSize: 13, color: saveMsg.includes('✓') ? 'var(--green)' : '#dc2626' }}>{saveMsg}</span>}
          </div>
        )}
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>Hierarki</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)' }}>Sett sjefen over denne selgeren, og en sjef-sats hvis dette er en salgssjef (override på teamet under).</p>
        <div style={{ display: 'flex', gap: 16, alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 220 }}><div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Rekruttert av / sjef</div>
            <select value={parentId} onChange={e => setParentId(e.target.value)} style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '10px 12px', color: 'var(--ink)', fontSize: 14, minWidth: 220, cursor: 'pointer' }}>
              <option value="">— Ingen (toppnivå) —</option>
              {partners.filter(p => p.id !== id).map(p => <option key={p.id} value={p.id}>{p.name} ({p.ref_code})</option>)}
            </select>
          </div>
          <div><div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Sjef-sats (%)</div><div style={{ position: 'relative', width: 110 }}><input type="number" min={0} max={100} step="0.5" value={managerRate} onChange={e => setManagerRate(e.target.value)} placeholder="—" style={{ ...sInput, width: 110 }} /><span style={{ position: 'absolute', right: 10, top: 11, color: 'var(--muted)', fontSize: 13 }}>%</span></div></div>
          <button onClick={saveHierarchy} disabled={busy} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 20px', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>Lagre</button>
          {hierMsg && <span style={{ fontSize: 13, color: hierMsg.includes('✓') ? 'var(--green)' : '#dc2626' }}>{hierMsg}</span>}
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>Lenker</h2>
        {([
          ['Vanlig henvisningslenke', data.ref_url],
          ['Rabatt-lenke (gir kunden rabatt)', data.discount_url],
          ...(data.is_manager && data.recruit_url ? [['Rekrutteringslenke (verv nye selgere under denne)', data.recruit_url]] : []),
          ['Selger-portal (privat — gir tilgang)', data.portal_url],
        ] as [string, string][]).map(([lbl, url]) => (
          <div key={lbl} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{lbl}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input readOnly value={url} style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', color: 'var(--ink-2)', fontSize: 13, fontFamily: 'var(--mono)' }} onFocus={e => e.currentTarget.select()} />
              <button onClick={() => navigator.clipboard?.writeText(url)} style={{ background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Kopier</button>
            </div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Månedlig provisjon</h2>
          <button onClick={exportCsv} disabled={commissions.length === 0} style={{ background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: commissions.length ? 'pointer' : 'not-allowed', opacity: commissions.length ? 1 : 0.5 }}>Eksporter til CSV</button>
        </div>
        {commissions.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 14 }}>Ingen beregnede perioder ennå.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}><th style={{ padding: '8px 12px 8px 0' }}>Periode</th><th style={{ padding: 8 }}>Brutto</th><th style={{ padding: 8 }}>Provisjon</th><th style={{ padding: 8 }}>Kunder</th></tr></thead>
            <tbody>{commissions.map(c => (<tr key={c.period} style={{ borderTop: '1px solid var(--line)' }}><td style={{ padding: '12px 12px 12px 0', fontFamily: 'var(--mono)' }}>{c.period}</td><td style={{ padding: 8 }}>{fmt(c.gross_amount)} kr</td><td style={{ padding: 8, color: 'var(--green)', fontWeight: 600 }}>{fmt(c.commission_amount)} kr</td><td style={{ padding: 8 }}>{c.customer_count}</td></tr>))}</tbody>
          </table>
        )}
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>Kunder ({customers.length})</h2>
        {customers.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 14 }}>Ingen henviste kunder ennå.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}><th style={{ padding: '8px 12px 8px 0' }}>Organisasjon</th><th style={{ padding: 8 }}>Registrert</th><th style={{ padding: 8 }}>Siste betaling</th><th style={{ padding: 8 }}>Totalt betalt</th></tr></thead>
              <tbody>{customers.map(c => (<tr key={c.org_id} style={{ borderTop: '1px solid var(--line)' }}><td style={{ padding: '12px 12px 12px 0' }}>{c.name}</td><td style={{ padding: 8, color: 'var(--ink-3)' }}>{fmtDate(c.created_at)}</td><td style={{ padding: 8, color: 'var(--ink-3)' }}>{fmtDate(c.last_payment_at)}</td><td style={{ padding: 8 }}>{fmt(c.total_paid)} kr</td></tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
