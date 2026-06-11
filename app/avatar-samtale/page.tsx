'use client'

// Kjøper-klienten (Fase 1, B5): live stemmesamtale med megler-avataren.
// LiveAvatar = ansikt + stemme (repeat). Ører = nettleserens SpeechRecognition
// (no-NO) — Dr. Hanni-teknikken, langt bedre norsk enn LiveAvatars STT.
// Samtale-loop: lytt -> finalt transkript -> ask -> repeat(svar) -> lytt igjen.
// Gated: getUser via API-rutene (visningstoken-gating kommer i Spor C).

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { speakifyForTTS } from '../../lib/norwegian-numbers'

type Turn = { role: 'user' | 'assistant'; content: string; lead?: boolean }

function Samtale() {
  const params = useSearchParams()
  const propertyId = params.get('property') ?? ''

  const videoRef = useRef<HTMLVideoElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null)
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const finalTextRef = useRef('')
  const micActiveRef = useRef(false)
  const busyRef = useRef(false)
  const lastActivityRef = useRef(0)
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // hvor lenge avataren venter tålmodig i stillhet før økten får sovne
  const IDLE_GRACE_MS = 10 * 60 * 1000

  const [status, setStatus] = useState<'idle' | 'kobler' | 'klar' | 'lytter' | 'tenker' | 'snakker' | 'avsluttet' | 'feil'>('idle')
  const [address, setAddress] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [errMsg, setErrMsg] = useState('')
  const [micOn, setMicOn] = useState(false)
  const [interim, setInterim] = useState('')
  const [typed, setTyped] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!propertyId) return
    fetch('/api/properties/list').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setAddress(d.find((p: { id: string }) => p.id === propertyId)?.address ?? '')
    }).catch(() => {})
  }, [propertyId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, status])

  function startRecognition() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.webkitSpeechRecognition || w.SpeechRecognition
    if (!SR) { setErrMsg('Talegjenkjenning støttes ikke i denne nettleseren — bruk Chrome eller Safari.'); return false }
    // drep en eventuell gammel instans først (to samtidige gjenkjennere
    // får Chrome til å avbryte den nye i stillhet -> «hører meg ikke»)
    try { recognitionRef.current?.abort() } catch {}
    const rec = new SR()
    recognitionRef.current = rec
    rec.lang = 'no-NO'
    rec.continuous = false
    rec.interimResults = true
    finalTextRef.current = ''
    // Push-to-talk (Dr. Hanni-flyten): brukeren snakker ferdig og trykker
    // «Ferdig» — først DA sendes spørsmålet. Ingen auto-send på pauser.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      if (!micActiveRef.current) return // events etter at mic er slått av
      let interimT = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const txt = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTextRef.current += txt + ' '
        else interimT += txt
      }
      setInterim((finalTextRef.current + interimT).trim())
    }
    rec.onend = () => {
      // pauser i talen: bare fortsett å lytte til brukeren trykker Ferdig
      if (micActiveRef.current && !busyRef.current) {
        try { rec.start() } catch {}
      }
    }
    rec.onstart = () => setErrMsg('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (event: any) => {
      console.error('[stt] feil:', event.error)
      if (event.error === 'not-allowed') {
        setErrMsg('Mikrofontilgang ble avvist — tillat mikrofon og prøv igjen.')
        micActiveRef.current = false
        setMicOn(false)
        setStatus('klar')
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setErrMsg(`Mikrofon-feil (${event.error}) — trykk mikrofonknappen igjen.`)
        micActiveRef.current = false
        setMicOn(false)
        setStatus('klar')
      }
    }
    try { rec.start(); return true } catch { return false }
  }

  function pauseListening() {
    try { recognitionRef.current?.abort() } catch {}
  }
  async function handleQuestion(question: string) {
    const q = question.trim()
    if (!q || busyRef.current) return
    busyRef.current = true
    lastActivityRef.current = Date.now()
    finalTextRef.current = ''
    pauseListening()
    setStatus('tenker')
    setTurns(prev => [...prev, { role: 'user', content: q }])
    try {
      const res = await fetch('/api/avatar/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, question: q, history: historyRef.current }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'ask feilet')
      historyRef.current.push({ role: 'user', content: q }, { role: 'assistant', content: d.answer })
      historyRef.current = historyRef.current.slice(-12)
      setTurns(prev => [...prev, { role: 'assistant', content: d.answer, lead: d.leadCaptured }])
      setStatus('snakker')
      sessionRef.current?.repeat(d.speech || d.answer)
      // lytting gjenopptas av AVATAR_SPEAK_ENDED
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setStatus('klar')
    } finally {
      busyRef.current = false
    }
  }

  async function start() {
    if (!propertyId) { setErrMsg('Mangler eiendom (?property=…)'); return }
    setStatus('kobler')
    setErrMsg('')
    try {
      const res = await fetch('/api/avatar/poc-token', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'token-feil')

      const { LiveAvatarSession, SessionEvent, AgentEventsEnum } = await import('@heygen/liveavatar-web-sdk')
      // voiceChat av: ørene er nettleserens SpeechRecognition, ikke LiveAvatar
      const session = new LiveAvatarSession(data.session_token, { voiceChat: false })
      sessionRef.current = session

      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (videoRef.current) {
          session.attach(videoRef.current)
          videoRef.current.play().catch(() => {})
        }
        setStatus('klar')
      })
      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        // push-to-talk: ingen auto-resume (ville nullstilt påbegynt spørsmål
        // etter avbrytelse) — brukeren styrer mikrofonen selv
        setStatus(micActiveRef.current ? 'lytter' : 'klar')
      })
      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        if (keepAliveRef.current) clearInterval(keepAliveRef.current)
        setStatus('avsluttet')
      })

      await session.start()
      // tålmodighet: ping keep-alive så lenge siste aktivitet er < 10 min gammel —
      // tenkepauser er greit, men evig tomgang brenner kreditter
      lastActivityRef.current = Date.now()
      keepAliveRef.current = setInterval(() => {
        if (Date.now() - lastActivityRef.current < IDLE_GRACE_MS) {
          try { session.keepAlive() } catch {}
        }
      }, 45_000)
      // hilsen først NÅ — repeat() før start() er ferdig gir 'Session needs to be connected'
      setStatus('snakker')
      try {
        session.repeat(`Hei og velkommen til digital visning av ${speakifyForTTS(address) || 'denne boligen'}! Jeg kan svare på det meste fra salgsoppgaven og tilstandsrapporten. Trykk på mikrofonknappen, still spørsmålet ditt, og trykk ferdig når du er klar.`)
      } catch (e) {
        console.error('hilsen feilet:', e)
        setStatus('klar')
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setStatus('feil')
    }
  }

  function toggleMic() {
    if (!micOn) {
      lastActivityRef.current = Date.now()
      // barge-in: klikk mens avataren snakker avbryter svaret hennes
      try { sessionRef.current?.interrupt() } catch {}
      micActiveRef.current = true
      if (startRecognition()) {
        setMicOn(true)
        setStatus('lytter')
      } else {
        micActiveRef.current = false
      }
    } else {
      // «Ferdig» trykket: stopp lyttingen og send det som ble sagt
      micActiveRef.current = false
      setMicOn(false)
      pauseListening()
      const text = finalTextRef.current.trim()
      finalTextRef.current = ''
      setInterim('')
      if (text) {
        handleQuestion(text)
      } else {
        setStatus('klar')
      }
    }
  }

  async function end() {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current)
    micActiveRef.current = false
    setMicOn(false)
    try { await sessionRef.current?.stop() } catch {}
    setStatus('avsluttet')
  }

  const statusLabel: Record<typeof status, string> = {
    idle: 'Klar til å starte', kobler: 'Kobler til megler…', klar: 'Tilkoblet',
    lytter: '🎙 Lytter — trykk «Ferdig» når du har stilt spørsmålet', tenker: '🧠 Tenker…', snakker: '💬 Avataren snakker',
    avsluttet: 'Samtalen tok en pause — trykk «Start ny samtale» for å fortsette', feil: 'Noe gikk galt',
  }

  return (
    <div style={{ maxWidth: 880, margin: '24px auto', padding: 16, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Digital visning{address ? ` — ${address}` : ''}</h1>
      <p style={{ color: '#555', fontSize: 13, margin: '4px 0 12px' }}>
        Status: <strong>{statusLabel[status]}</strong>
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 380px', minWidth: 320 }}>
          <video ref={videoRef} autoPlay playsInline
            style={{ width: '100%', background: '#000', borderRadius: 12, aspectRatio: '16/9' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {status === 'idle' && (
              <button onClick={start} style={btn('#2563eb')}>Start samtale</button>
            )}
            {status !== 'idle' && status !== 'avsluttet' && status !== 'kobler' && status !== 'feil' && status !== 'tenker' && (
              <button onClick={toggleMic} style={btn(micOn ? '#16a34a' : '#9333ea')}>
                {micOn ? '✅ Ferdig — send spørsmålet' : status === 'snakker' ? '🎙 Avbryt og still nytt spørsmål' : '🎙 Trykk og still spørsmålet'}
              </button>
            )}
            {status !== 'idle' && status !== 'avsluttet' && (
              <button onClick={end} style={btn('#6b7280')}>Avslutt samtalen</button>
            )}
            {(status === 'avsluttet' || status === 'feil') && (
              <button onClick={() => window.location.reload()} style={btn('#2563eb')}>Start ny samtale</button>
            )}
          </div>
          {interim && <p style={{ color: '#2563eb', fontSize: 13, marginTop: 8, fontStyle: 'italic' }}>«{interim}»</p>}
          {errMsg && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{errMsg}</p>}
          {status !== 'idle' && status !== 'avsluttet' && status !== 'kobler' && status !== 'feil' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                value={typed}
                onChange={e => setTyped(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && typed.trim() && !busyRef.current) { try { sessionRef.current?.interrupt() } catch {}; handleQuestion(typed); setTyped('') } }}
                placeholder="…eller skriv spørsmålet her"
                style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 13 }}
              />
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 320px', minWidth: 300, border: '1px solid #ddd', borderRadius: 12, padding: 14, maxHeight: 480, overflowY: 'auto', background: '#fafafa' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Samtale</div>
          {turns.length === 0 && <p style={{ fontSize: 13, color: '#999' }}>Transkripsjonen vises her.</p>}
          {turns.map((t, i) => (
            <div key={i} style={{ marginBottom: 10, textAlign: t.role === 'user' ? 'right' : 'left' }}>
              <div style={{
                display: 'inline-block', maxWidth: '90%', padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                background: t.role === 'user' ? '#2563eb' : '#fff',
                color: t.role === 'user' ? '#fff' : '#111',
                border: t.role === 'user' ? 'none' : '1px solid #e5e5e5',
              }}>
                {t.content}
                {t.lead && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>✅ Interessent registrert</div>}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

function btn(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
}

export default function AvatarSamtalePage() {
  return <Suspense fallback={null}><Samtale /></Suspense>
}
