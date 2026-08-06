'use client'

// «Spør om boligen» — tekstutgaven av digital visning, uten avatar.
// Samme hjerne som avatar-samtalen (/api/avatar/ask: RAG over salgsoppgave/
// tilstandsrapport + boligfakta + interessentregistrering), bare ren tekst-chat.
// Offentlig kjøperside: ingen innlogging; adressen hentes fra /api/avatar/provider.

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Turn = { role: 'user' | 'assistant'; content: string; lead?: boolean }

function Chat() {
  const params = useSearchParams()
  const propertyId = params.get('property') ?? ''

  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const busyRef = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [address, setAddress] = useState('')
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

  if (available === null) return <p style={{ textAlign: 'center', marginTop: 40, color: '#777' }}>Laster…</p>
  if (available === false) return <p style={{ textAlign: 'center', marginTop: 40, color: '#777' }}>Denne boligsamtalen er ikke tilgjengelig akkurat nå.</p>

  return (
    <div style={{ maxWidth: 680, margin: '24px auto', padding: 16, fontFamily: 'system-ui', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 48px)' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Spør om boligen{address ? ` — ${address}` : ''}</h1>
      <p style={{ color: '#555', fontSize: 13, margin: '4px 0 16px' }}>
        Still spørsmål om boligen — svarene hentes fra salgsoppgaven, tilstandsrapporten og boligdataene.
      </p>

      <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: 12, padding: 14, overflowY: 'auto', background: '#fafafa', marginBottom: 12 }}>
        <div style={{ marginBottom: 10, textAlign: 'left' }}>
          <div style={{ display: 'inline-block', maxWidth: '90%', padding: '8px 12px', borderRadius: 10, fontSize: 14, lineHeight: 1.5, background: '#fff', border: '1px solid #e5e5e5' }}>
            Hei! Spør meg om hva som helst ved {address || 'boligen'} — bad, tak, avvik i
            tilstandsrapporten, felleskostnader, nabolaget. Jeg svarer ut fra meglerens
            dokumenter. Vil du på visning, kan jeg registrere deg hos megleren.
          </div>
        </div>
        {turns.map((t, i) => (
          <div key={i} style={{ marginBottom: 10, textAlign: t.role === 'user' ? 'right' : 'left' }}>
            <div style={{
              display: 'inline-block', maxWidth: '90%', padding: '8px 12px', borderRadius: 10, fontSize: 14, lineHeight: 1.5,
              background: t.role === 'user' ? '#2563eb' : '#fff',
              color: t.role === 'user' ? '#fff' : '#111',
              border: t.role === 'user' ? 'none' : '1px solid #e5e5e5',
              textAlign: 'left',
            }}>
              {t.content}
              {t.lead && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>✅ Interessent registrert</div>}
            </div>
          </div>
        ))}
        {thinking && <p style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>Slår opp i dokumentene…</p>}
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
          style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1px solid #ccc', fontSize: 14 }}
        />
        <button
          onClick={() => ask(typed)}
          disabled={thinking || !typed.trim()}
          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: thinking || !typed.trim() ? 0.5 : 1 }}
        >
          Send
        </button>
      </div>

      <p style={{ color: '#999', fontSize: 11, marginTop: 10, textAlign: 'center' }}>
        Svarene hentes automatisk fra meglerens dokumenter og er veiledende — ikke juridisk
        rådgivning. Sjekk alltid salgsoppgaven og still spørsmål til megler før bud.
      </p>
    </div>
  )
}

export default function BoligChatPage() {
  return <Suspense fallback={null}><Chat /></Suspense>
}
