'use client'

import { useEffect, useState } from 'react'
import { BETALING_AAPEN } from '@/lib/betaling'
import { ABONNEMENTER, PRIS, prisPerBoligIAbonnement, type AbonnementId, type Kind, type Scope } from '@/lib/boliger'
import AccountTabs from '../profile/AccountTabs'

// Priser og abonnementer etter avtalen med hjem.no (15/10/2026). Tallene
// kommer fra lib/boliger.ts — endres de der, endres de her.

type Saldo = {
  gratisBoligIgjen: boolean
  boligerDenneMaaneden: number
  nestePris: number
  fakturaKunde?: boolean
  fakturaPris?: number | null
  lagSelv: { igjen: number; utloperForst: string | null }
  viProduserer: { igjen: number; utloperForst: string | null }
  abonnementer: { id: string; kind: Kind; scope: Scope; boliger_per_month: number; price_nok_month: number; status: string; user_id: string | null }[]
}

const nb = (n: number) => n.toLocaleString('nb-NO')

const KIND_TITTEL: Record<Kind, { tittel: string; under: string }> = {
  lag_selv:      { tittel: 'Lag selv',      under: 'Du lager filmene i ReelHome. Alle formater og endringer på en bolig er inkludert.' },
  vi_produserer: { tittel: 'Vi produserer', under: 'Vi lager filmene for deg, med innlest stemme eller avatar, levert innen to virkedager.' },
}

