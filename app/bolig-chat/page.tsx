'use client'

// «Spør om boligen» — tekstutgaven av digital visning, uten avatar.
// Samme hjerne som avatar-samtalen (/api/avatar/ask: RAG over salgsoppgave/
// tilstandsrapport + boligfakta + interessentregistrering), ren tekst-chat.
// Offentlig kjøperside: ingen innlogging; adresse/bilde/fakta fra /api/avatar/provider.

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Turn = { role: 'user' | 'assistant'; content: string; lead?: boolean }

type Card = {
  image: string | null
  price: number | null
  bedrooms: number | null
  propertyType: string | null
  sizeBra: number | null
  buildYear: number | null
}

function formatPris(n: number): string {
  return `kr ${n.toLocaleString('nb-NO').replace(/,/g, ' ')}`
}

function Chat() {
  const params = useSearchParams()
  const propertyId = params.get('property') ?? ''

  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const busyRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [address, setAddress] = useState('')
  const [card, setCard] = useState<Card | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [typed, setTyped] = useState('')
  const [thinking, setThinking] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    if (!propertyId) { setAvailable(false); return }
    fetch(`/api/avatar/provider?propertyId=${propertyId}`)
      .then(r => r.json())
      .then(d => {
        setAddress((d.address || '').split(',')[0].trim())
        setCard(d.card ?? null)
        setAvailable(true)
      })
      .catch(() => setAvailable(false))
  }, [propertyId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, thinking])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busyRef.current) return
    busyRef.current = true
    setErrMsg('')
    setThinking(true)
    setTurns(prev => [...prev, { role: 'user', content: q }])
    setTyped('')
    try {
      const res = await fetch('/api/avatar/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, question: q, history: historyRef.current }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Noe gikk galt — prøv igjen')
      historyRef.current.push({ role: 'user', content: q }, { role: 'assistant', content: d.answer })
      historyRef.current = historyRef.current.slice(-12)
      setTurns(prev => [...prev, { role: 'assistant', content: d.answer, lead: d.leadCaptured }])
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
    } finally {
      busyRef.current = false
      setThinking(false)
      inputRef.current?.focus()
    }
  }

  const facts = card
    ? [
        card.propertyType,
        card.bedrooms ? `${card.bedrooms} soverom` : null,
        card.sizeBra ? `${card.sizeBra} m² BRA` : null,
        card.buildYear ? `Byggeår ${card.buildYear}` : null,
        card.price ? formatPris(card.price) : null,
      ].filter(Boolean).join('  ·  ')
    : ''

  if (available === null) {
    return <p style={{ textAlign: 'center', marginTop: 60, color: 'var(--muted)', fontFamily: 'system-ui' }}>Laster…</p>
  }
  if (available === false) {
    return <p style={{ textAlign: 'center', marginTop: 60, color: 'var(--muted)', fontFamily: 'system-ui' }}>Denne boligsamtalen er ikke tilgjengelig akkurat nå.</p>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f6f7f9', display: 'flex', flexDirection: 'column' }}>

      {/* Toppmeny — samme lockup som resten av produktet */}
      <nav style={{ background: '#fff', borderBottom: '1px solid var(--line, #e5e5e5)' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="https://reelhome.ai" className="rh-lockup" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand-kit/reelhome-mark.svg" alt="" width="28" height="28" />
            <span className="rh-wm" style={{ fontSize: '19px' }}>ReelHome<span className="rh-ai">.ai</span></span>
          </a>
          <span style={{ fontSize: 13, color: 'var(--muted, #737373)', fontWeight: 500 }}>Digital boligassistent</span>
        </div>
      </nav>

      <main style={{ flex: 1, width: '100%', maxWidth: 880, margin: '0 auto', padding: '24px 20px 32px', display: 'flex', flexDirection: 'column' }}>

        {/* Bolig-header: bilde + adresse + nøkkelfakta */}
        <div style={{ background: '#fff', border: '1px solid var(--line, #e5e5e5)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
          {card?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.image} alt={address} style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
          )}
          <div style={{ padding: '16px 20px' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink, #0f0f0f)', margin: 0 }}>{address}</h1>
            {facts && <p style={{ fontSize: 13, color: 'var(--muted, #737373)', margin: '6px 0 0' }}>{facts}</p>}
          </div>
        </div>

        {/* Chat */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid var(--line, #e5e5e5)', borderRadius: 14, padding: 18, overflowY: 'auto', marginBottom: 14, minHeight: 260 }}>
          <div style={{ marginBottom: 12, textAlign: 'left' }}>
            <div style={{ display: 'inline-block', maxWidth: '88%', padding: '10px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.55, background: '#f3f4f6', color: 'var(--ink, #111)' }}>
              Hei! Spør meg om hva som helst ved {address || 'boligen'} — bad, tak, avvik i
              tilstandsrapporten, kostnader, nabolaget. Jeg svarer ut fra meglerens dokumenter.
              Vil du på visning, kan jeg registrere deg hos megleren.
            </div>
          </div>
          {turns.map((t, i) => (
            <div key={i} style={{ marginBottom: 12, textAlign: t.role === 'user' ? 'right' : 'left' }}>
              <div style={{
                display: 'inline-block', maxWidth: '88%', padding: '10px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.55,
                background: t.role === 'user' ? 'var(--blue, #2563eb)' : '#f3f4f6',
                color: t.role === 'user' ? '#fff' : 'var(--ink, #111)',
                textAlign: 'left',
              }}>
                {t.content}
                {t.lead && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 5, fontWeight: 600 }}>✅ Interessent registrert — megleren har fått beskjed</div>}
              </div>
            </div>
          ))}
          {thinking && <p style={{ fontSize: 13, color: 'var(--muted-2, #999)', fontStyle: 'italic' }}>Slår opp i dokumentene…</p>}
          <div ref={bottomRef} />
        </div>

        {errMsg && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{errMsg}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') ask(typed) }}
            placeholder="Skriv spørsmålet ditt her…"
            maxLength={600}
            autoFocus
            style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid #d4d4d4', fontSize: 14, background: '#fff', outline: 'none' }}
          />
          <button
            onClick={() => ask(typed)}
            disabled={thinking || !typed.trim()}
            style={{ background: 'var(--blue, #2563eb)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: thinking || !typed.trim() ? 0.5 : 1 }}
          >
            Send
          </button>
        </div>

        <p style={{ color: 'var(--muted-2, #999)', fontSize: 11, marginTop: 12, textAlign: 'center', lineHeight: 1.5 }}>
          Svarene hentes automatisk fra meglerens dokumenter og er veiledende — ikke juridisk
          rådgivning. Sjekk alltid salgsoppgaven og still spørsmål til megler før bud.
        </p>
      </main>
    </div>
  )
}

export default function BoligChatPage() {
  return <Suspense fallback={null}><Chat /></Suspense>
}
