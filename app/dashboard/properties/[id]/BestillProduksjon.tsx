'use client'

// «Bestill produksjon» (avtalen punkt 6 + Vedlegg 3, 16/10): kort på
// boligsiden med knapp, skjema i modal, og status på tidligere bestillinger.
// Vi velger bilder og rekkefølge; megleren kan merke «må med» / «ikke bruk».

import { useEffect, useState } from 'react'
import { NIVAA, STIL, PRESENTASJON, TIDSPUNKT, STATUS, type Nivaa, type Stil, type Presentasjon, type Publisering, type Tidspunkt, type Ordre } from '@/lib/produksjon'

type Pris = { pris: number; rabattProsent: number; listepris: number }
type Forslag = { bestillingerDenneMaaneden: number; saldoIgjen: number; priser: { story: Pris; film: Pris }; betalingAapen: boolean }
type Kanal = { id: string; platform: string; page_name: string }

const nb = (n: number) => n.toLocaleString('nb-NO')

export default function BestillProduksjon({ propertyId, images, hjemUrl }: { propertyId: string; images: string[]; hjemUrl?: string | null }) {
  const [aapen, setAapen] = useState(false)
  const [ordrer, setOrdrer] = useState<Ordre[]>([])
  const [forslag, setForslag] = useState<Forslag | null>(null)
  const [kanaler, setKanaler] = useState<Kanal[]>([])
  const [sender, setSender] = useState(false)
  const [feil, setFeil] = useState('')
  const [kvittering, setKvittering] = useState('')

  // Skjema
  const [nivaa, setNivaa] = useState<Nivaa>('film')
  const [stil, setStil] = useState<Stil>('noytral')
  const [maaMed, setMaaMed] = useState('')
  const [ikkeNevn, setIkkeNevn] = useState('')
  const [prisVisning, setPrisVisning] = useState('')
  const [presentasjon, setPresentasjon] = useState<Presentasjon>('ai')
  const [publisering, setPublisering] = useState<Publisering>('filer')
  const [valgteKanaler, setValgteKanaler] = useState<string[]>([])
  const [tidspunkt, setTidspunkt] = useState<Tidspunkt>('straks')
  const [tidspunktDato, setTidspunktDato] = useState('')
  const [hjemPlakat, setHjemPlakat] = useState(true)
  const [frist, setFrist] = useState('')
  const [bildeMerke, setBildeMerke] = useState<Record<string, 'maa' | 'ikke'>>({})

  useEffect(() => {
    fetch(`/api/produksjon/mine?propertyId=${propertyId}`).then(r => r.json()).then(d => { if (d.ordrer) setOrdrer(d.ordrer) }).catch(() => {})
    const p = new URLSearchParams(window.location.search)
    if (p.get('bestilt')) setKvittering('Takk! Betalingen er registrert, og bestillingen ligger hos oss.')
  }, [propertyId])

  useEffect(() => {
    if (!aapen) return
    fetch('/api/produksjon/bestill').then(r => r.json()).then(d => { if (!d.error) setForslag(d) }).catch(() => {})
    fetch('/api/social/connections').then(r => r.json()).then(d => {
      const liste = (Array.isArray(d) ? d : d?.connections ?? []) as Kanal[]
      setKanaler(liste.filter(k => k.platform === 'facebook' || k.platform === 'instagram'))
    }).catch(() => {})
  }, [aapen])

  function toggleBilde(u: string) {
    setBildeMerke(m => {
      const n = { ...m }
      if (!n[u]) n[u] = 'maa'
      else if (n[u] === 'maa') n[u] = 'ikke'
      else delete n[u]
      return n
    })
  }

  async function bestill() {
    setSender(true); setFeil('')
    try {
      const res = await fetch('/api/produksjon/bestill', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId, nivaa, stil, maaMed, ikkeNevn, prisVisning,
          presentasjon: nivaa === 'story' ? 'uten' : presentasjon,
          publisering, kanaler: valgteKanaler, tidspunkt, tidspunktDato: tidspunktDato || null,
          hjemPlakat, frist: frist || null,
          bilderMaaMed: Object.keys(bildeMerke).filter(u => bildeMerke[u] === 'maa'),
          bilderIkkeBruk: Object.keys(bildeMerke).filter(u => bildeMerke[u] === 'ikke'),
        }),
      })
      const d = await res.json()
      if (!res.ok) { setFeil(d.error || 'Kunne ikke sende bestillingen'); return }
      if (d.url) { window.location.href = d.url; return }
      setOrdrer(prev => [d.ordre, ...prev])
      setAapen(false)
      setKvittering(d.ordre.betaling === 'saldo'
        ? 'Takk! Bestillingen er trukket fra abonnementet ditt og ligger hos oss.'
        : 'Takk! Bestillingen ligger hos oss og faktureres. Du får en forhåndsvisning til godkjenning.')
    } catch (e) { setFeil(String(e)) }
    finally { setSender(false) }
  }

  const pris = forslag?.priser[nivaa]
  const aktive = ordrer.filter(o => o.status !== 'avbrutt' && o.status !== 'publisert')

  return (
    <div className="app-card" style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--ink)', fontSize: '15px' }}>Vil du heller at vi lager den?</h2>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            Tekstet story fra {nb(NIVAA.story.pris)} kr, reel og film med innlest stemme fra {nb(NIVAA.film.pris)} kr. Levert innen én til to virkedager, med forhåndsvisning til godkjenning.
          </p>
        </div>
        <button type="button" onClick={() => setAapen(true)} className="app-btn-secondary" style={{ whiteSpace: 'nowrap' }}>Bestill produksjon</button>
      </div>

      {kvittering && <p className="app-success" style={{ marginTop: '12px' }}>{kvittering}</p>}

      {aktive.length > 0 && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {aktive.map(o => (
            <div key={o.id} style={{ fontSize: '13px', color: 'var(--ink)', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <span>{NIVAA[o.nivaa].navn} · bestilt {new Date(o.created_at).toLocaleDateString('nb-NO')}</span>
              <span style={{ fontWeight: 600, color: o.status === 'til_godkjenning' ? 'var(--gold)' : 'var(--muted)' }}>{STATUS[o.status]}{o.betaling === 'stripe' && !o.betalt_at ? ' · venter på betaling' : ''}</span>
            </div>
          ))}
        </div>
      )}

      {aapen && (
        <div className="app-modal-backdrop" onClick={() => !sender && setAapen(false)}>
          <div className="app-modal" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--ink)' }}>Bestill produksjon</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Vi lager videoen for deg og sender en forhåndsvisning til godkjenning. Én endringsrunde er inkludert.</p>

            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label className="app-label">Nivå</label>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {(Object.keys(NIVAA) as Nivaa[]).map(n => (
                    <button key={n} type="button" onClick={() => setNivaa(n)} style={{ textAlign: 'left', padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', background: nivaa === n ? 'var(--blue-soft)' : 'var(--surface)', border: `2px solid ${nivaa === n ? 'var(--blue)' : 'var(--line)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{NIVAA[n].navn}</span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                          {forslag ? (forslag.saldoIgjen > 0 ? 'Inkludert' : `${nb(forslag.priser[n].pris)} kr`) : `${nb(NIVAA[n].pris)} kr`}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{NIVAA[n].under} · innen {NIVAA[n].virkedager} virkedag{NIVAA[n].virkedager === 1 ? '' : 'er'}</div>
                    </button>
                  ))}
                </div>
                {forslag && forslag.saldoIgjen > 0 && <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>Trekkes fra «Vi produserer»-abonnementet ({forslag.saldoIgjen} igjen).</p>}
                {forslag && forslag.saldoIgjen === 0 && pris && pris.rabattProsent > 0 && <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>{pris.rabattProsent} prosent kvantumsrabatt — dette er bestilling nummer {forslag.bestillingerDenneMaaneden + 1} denne måneden.</p>}
              </div>

              <div>
                <label className="app-label">Stil</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(Object.keys(STIL) as Stil[]).map(s => (
                    <button key={s} type="button" onClick={() => setStil(s)} className={stil === s ? 'app-btn-primary' : 'app-btn-secondary'} style={{ padding: '6px 12px', fontSize: '13px' }}>{STIL[s]}</button>
                  ))}
                </div>
              </div>

              {nivaa === 'film' && (
                <div>
                  <label className="app-label">Presentør</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(Object.keys(PRESENTASJON) as Presentasjon[]).map(p => (
                      <button key={p} type="button" onClick={() => setPresentasjon(p)} className={presentasjon === p ? 'app-btn-primary' : 'app-btn-secondary'} style={{ padding: '6px 12px', fontSize: '13px' }}>{PRESENTASJON[p]}</button>
                    ))}
                  </div>
                </div>
              )}

              <div><label className="app-label">Må med</label><textarea className="app-textarea" rows={2} value={maaMed} onChange={e => setMaaMed(e.target.value)} placeholder="Forhold som skal nevnes, f.eks. nyoppusset kjøkken, solrik terrasse" /></div>
              <div><label className="app-label">Skal ikke nevnes</label><textarea className="app-textarea" rows={2} value={ikkeNevn} onChange={e => setIkkeNevn(e.target.value)} /></div>
              <div><label className="app-label">Pris og visning</label><textarea className="app-textarea" rows={2} value={prisVisning} onChange={e => setPrisVisning(e.target.value)} placeholder="Prisantydning, visningstidspunkt, kontaktinformasjon" /></div>

              <div>
                <label className="app-label">Publisering</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <button type="button" onClick={() => setPublisering('reelhome')} className={publisering === 'reelhome' ? 'app-btn-primary' : 'app-btn-secondary'} style={{ padding: '6px 12px', fontSize: '13px' }}>Via ReelHome</button>
                  <button type="button" onClick={() => setPublisering('filer')} className={publisering === 'filer' ? 'app-btn-primary' : 'app-btn-secondary'} style={{ padding: '6px 12px', fontSize: '13px' }}>Bare filer</button>
                </div>
                {publisering === 'reelhome' && (
                  <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
                    {kanaler.length === 0 ? (
                      <p style={{ color: 'var(--muted)' }}>Du har ingen koblede kanaler. Koble Facebook-side eller Instagram under <a href="/dashboard/social" style={{ color: 'var(--gold)' }}>Publisering</a>, eller velg «bare filer».</p>
                    ) : kanaler.map(k => (
                      <label key={k.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input type="checkbox" checked={valgteKanaler.includes(k.id)} onChange={e => setValgteKanaler(v => e.target.checked ? [...v, k.id] : v.filter(x => x !== k.id))} />
                        {k.platform === 'facebook' ? 'Facebook' : 'Instagram'} · {k.page_name}
                      </label>
                    ))}
                    <select value={tidspunkt} onChange={e => setTidspunkt(e.target.value as Tidspunkt)} className="app-input" style={{ fontSize: '13px' }}>
                      {(Object.keys(TIDSPUNKT) as Tidspunkt[]).map(t => <option key={t} value={t}>{TIDSPUNKT[t]}</option>)}
                    </select>
                    {tidspunkt === 'dato' && <input type="datetime-local" className="app-input" value={tidspunktDato} onChange={e => setTidspunktDato(e.target.value)} />}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {hjemUrl && (
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                    <input type="checkbox" checked={hjemPlakat} onChange={e => setHjemPlakat(e.target.checked)} /> Hjem.no-plakat til slutt
                  </label>
                )}
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                  Ønsket frist <input type="date" className="app-input" style={{ width: 'auto' }} value={frist} onChange={e => setFrist(e.target.value)} />
                </label>
              </div>

              {images.length > 0 && (
                <div>
                  <label className="app-label">Bilder</label>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Vi velger bilder og rekkefølge etter manuset. Trykk på et bilde én gang for «må med» (grønn), to ganger for «ikke bruk» (rød).</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {images.map(u => {
                      const m = bildeMerke[u]
                      return (
                        <button key={u} type="button" onClick={() => toggleBilde(u)} style={{ padding: 0, border: `3px solid ${m === 'maa' ? '#16a34a' : m === 'ikke' ? '#dc2626' : 'transparent'}`, borderRadius: '6px', background: 'none', cursor: 'pointer', opacity: m === 'ikke' ? 0.5 : 1 }}>
                          <img src={u} alt="" style={{ width: '72px', height: '54px', objectFit: 'cover', borderRadius: '3px', display: 'block' }} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {feil && <p className="app-error">{feil}</p>}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setAapen(false)} className="app-btn-ghost" disabled={sender}>Avbryt</button>
                <button type="button" onClick={bestill} className="app-btn-primary" disabled={sender}>
                  {sender ? 'Sender…' : forslag?.saldoIgjen ? 'Bestill (inkludert i abonnement)' : pris ? (forslag?.betalingAapen ? `Betal ${nb(pris.pris)} kr og bestill` : `Bestill · ${nb(pris.pris)} kr, faktureres`) : 'Bestill'}
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'right' }}>Priser eks. mva. Leveringstid regnes fra bestilling før klokken 12 på en virkedag.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
