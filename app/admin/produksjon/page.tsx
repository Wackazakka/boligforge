'use client'

// Ordrekøen (16/10): produksjonsbestillinger fra meglerne, med status og
// internt notat. Superadmin (LARS_EMAIL). Vi jobber i kundens bolig når
// produsentrollen er på plass; inntil da gir lenkene her det vi trenger.

import { useEffect, useState } from 'react'
import { STATUS, NIVAA, STIL, PRESENTASJON, TIDSPUNKT, type Ordre, type OrdreStatus } from '@/lib/produksjon'

type Rad = Ordre & {
  bolig: { id: string; address: string | null; hjem_url: string | null; finn_url: string | null; images: string[] | null } | null
  megler: { navn: string; epost: string }
  kontor: string
}

const nb = (n: number) => n.toLocaleString('nb-NO')
const dato = (s: string | null) => (s ? new Date(s).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
const AKTIVE: OrdreStatus[] = ['mottatt', 'under_arbeid', 'til_godkjenning', 'godkjent']

export default function ProduksjonskoPage() {
  const [ordrer, setOrdrer] = useState<Rad[]>([])
  const [feil, setFeil] = useState('')
  const [laster, setLaster] = useState(true)
  const [visAlle, setVisAlle] = useState(false)
  const [aapen, setAapen] = useState<string | null>(null)
  const [notat, setNotat] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/admin/produksjon').then(r => r.json()).then(d => {
      if (d.error) setFeil(d.error); else setOrdrer(d.ordrer)
    }).catch(e => setFeil(String(e))).finally(() => setLaster(false))
  }, [])

  async function oppdater(id: string, patch: { status?: OrdreStatus; notat_intern?: string }) {
    const res = await fetch('/api/admin/produksjon', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
    const d = await res.json()
    if (!res.ok) { setFeil(d.error || 'Kunne ikke oppdatere'); return }
    setOrdrer(prev => prev.map(o => o.id === id ? { ...o, ...d.ordre } : o))
  }

  const synlige = ordrer.filter(o => visAlle || AKTIVE.includes(o.status))

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>Produksjonskø</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{synlige.length} {visAlle ? 'ordrer' : 'aktive ordrer'} · <a href="/admin" style={{ color: 'var(--gold)' }}>Backoffice</a></p>
        </div>
        <label style={{ fontSize: '13px', color: 'var(--muted)', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input type="checkbox" checked={visAlle} onChange={e => setVisAlle(e.target.checked)} /> Vis også publiserte og avbrutte
        </label>
      </div>

      {feil && <p className="app-error" style={{ marginBottom: '12px' }}>{feil}</p>}
      {laster && <p style={{ color: 'var(--muted)' }}>Laster…</p>}
      {!laster && synlige.length === 0 && <p style={{ color: 'var(--muted)' }}>Ingen ordrer.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {synlige.map(o => {
          const frist = o.frist ?? null
          return (
            <div key={o.id} className="app-card" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                    {o.bolig?.address ?? 'Ukjent bolig'}{' '}
                    {(o.bolig?.hjem_url || o.bolig?.finn_url) && (
                      <a href={o.bolig.hjem_url ?? o.bolig.finn_url ?? '#'} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: 400 }}>annonse ↗</a>
                    )}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {o.megler.navn || o.megler.epost}{o.kontor ? ` · ${o.kontor}` : ''} · {o.megler.epost}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--ink-2)', marginTop: '4px' }}>
                    {NIVAA[o.nivaa].navn} · {STIL[o.stil]} · {PRESENTASJON[o.presentasjon]} · {o.publisering === 'reelhome' ? `ReelHome: ${o.kanaler.join(', ')} · ${TIDSPUNKT[o.tidspunkt]}` : 'bare filer'}
                    {frist ? ` · frist ${frist}` : ''}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    Bestilt {dato(o.created_at)} · {nb(o.pris_nok)} kr{o.rabatt_prosent ? ` (−${o.rabatt_prosent} %)` : ''} · {o.betaling}{o.betalt_at ? ' · betalt' : o.betaling === 'stripe' ? ' · IKKE betalt' : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={o.status} onChange={e => oppdater(o.id, { status: e.target.value as OrdreStatus })} className="app-input" style={{ width: 'auto', fontSize: '13px' }}>
                    {(Object.keys(STATUS) as OrdreStatus[]).map(s => <option key={s} value={s}>{STATUS[s]}</option>)}
                  </select>
                  <button type="button" onClick={() => setAapen(aapen === o.id ? null : o.id)} className="app-btn-ghost text-xs">{aapen === o.id ? 'Skjul' : 'Detaljer'}</button>
                </div>
              </div>

              {aapen === o.id && (
                <div style={{ marginTop: '12px', borderTop: '1px solid var(--line)', paddingTop: '12px', fontSize: '13px', color: 'var(--ink)', display: 'grid', gap: '8px' }}>
                  {o.maa_med && <p><strong>Må med:</strong> {o.maa_med}</p>}
                  {o.ikke_nevn && <p><strong>Skal ikke nevnes:</strong> {o.ikke_nevn}</p>}
                  {o.pris_visning && <p><strong>Pris og visning:</strong> {o.pris_visning}</p>}
                  <p><strong>Hjem.no-plakat:</strong> {o.hjem_plakat ? 'ja' : 'nei'}{o.tidspunkt_dato ? ` · Publiseres ${dato(o.tidspunkt_dato)}` : ''}</p>
                  {(o.bilder_maa_med.length > 0 || o.bilder_ikke_bruk.length > 0) && (
                    <div style={{ display: 'grid', gap: '6px' }}>
                      {o.bilder_maa_med.length > 0 && <div><strong>Må med:</strong><div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>{o.bilder_maa_med.map(u => <img key={u} src={u} alt="" style={{ height: '48px', borderRadius: '4px', border: '2px solid #16a34a' }} />)}</div></div>}
                      {o.bilder_ikke_bruk.length > 0 && <div><strong>Ikke bruk:</strong><div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>{o.bilder_ikke_bruk.map(u => <img key={u} src={u} alt="" style={{ height: '48px', borderRadius: '4px', border: '2px solid #dc2626', opacity: 0.7 }} />)}</div></div>}
                    </div>
                  )}
                  <div>
                    <label className="app-label">Internt notat</label>
                    <textarea className="app-textarea" rows={2} value={notat[o.id] ?? o.notat_intern ?? ''} onChange={e => setNotat(n => ({ ...n, [o.id]: e.target.value }))} />
                    <button type="button" onClick={() => oppdater(o.id, { notat_intern: notat[o.id] ?? o.notat_intern ?? '' })} className="app-btn-secondary text-xs" style={{ marginTop: '6px' }}>Lagre notat</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
