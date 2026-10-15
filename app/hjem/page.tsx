'use client'

// Hjem.no-inngangen (16/10, avtalen punkt 4): megleren limer inn lenken til en
// av sine egne annonser på hjem.no. Vi kjenner igjen kontor og megler fra
// annonsen og sender en innloggingslenke til e-posten som står der. Ingen
// registrering, intet passord. Offentlig side (ikke bak proxy-matcheren).
// Tar også ?url=<annonse> for en fremtidig «Lag video»-knapp hos hjem.no.

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Svar = {
  listing: { url: string; title: string; address: string }
  agency: { name: string; logoUrl: string | null } | null
  contacts: { index: number; name: string; position: string | null; image: string | null; emailMasked: string | null; harEpost: boolean }[]
}

export default function HjemInngangPage() {
  const [url, setUrl] = useState('')
  const [svar, setSvar] = useState<Svar | null>(null)
  const [laster, setLaster] = useState(false)
  const [sender, setSender] = useState<number | null>(null)
  const [sendt, setSendt] = useState<{ emailMasked: string; userExists: boolean } | null>(null)
  const [feil, setFeil] = useState('')

  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get('url')
    if (u) { setUrl(u); void slaaOpp(u) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function slaaOpp(u: string) {
    setLaster(true); setFeil(''); setSvar(null); setSendt(null)
    try {
      const res = await fetch('/api/hjem/inngang', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: u }) })
      const data = await res.json()
      if (!res.ok) setFeil(data.error || 'Fant ikke annonsen')
      else setSvar(data)
    } catch (e) { setFeil(String(e)) }
    finally { setLaster(false) }
  }

  async function sendLenke(index: number) {
    if (!svar) return
    setSender(index); setFeil('')
    try {
      const res = await fetch('/api/hjem/send-lenke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: svar.listing.url, contactIndex: index }) })
      const data = await res.json()
      if (!res.ok) setFeil(data.error || 'Kunne ikke sende lenken')
      else setSendt({ emailMasked: data.emailMasked, userExists: !!data.userExists })
    } catch (e) { setFeil(String(e)) }
    finally { setSender(null) }
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: 'var(--sans)' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '48px 20px' }}>
        <Link href="/" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>← reelhome.ai</Link>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ink)', margin: '18px 0 8px' }}>Lag video av annonsen din på hjem.no</h1>
        <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '24px' }}>
          Lim inn lenken til en av dine egne annonser. Vi kjenner igjen kontoret og deg fra annonsen og sender en
          innloggingslenke til e-posten som står der. Ingen registrering, intet passord. Første bolig er gratis.
        </p>

        {!sendt && (
          <form onSubmit={e => { e.preventDefault(); if (url.trim()) void slaaOpp(url.trim()) }} style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input
              className="app-input"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://hjem.no/property/123456/…"
              style={{ flex: '1 1 260px' }}
              autoFocus
            />
            <button type="submit" className="app-btn-primary" disabled={laster || !url.trim()}>
              {laster ? 'Henter…' : 'Finn annonsen'}
            </button>
          </form>
        )}

        {feil && <div className="app-error" style={{ marginBottom: '16px' }}>{feil}</div>}

        {svar && !sendt && (
          <div className="app-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              {svar.agency?.logoUrl && (
                <img src={svar.agency.logoUrl} alt="" style={{ height: '36px', maxWidth: '120px', objectFit: 'contain' }} />
              )}
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{svar.listing.address || svar.listing.title}</p>
                {svar.agency && <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{svar.agency.name}</p>}
              </div>
            </div>

            {svar.contacts.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
                Annonsen har ingen megler oppført. Skriv til <a href="mailto:hei@reelhome.ai" style={{ color: 'var(--gold)' }}>hei@reelhome.ai</a>, så hjelper vi deg.
              </p>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px' }}>Hvem er du?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {svar.contacts.map(c => (
                    <button
                      key={c.index}
                      type="button"
                      disabled={!c.harEpost || sender !== null}
                      onClick={() => sendLenke(c.index)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left',
                        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '10px 14px',
                        cursor: c.harEpost ? 'pointer' : 'not-allowed', opacity: c.harEpost ? 1 : 0.6,
                      }}
                    >
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-2)', flexShrink: 0 }}>
                        {c.image && <img src={c.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{c.name}</p>
                        <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {c.position ? `${c.position} · ` : ''}{c.harEpost ? `lenken sendes til ${c.emailMasked}` : 'ingen e-post i annonsen'}
                        </p>
                      </div>
                      <span style={{ fontSize: '13px', color: 'var(--gold)', whiteSpace: 'nowrap' }}>
                        {sender === c.index ? 'Sender…' : 'Det er meg →'}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {sendt && (
          <div className="app-card" style={{ padding: '24px' }}>
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px' }}>📬 Sjekk e-posten din</p>
            <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6 }}>
              Vi har sendt en lenke til <strong>{sendt.emailMasked}</strong>. Klikk på den, så
              {sendt.userExists ? ' logges du inn og annonsen hentes.' : ' er kontoen din klar med logo og profil fra annonsen, og annonsen hentes.'}
              {' '}Finner du den ikke, sjekk søppelposten.
            </p>
            <button type="button" onClick={() => { setSendt(null); setSvar(null) }} className="app-btn-ghost" style={{ marginTop: '16px', fontSize: '13px' }}>
              Prøv en annen annonse
            </button>
          </div>
        )}

        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '28px' }}>
          Har du allerede konto? <Link href="/auth/login" style={{ color: 'var(--gold)' }}>Logg inn</Link>.
        </p>
      </div>
    </div>
  )
}