export default function BillingPage() {
  const [saldo, setSaldo]       = useState<Saldo | null>(null)
  const [loading, setLoading]   = useState(true)
  const [venter, setVenter]     = useState<string | null>(null)
  const [feil, setFeil]         = useState('')
  // ?bolig=<id> fra «Lås opp boligen»-modalen på boligsiden; ?abonnement=ok / ?avbrutt=1 fra Stripe.
  const [boligId, setBoligId]   = useState<string | null>(null)
  const [melding, setMelding]   = useState('')

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setBoligId(p.get('bolig'))
    if (p.get('abonnement') === 'ok') setMelding('Takk! Abonnementet er registrert, og saldoen fylles så snart betalingen er bekreftet.')
    if (p.get('avbrutt')) setMelding('Betalingen ble avbrutt. Ingenting er trukket.')
    fetch('/api/boliger/saldo')
      .then(r => r.json())
      .then(d => { if (!d.error) setSaldo(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function startCheckout(body: { abonnement: AbonnementId } | { bolig: string }, nokkel: string) {
    setVenter(nokkel)
    setFeil('')
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok || !data.url) {
      setVenter(null)
      setFeil(data.error || 'Kunne ikke starte betaling')
    } else {
      window.location.href = data.url
    }
  }
  const velgAbonnement = (id: AbonnementId) => startCheckout({ abonnement: id }, id)

  const aktive = saldo?.abonnementer ?? []
  const harAktivt = (id: AbonnementId) => {
    const a = ABONNEMENTER[id]
    return aktive.some(x => x.kind === a.kind && x.scope === a.scope && x.status === 'active')
  }

  // Fakturakunde (Hjem.no-modellen, 21/10): fast pris per bolig, faktureres
  // samlet utenfor appen — ingen kjøp, saldo eller abonnement å vise.
  if (saldo?.fakturaKunde) {
    return (
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 24px' }}>
        <AccountTabs />
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>Priser</h1>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>
          Organisasjonen din betaler en fast pris per bolig, samlet og etterskuddsvis. Du trenger ikke kjøpe noe her.
        </p>
        <div className="app-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{nb(saldo.nestePris)} kr</p>
              <p style={{ fontSize: '12px', color: 'var(--muted)' }}>per bolig, eks. mva</p>
            </div>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{saldo.boligerDenneMaaneden}</p>
              <p style={{ fontSize: '12px', color: 'var(--muted)' }}>boliger du har tatt i bruk denne måneden</p>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '16px', marginBottom: 0 }}>
            En bolig regnes som tatt i bruk ved første nedlasting. Fram til da kan du lage inntil sju videoer av den for å se resultatet,
            og etterpå er alle formater og nye versjoner på boligen inkludert. Administrator ser alle boliger og kostnaden per måned under Team.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 24px' }}>
      <AccountTabs />

      {/* ── Nåværende status ── */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>Abonnement og priser</h1>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>
          Du betaler per bolig, ikke per video. En bolig låses opp én gang, og deretter er alle formater,
          nye versjoner og publisering på den boligen inkludert. Alle priser er eks. mva.
        </p>

        {melding && <p className="app-success" style={{ marginBottom: '16px' }}>{melding}</p>}

        {/* Lås opp én bolig (kommer fra boligsiden med ?bolig=) */}
        {boligId && saldo && (
          <div className="app-card" style={{ padding: '20px 24px', marginBottom: '16px', border: '2px solid #2563eb' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>Lås opp boligen</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' }}>
              Engangskjøp for denne boligen: {nb(saldo.nestePris)} kr eks. mva. Deretter er alle formater, nye versjoner og publisering på boligen inkludert.
              {saldo.boligerDenneMaaneden >= 4 ? ' Prisen er lavere fordi du alt har laget flere boliger denne måneden.' : ''}
            </p>
            {BETALING_AAPEN ? (
              <button onClick={() => startCheckout({ bolig: boligId }, 'bolig')} disabled={venter !== null} className="app-btn-primary">
                {venter === 'bolig' ? 'Venter…' : `Lås opp for ${nb(saldo.nestePris)} kr`}
              </button>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Betaling åpnes snart. Send en e-post til <a href="mailto:hei@reelhome.ai" style={{ color: '#2563eb' }}>hei@reelhome.ai</a>, så låser vi opp boligen for deg.
              </p>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ height: '90px', borderRadius: '12px', background: 'var(--line)', opacity: 0.4 }} />
        ) : saldo && (
          <div className="app-card" style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{saldo.boligerDenneMaaneden}</p>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>boliger denne måneden</p>
            </div>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>
                {saldo.gratisBoligIgjen ? 'Gratis' : saldo.lagSelv.igjen > 0 ? 'Inkludert' : `${nb(saldo.nestePris)} kr`}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                {saldo.gratisBoligIgjen ? 'din første bolig' : 'neste bolig'}
              </p>
            </div>
            {saldo.lagSelv.igjen > 0 && (
              <div>
                <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{saldo.lagSelv.igjen}</p>
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  boliger igjen i abonnementet{saldo.lagSelv.utloperForst ? ` · gjelder til ${new Date(saldo.lagSelv.utloperForst).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}` : ''}
                </p>
              </div>
            )}
            {saldo.viProduserer.igjen > 0 && (
              <div>
                <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{saldo.viProduserer.igjen}</p>
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>produksjoner igjen hos oss</p>
              </div>
            )}
            {aktive.length > 0 && (
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>Aktive abonnement</p>
                {aktive.map(a => (
                  <p key={a.id} style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    {KIND_TITTEL[a.kind].tittel} · {a.scope === 'kontor' ? 'Kontor' : 'Megler'} · {nb(a.price_nok_month)} kr/mnd
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Pris per bolig ── */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Pris per bolig</h2>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' }}>
          Uten abonnement. Første bolig du lager selv er gratis.
        </p>
        <div className="app-card" style={{ padding: '6px 24px' }}>
          <Rad tittel="Du lager selv" under={`1–4 boliger i måneden · ${nb(PRIS.selv[1].pris)} kr fra bolig ${PRIS.selv[1].fra} · ${nb(PRIS.selv[2].pris)} kr fra bolig ${PRIS.selv[2].fra}`} pris={`${nb(PRIS.selv[0].pris)} kr`} />
          <Rad tittel="Vi produserer tekstet story i 9:16" under="Levert innen én virkedag" pris={`${nb(PRIS.produksjon.story)} kr`} />
          <Rad tittel="Vi produserer reel og film med innlest stemme" under="Med eller uten avatar, alle formater · innen to virkedager" pris={`${nb(PRIS.produksjon.film)} kr`} sist />
        </div>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '10px' }}>
          Produksjoner vi utfører: {PRIS.produksjonRabattProsent} prosent rabatt fra {PRIS.produksjonRabattFraBestilling}. bestilling i samme måned.
          Ekstra endringsrunde {nb(PRIS.ekstraEndringsrunde)} kr.
        </p>
      </div>

      {/* ── Abonnement ── */}
      {(['lag_selv', 'vi_produserer'] as Kind[]).map(kind => (
        <div key={kind} style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Abonnement · {KIND_TITTEL[kind].tittel}</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' }}>{KIND_TITTEL[kind].under}</p>
          <div className="billing-plans-grid">
            {(Object.values(ABONNEMENTER).filter(a => a.kind === kind)).map(a => (
              <div key={a.id} className="app-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', border: harAktivt(a.id) ? '2px solid #2563eb' : undefined }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '3px' }}>
                    {a.scope === 'kontor' ? 'Kontor' : 'Megler'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{a.beskrivelse}</div>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>{nb(a.prisPerMnd)} kr/mnd</div>
                  <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 500, marginTop: '3px' }}>
                    {nb(prisPerBoligIAbonnement(a.id))} kr per bolig
                  </div>
                </div>
                {harAktivt(a.id) ? (
                  <p style={{ marginTop: 'auto', fontSize: '12px', color: '#2563eb', fontWeight: 600, textAlign: 'center', paddingTop: '10px' }}>Aktivt</p>
                ) : BETALING_AAPEN ? (
                  <button
                    onClick={() => velgAbonnement(a.id)}
                    disabled={venter !== null}
                    className="app-btn-secondary w-full"
                    style={{ marginTop: 'auto' }}
                  >
                    {venter === a.id ? 'Venter…' : 'Velg'}
                  </button>
                ) : (
                  <p style={{ marginTop: 'auto', fontSize: '12px', color: 'var(--muted)', textAlign: 'center', paddingTop: '10px' }}>
                    Bestill på hei@reelhome.ai
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
        Abonnement løper månedlig med én måneds oppsigelse. Ubrukte boliger overføres til neste måned.
        Boliger utover abonnementet koster abonnementets pris per bolig.
        {' '}Spørsmål? <a href="mailto:hei@reelhome.ai" style={{ color: '#2563eb', textDecoration: 'underline' }}>hei@reelhome.ai</a>
      </p>

      {feil && <p className="app-error" style={{ textAlign: 'center', marginTop: '12px' }}>{feil}</p>}
    </div>
  )
}

function Rad({ tittel, under, pris, sist }: { tittel: string; under: string; pris: string; sist?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '14px 0', borderBottom: sist ? 'none' : '1px solid var(--line)' }}>
      <div>
        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)' }}>{tittel}</p>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{under}</p>
      </div>
      <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{pris}</p>
    </div>
  )
}
