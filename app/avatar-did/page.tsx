'use client'

// D-ID kjøper-samtale (Avatar Nivå 2 + Spor C gating). Rå WebRTC mot D-ID Agents Streams
// via server-proxy (/api/avatar/did-stream). Tekst drives av Claude (/api/avatar/ask).
// Ører = nettleserens SpeechRecognition (no-NO). Stemme = agentens norske (Azure nb-NO).
//
// PORT (Spor C): megler (innlogget) slipper rett inn for testing. Kjøper må melde seg på
// (navn/e-post/telefon + samtykke, avhengig av megler-valgt gate_mode) → får visningstoken
// som lagres lokalt og sendes med hvert kall. Avatar-rutene gater på token server-side.

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { speakifyForTTS } from '../../lib/norwegian-numbers'

type Turn = { role: 'user' | 'assistant'; content: string; lead?: boolean }
type GateState = 'loading' | 'megler' | 'disabled' | 'signup' | 'open'
type GateCfg = { gate_mode: string; viewing_date: string | null; address: string | null }

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function Samtale() {
  const params = useSearchParams()
  const propertyId = params.get('property') ?? ''

  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamIdRef = useRef<string>('')
  const sessionIdRef = useRef<string>('')
  const greetedRef = useRef(false)
  const connectedRef = useRef(false)
  const pendingGreetRef = useRef(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const viewingTokenRef = useRef<string | null>(null)
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const finalTextRef = useRef('')
  const micActiveRef = useRef(false)
  const busyRef = useRef(false)
  const speakQueueRef = useRef<string[]>([])
  const speakingRef = useRef(false)
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [status, setStatus] = useState<'idle' | 'kobler' | 'klar' | 'lytter' | 'tenker' | 'snakker' | 'avsluttet' | 'feil'>('idle')
  const [address, setAddress] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [errMsg, setErrMsg] = useState('')
  const [micOn, setMicOn] = useState(false)
  const [interim, setInterim] = useState('')
  const [typed, setTyped] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Port
  const [gate, setGate] = useState<GateState>('loading')
  const [gateCfg, setGateCfg] = useState<GateCfg | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', consent: false })
  const [signupBusy, setSignupBusy] = useState(false)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, status])

  // Forhåndsvarm D-ID-strømmen så snart porten er passert (megler eller gyldig token),
  // så «Start samtale» blir tilnærmet umiddelbart i stedet for ~10 sek venting.
  useEffect(() => {
    if (gate === 'open' || gate === 'megler') connectStream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate])

  // Port-sjekk ved last
  useEffect(() => {
    if (!propertyId) { setGate('disabled'); return }
    let cancelled = false
    ;(async () => {
      // Megler innlogget? → bypass porten (testing)
      try {
        const me = await fetch('/api/org/me')
        if (!cancelled && me.ok) {
          setGate('megler')
          fetch(`/api/avatar/public-config?propertyId=${propertyId}`).then(r => r.json()).then(c => { if (!cancelled) setAddress(c?.address ?? '') }).catch(() => {})
          return
        }
      } catch {}
      if (cancelled) return
      const cfgRes = await fetch(`/api/avatar/public-config?propertyId=${propertyId}`)
      const cfg = await cfgRes.json().catch(() => null)
      if (cancelled) return
      setGateCfg(cfg)
      setAddress(cfg?.address ?? '')
      if (!cfg?.enabled) { setGate('disabled'); return }
      const stored = localStorage.getItem(`rh_viewing_${propertyId}`)
      if (stored) { viewingTokenRef.current = stored; setGate('open'); return }
      setGate('signup')
    })()
    return () => { cancelled = true }
  }, [propertyId])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setSignupBusy(true)
    setErrMsg('')
    try {
      const res = await fetch('/api/avatar/signup', {
        method: 'POST', headers: JSON_HEADERS,
        body: JSON.stringify({ propertyId, name: form.name, email: form.email, phone: form.phone, consent: form.consent }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Påmelding feilet')
      localStorage.setItem(`rh_viewing_${propertyId}`, d.token)
      viewingTokenRef.current = d.token
      setGate('open')
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setSignupBusy(false)
    }
  }

  // Felles did-stream-kall med propertyId + token (server-side gating)
  function didCall(payload: Record<string, unknown>) {
    return fetch('/api/avatar/did-stream', {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ ...payload, propertyId, viewingToken: viewingTokenRef.current }),
    })
  }

  function startRecognition() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.webkitSpeechRecognition || w.SpeechRecognition
    if (!SR) { setErrMsg('Talegjenkjenning støttes ikke i denne nettleseren — bruk Chrome eller Safari.'); return false }
    try { recognitionRef.current?.abort() } catch {}
    const rec = new SR()
    recognitionRef.current = rec
    rec.lang = 'no-NO'
    rec.continuous = false
    rec.interimResults = true
    finalTextRef.current = ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      if (!micActiveRef.current) return
      let interimT = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const txt = event.results[i][0].transcript
        if (event.results[i].isFinal) finalTextRef.current += txt + ' '
        else interimT += txt
      }
      setInterim((finalTextRef.current + interimT).trim())
    }
    rec.onend = () => { if (micActiveRef.current && !busyRef.current) { try { rec.start() } catch {} } }
    rec.onstart = () => setErrMsg('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (event: any) => {
      console.error('[stt] feil:', event.error)
      if (event.error === 'not-allowed') {
        setErrMsg('Mikrofontilgang ble avvist — tillat mikrofon og prøv igjen.')
        micActiveRef.current = false; setMicOn(false); setStatus('klar')
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setErrMsg(`Mikrofon-feil (${event.error}) — trykk mikrofonknappen igjen.`)
        micActiveRef.current = false; setMicOn(false); setStatus('klar')
      }
    }
    try { rec.start(); return true } catch { return false }
  }

  function pauseListening() { try { recognitionRef.current?.abort() } catch {} }

  // Talekø: send neste bit FØRST når forrige er ferdig — ellers spiller D-ID dem oppå
  // hverandre (forvrengt lyd/bilde). Drevet av D-IDs stream-signal (onSpeechDone) med
  // et sjenerøst tids-fallback i tilfelle signalet uteblir.
  function pumpSpeak() {
    if (speakingRef.current) return
    const next = speakQueueRef.current.shift()
    if (next === undefined) return
    speakingRef.current = true
    if (videoRef.current) videoRef.current.muted = false // slå på lyd igjen for ny tale
    didCall({ action: 'speak', streamId: streamIdRef.current, session_id: sessionIdRef.current, input: next })
      .catch(e => console.error('speak feilet:', e))
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current)
    const estMs = (next.length / 12) * 1000 + 1200 // ~realistisk talevarighet + liten buffer
    speakTimerRef.current = setTimeout(() => { speakingRef.current = false; pumpSpeak() }, estMs)
  }

  function onSpeechDone() {
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current)
    speakingRef.current = false
    pumpSpeak()
  }

  // Barge-in: tøm køen (resten av et langt svar droppes). Gjeldende bit spiller ferdig
  // — vi kan ikke stoppe D-ID midt i tale — men ny tale starter ikke før den er ferdig.
  function interruptSpeak() {
    speakQueueRef.current = []
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current)
    if (videoRef.current) videoRef.current.muted = true // umiddelbar stillhet ved barge-in
  }

  function speak(text: string) {
    if (!streamIdRef.current || !sessionIdRef.current) return
    speakQueueRef.current = chunkForSpeak(text)
    pumpSpeak()
  }

  async function handleQuestion(question: string) {
    const q = question.trim()
    if (!q || busyRef.current) return
    busyRef.current = true
    finalTextRef.current = ''
    pauseListening()
    setStatus('tenker')
    setTurns(prev => [...prev, { role: 'user', content: q }])
    try {
      const res = await fetch('/api/avatar/ask', {
        method: 'POST', headers: JSON_HEADERS,
        body: JSON.stringify({ propertyId, question: q, history: historyRef.current, viewingToken: viewingTokenRef.current }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'ask feilet')
      historyRef.current.push({ role: 'user', content: q }, { role: 'assistant', content: d.answer })
      historyRef.current = historyRef.current.slice(-12)
      setTurns(prev => [...prev, { role: 'assistant', content: d.answer, lead: d.leadCaptured }])
      setStatus('snakker')
      speak(d.speech || d.answer)
      setStatus('klar')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setStatus('klar')
    } finally {
      busyRef.current = false
    }
  }

  function greetOnce() {
    if (greetedRef.current) return
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current) // samtalen i gang → ikke koble ned
    greetedRef.current = true
    setStatus('snakker')
    speak(`Hei og velkommen til digital visning av ${speakifyForTTS(address) || 'denne boligen'}! Jeg kan svare på det meste fra salgsoppgaven og tilstandsrapporten. Trykk på mikrofonknappen, still spørsmålet ditt, og trykk ferdig når du er klar.`)
    setStatus('klar')
  }

  // Koble ned en forhåndsvarmet strøm som ingen tok i bruk (sparer D-ID-streamingtid).
  function teardownStream() {
    if (streamIdRef.current && sessionIdRef.current) {
      didCall({ action: 'delete', streamId: streamIdRef.current, session_id: sessionIdRef.current }).catch(() => {})
    }
    try { pcRef.current?.close() } catch {}
    pcRef.current = null
    connectedRef.current = false
    streamIdRef.current = ''
    sessionIdRef.current = ''
  }

  // Tomgangs-timeout: hvis ingen starter samtalen innen 90 sek, koble ned den varme
  // strømmen så den ikke står og brenner credits for en kjøper som forlot siden.
  function startIdleTimer() {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      if (!greetedRef.current) teardownStream()
    }, 90_000)
  }

  // Forhåndsvarming: koble opp WebRTC-strømmen ved sidelast (uten å snakke), så selve
  // «Start»-klikket blir tilnærmet umiddelbart. Hilsen krever brukerklikk (lyd-gesture).
  async function connectStream() {
    if (!propertyId || pcRef.current) return
    try {
      const createRes = await didCall({ action: 'create' })
      const s = await createRes.json()
      if (!createRes.ok) throw new Error(s.error || 'create feilet')
      streamIdRef.current = s.id
      sessionIdRef.current = s.session_id

      const pc = new RTCPeerConnection({ iceServers: s.ice_servers })
      pcRef.current = pc
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          didCall({ action: 'ice', streamId: s.id, session_id: s.session_id, candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex }).catch(() => {})
        }
      }
      pc.ontrack = (e) => {
        if (videoRef.current && e.streams[0]) {
          videoRef.current.muted = true // stille tomgang under forhåndsvarming; hilsen slår på lyd
          videoRef.current.srcObject = e.streams[0]
          videoRef.current.play().catch(() => {})
        }
      }
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState
        if (st === 'connected') {
          connectedRef.current = true
          if (pendingGreetRef.current) { pendingGreetRef.current = false; greetOnce() }
          else startIdleTimer() // forhåndsvarmet, venter på Start → koble ned hvis ingen starter
        } else if (st === 'failed' || st === 'closed') {
          connectedRef.current = false
          if (greetedRef.current) setStatus('feil') // bare vis feil hvis samtalen var i gang
        }
      }
      // D-ID sender 'stream/done:{...}' over en data channel når gjeldende bit er ferdig
      // snakket → send neste kø-bit. (Fallback-timer dekker om formatet avviker.)
      pc.ondatachannel = (ev) => {
        ev.channel.onmessage = (msg) => {
          const m = String((msg as MessageEvent).data ?? '')
          if (m.includes('stream/done')) onSpeechDone()
        }
      }

      await pc.setRemoteDescription(s.offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await didCall({ action: 'sdp', streamId: s.id, session_id: s.session_id, answer: { type: answer.type, sdp: answer.sdp } })
    } catch (e) {
      if (greetedRef.current) { setErrMsg(e instanceof Error ? e.message : String(e)); setStatus('feil') }
    }
  }

  // «Start samtale»-klikket (brukergest som tillater lyd): hils med en gang strømmen er varm.
  function start() {
    if (!propertyId) { setErrMsg('Mangler eiendom (?property=…)'); return }
    setErrMsg('')
    greetedRef.current = false
    if (connectedRef.current) {
      greetOnce()
    } else {
      setStatus('kobler')
      pendingGreetRef.current = true
      connectStream() // i tilfelle forhåndsvarmingen ikke rakk/feilet
    }
  }

  function toggleMic() {
    if (!micOn) {
      interruptSpeak() // barge-in: stopp resten av et langt svar når brukeren vil snakke
      micActiveRef.current = true
      if (startRecognition()) { setMicOn(true); setStatus('lytter') }
      else micActiveRef.current = false
    } else {
      micActiveRef.current = false
      setMicOn(false)
      pauseListening()
      const text = finalTextRef.current.trim()
      finalTextRef.current = ''
      setInterim('')
      if (text) handleQuestion(text)
      else setStatus('klar')
    }
  }

  async function end() {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    micActiveRef.current = false
    setMicOn(false)
    if (streamIdRef.current && sessionIdRef.current) {
      didCall({ action: 'delete', streamId: streamIdRef.current, session_id: sessionIdRef.current }).catch(() => {})
    }
    try { pcRef.current?.close() } catch {}
    setStatus('avsluttet')
  }

  // ── Port-skjermer ──────────────────────────────────────────────────────────
  if (gate === 'loading') {
    return <div style={{ maxWidth: 520, margin: '60px auto', padding: 24, fontFamily: 'system-ui', textAlign: 'center', color: '#555' }}>Laster…</div>
  }
  if (gate === 'disabled') {
    return (
      <div style={{ maxWidth: 520, margin: '60px auto', padding: 24, fontFamily: 'system-ui', textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Digital visning</h1>
        <p style={{ color: '#555', marginTop: 12 }}>AI-megleren er ikke aktivert for denne boligen ennå. Ta kontakt med megleren.</p>
      </div>
    )
  }
  if (gate === 'signup') {
    const mode = gateCfg?.gate_mode ?? 'contact'
    const needContact = mode === 'contact' || mode === 'viewing'
    const consentLabel = mode === 'viewing'
      ? 'Jeg melder meg på visningen og samtykker til at megler lagrer kontaktinformasjonen min og kan kontakte meg.'
      : 'Jeg samtykker til at megler lagrer kontaktinformasjonen min for å følge opp interessen min i denne boligen.'
    return (
      <div style={{ maxWidth: 480, margin: '48px auto', padding: 24, fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Digital visning{address ? ` — ${address}` : ''}</h1>
        <p style={{ color: '#555', fontSize: 14, margin: '8px 0 20px' }}>
          {mode === 'viewing' ? 'Meld deg på visningen for å snakke med AI-megleren om boligen.' : 'Registrer deg for å snakke med AI-megleren om boligen.'}
          {gateCfg?.viewing_date ? ` Visning: ${gateCfg.viewing_date}.` : ''}
        </p>
        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {needContact && <>
            <input required placeholder="Navn" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} />
            <input required type="email" placeholder="E-post" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inp} />
            <input required type="tel" placeholder="Telefon" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inp} />
          </>}
          <label style={{ display: 'flex', gap: 8, fontSize: 13, color: '#444', alignItems: 'flex-start' }}>
            <input required type="checkbox" checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} style={{ marginTop: 3 }} />
            <span>{consentLabel}</span>
          </label>
          {errMsg && <p style={{ color: '#dc2626', fontSize: 13 }}>{errMsg}</p>}
          <button type="submit" disabled={signupBusy} style={{ ...btn('#2563eb'), opacity: signupBusy ? 0.6 : 1 }}>
            {signupBusy ? 'Sender…' : (mode === 'viewing' ? 'Meld på og start' : 'Start samtale')}
          </button>
        </form>
      </div>
    )
  }

  // ── Avatar (gate === 'open' eller 'megler') ───────────────────────────────
  const statusLabel: Record<typeof status, string> = {
    idle: 'Klar til å starte', kobler: 'Kobler til megler…', klar: 'Tilkoblet',
    lytter: '🎙 Lytter — trykk «Ferdig» når du har stilt spørsmålet', tenker: '🧠 Tenker…', snakker: '💬 Avataren snakker',
    avsluttet: 'Samtalen er avsluttet — trykk «Start ny samtale»', feil: 'Noe gikk galt',
  }

  return (
    <div style={{ maxWidth: 880, margin: '24px auto', padding: 16, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Digital visning{address ? ` — ${address}` : ''}{gate === 'megler' ? ' (forhåndsvisning)' : ''}</h1>
      <p style={{ color: '#555', fontSize: 13, margin: '4px 0 6px' }}>
        Status: <strong>{statusLabel[status]}</strong>
      </p>
      <p style={{ color: 'var(--muted, #888)', fontSize: 12, margin: '0 0 12px', lineHeight: 1.5 }}>
        💡 Megleren leser hele salgsoppgaven og tilstandsrapporten for hvert spørsmål — gi den gjerne noen sekunder på å finne det riktige svaret.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 380px', minWidth: 320 }}>
          <video ref={videoRef} autoPlay playsInline
            style={{ width: '100%', background: '#000', borderRadius: 12, aspectRatio: '16/9' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {status === 'idle' && <button onClick={start} style={btn('#2563eb')}>Start samtale</button>}
            {status !== 'idle' && status !== 'avsluttet' && status !== 'kobler' && status !== 'feil' && status !== 'tenker' && (
              <button onClick={toggleMic} style={btn(micOn ? '#16a34a' : '#9333ea')}>
                {micOn ? '✅ Ferdig — send spørsmålet' : '🎙 Trykk og still spørsmålet'}
              </button>
            )}
            {status !== 'idle' && status !== 'avsluttet' && <button onClick={end} style={btn('#6b7280')}>Avslutt samtalen</button>}
            {(status === 'avsluttet' || status === 'feil') && <button onClick={() => window.location.reload()} style={btn('#2563eb')}>Start ny samtale</button>}
          </div>
          {interim && <p style={{ color: '#2563eb', fontSize: 13, marginTop: 8, fontStyle: 'italic' }}>«{interim}»</p>}
          {errMsg && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{errMsg}</p>}
          {status !== 'idle' && status !== 'avsluttet' && status !== 'kobler' && status !== 'feil' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                value={typed}
                onChange={e => setTyped(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && typed.trim() && !busyRef.current) { handleQuestion(typed); setTyped('') } }}
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

// Del tekst i biter på ~280 tegn langs setningsgrenser (for D-ID/Azure tekstgrense)
function chunkForSpeak(text: string, maxLen = 1400): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [text]
  const chunks: string[] = []
  let cur = ''
  for (const s of sentences) {
    const t = s.trim()
    if (!t) continue
    if (cur && (cur + ' ' + t).length > maxLen) { chunks.push(cur); cur = t }
    else cur = cur ? `${cur} ${t}` : t
  }
  if (cur) chunks.push(cur)
  return chunks
}

const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 }
function btn(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
}

export default function AvatarDidPage() {
  return <Suspense fallback={null}><Samtale /></Suspense>
}
