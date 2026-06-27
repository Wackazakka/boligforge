'use client'

// Digital visning — interaktiv avatar via D-ID Streams (WebRTC).
// Flow: opprett stream → WebRTC handshake → avataren snakker via ElevenLabs-stemme.
// STT: nettleserens SpeechRecognition (no-NO) — bedre norsk enn D-IDs innebygde.
// RAG + Claude: /api/avatar/ask (uendret).

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import LiveAvatarView from './LiveAvatarView'
import { startUsageMeter, type UsageMeter } from '../../lib/avatar/usageClient'

type Turn = { role: 'user' | 'assistant'; content: string; lead?: boolean }

type DIDSession = {
  stream_id: string
  session_id: string
  voice_id: string | null
}

function Samtale({ address }: { address: string }) {
  const params = useSearchParams()
  const propertyId = params.get('property') ?? ''

  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const meterRef = useRef<UsageMeter | null>(null)
  const didRef = useRef<DIDSession | null>(null)
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const finalTextRef = useRef('')
  const micActiveRef = useRef(false)
  const busyRef = useRef(false)

  const [status, setStatus] = useState<'idle' | 'kobler' | 'klar' | 'lytter' | 'tenker' | 'snakker' | 'avsluttet' | 'feil'>('idle')
  const [turns, setTurns] = useState<Turn[]>([])
  const [errMsg, setErrMsg] = useState('')
  const [micOn, setMicOn] = useState(false)
  const [interim, setInterim] = useState('')
  const [typed, setTyped] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)


  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, status])

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
    rec.onend = () => {
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

      // Send svaret til D-ID — avataren snakker
      if (didRef.current) {
        await fetch('/api/avatar/did-talk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stream_id: didRef.current.stream_id,
            session_id: didRef.current.session_id,
            text: d.answer,
            voice_id: didRef.current.voice_id,
          }),
        })
      }
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
      // 1. Opprett D-ID stream (henter meglerbilde + stemme fra profil)
      const streamRes = await fetch(`/api/avatar/did-stream?propertyId=${propertyId}`, { method: 'POST' })
      const streamData = await streamRes.json()
      if (!streamRes.ok) throw new Error(streamData.error || 'Kunne ikke opprette stream')

      const { stream_id, session_id, offer, ice_servers, voice_id } = streamData
      didRef.current = { stream_id, session_id, voice_id }

      // 2. Opprett WebRTC-tilkobling
      const pc = new RTCPeerConnection({ iceServers: ice_servers })
      pcRef.current = pc

      // Video-spor fra D-ID → videoelementet
      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0]
        }
      }

      // Data-kanal fra D-ID. VIKTIG: D-ID sender meldinger som STRENGER på formen
      // "event/navn:payload" (f.eks. "stream/ready"), IKKE JSON. Tidligere kjørte
      // koden JSON.parse → kastet på hver melding → stream/ready ble aldri fanget
      // og status hang på «kobler». Vi splitter på ':' og logger rått for innsikt.
      pc.ondatachannel = (event) => {
        const channel = event.channel
        channel.onmessage = (msg) => {
          const raw = typeof msg.data === 'string' ? msg.data : ''
          const eventType = raw.split(':')[0]
          if (eventType === 'stream/ready') {
            setStatus('klar')
            if (!meterRef.current) meterRef.current = startUsageMeter(propertyId, 'did')
            sendGreeting(stream_id, session_id, voice_id)
          } else if (eventType === 'stream/started') {
            setStatus('snakker')
          } else if (eventType === 'stream/done' || eventType === 'talk/ended') {
            busyRef.current = false
            setStatus(micActiveRef.current ? 'lytter' : 'klar')
          } else if (eventType === 'stream/error') {
            console.error('[d-id] stream error:', raw)
          }
        }
      }

      // ICE-kandidater sendes til D-ID via server
      pc.onicecandidate = async (event) => {
        if (!event.candidate) return
        await fetch('/api/avatar/did-ice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stream_id,
            session_id,
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          }),
        })
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          meterRef.current?.stop(); meterRef.current = null
          setStatus('avsluttet')
        }
      }

      // 3. WebRTC-handshake: sett D-IDs offer som remote description
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      // 4. Send SDP-svar til D-ID
      await fetch('/api/avatar/did-sdp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream_id, session_id, answer: { type: answer.type, sdp: answer.sdp } }),
      })

      // stream/ready-eventet setter status til 'klar' og sender hilsenen

    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setStatus('feil')
    }
  }

  async function sendGreeting(stream_id: string, session_id: string, voice_id: string | null) {
    const greeting = `Hei og velkommen til digital visning${address ? ' av ' + address : ''}! Jeg kan svare på det meste fra salgsoppgaven og tilstandsrapporten. Trykk på mikrofonknappen, still spørsmålet ditt, og trykk ferdig når du er klar.`
    await fetch('/api/avatar/did-talk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stream_id, session_id, text: greeting, voice_id }),
    })
  }

  function toggleMic() {
    if (!micOn) {
      micActiveRef.current = true
      if (startRecognition()) {
        setMicOn(true)
        setStatus('lytter')
      }
    } else {
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
    micActiveRef.current = false
    setMicOn(false)
    pauseListening()
    try { pcRef.current?.close() } catch {}
    if (didRef.current) {
      await fetch('/api/avatar/did-stream', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(didRef.current),
      })
    }
    didRef.current = null
    pcRef.current = null
    meterRef.current?.stop(); meterRef.current = null
    setStatus('avsluttet')
  }

  useEffect(() => () => { meterRef.current?.stop() }, [])

  const statusLabel: Record<typeof status, string> = {
    idle: 'Klar til å starte',
    kobler: 'Kobler til megler…',
    klar: 'Tilkoblet',
    lytter: '🎙 Lytter — trykk «Ferdig» når du har stilt spørsmålet',
    tenker: '🧠 Tenker…',
    snakker: '💬 Avataren snakker',
    avsluttet: 'Samtalen avsluttet — trykk «Start ny samtale» for å fortsette',
    feil: 'Noe gikk galt',
  }

  return (
    <div style={{ maxWidth: 880, margin: '24px auto', padding: 16, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Digital visning{address ? ` av ${address}` : ''}</h1>
      <p style={{ color: '#555', fontSize: 13, margin: '4px 0 12px' }}>
        Status: <strong>{statusLabel[status]}</strong>
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 380px', minWidth: 320 }}>
          <video ref={videoRef} autoPlay playsInline
            style={{ width: '100%', background: '#000', borderRadius: 12, aspectRatio: '16/9' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {status === 'idle' && (
              <button onClick={start} style={btn('#2563eb')}>Start samtale</button>
            )}
            {status !== 'idle' && status !== 'avsluttet' && status !== 'kobler' && status !== 'feil' && status !== 'tenker' && (
              <button onClick={toggleMic} style={btn(micOn ? '#16a34a' : '#9333ea')}>
                {micOn ? '✅ Ferdig — send spørsmålet' : status === 'snakker' ? '🎙 Still nytt spørsmål' : '🎙 Trykk og still spørsmålet'}
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
                onKeyDown={e => {
                  if (e.key === 'Enter' && typed.trim() && !busyRef.current) {
                    handleQuestion(typed)
                    setTyped('')
                  }
                }}
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

// Velger avatar-leverandør per bolig: liveavatar (video) eller did (foto).
function Router() {
  const params = useSearchParams()
  const propertyId = params.get('property') ?? ''
  const [provider, setProvider] = useState<'did' | 'liveavatar' | 'none' | null>(null)
  const [address, setAddress] = useState('')
  useEffect(() => {
    if (!propertyId) { setProvider('did'); return }
    fetch(`/api/avatar/provider?propertyId=${propertyId}`)
      .then(r => r.json())
      .then(d => {
        setProvider(d.provider === 'liveavatar' ? 'liveavatar' : d.provider === 'none' ? 'none' : 'did')
        setAddress(d.address || '')
      })
      .catch(() => setProvider('did'))
  }, [propertyId])
  if (provider === null) return <p style={{ textAlign: 'center', marginTop: 40, color: '#777' }}>Laster…</p>
  if (provider === 'none') return <p style={{ textAlign: 'center', marginTop: 40, color: '#777' }}>Digital visning er ikke tilgjengelig for denne boligen akkurat nå.</p>
  const street = address.split(',')[0].trim()
  return provider === 'liveavatar' ? <LiveAvatarView propertyId={propertyId} address={street} /> : <Samtale address={street} />
}

export default function AvatarSamtalePage() {
  return <Suspense fallback={null}><Router /></Suspense>
}
