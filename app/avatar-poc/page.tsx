'use client'

import { useRef, useState } from 'react'

// LiveAvatar fase 0 latency-PoC. Ikke en del av produktet — kun for å måle
// tid fra vi ber avataren si en tekst (repeat) til den faktisk begynner å snakke.

const TEST_SETNING =
  'Hei! Denne boligen har en størrelse på hundre og femten kvadratmeter, fordelt på fire rom. Tilstandsrapporten viser ingen alvorlige avvik.'

type Log = { t: string; msg: string }

export default function AvatarPocPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null)
  const speakT0 = useRef<number | null>(null)

  const [status, setStatus] = useState('Ikke startet')
  const [streamReadyMs, setStreamReadyMs] = useState<number | null>(null)
  const [latencies, setLatencies] = useState<number[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [listening, setListening] = useState(false)
  const [transcripts, setTranscripts] = useState<{ who: string; text: string }[]>([])

  function log(msg: string) {
    const t = new Date().toLocaleTimeString('nb-NO')
    setLogs(prev => [{ t, msg }, ...prev].slice(0, 30))
  }

  async function start() {
    try {
      setStatus('Henter token…')
      const startedAt = performance.now()
      const res = await fetch('/api/avatar/poc-token', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'token-feil')
      log(`Token OK · avatar: ${data.avatar?.name}`)

      setStatus('Laster SDK…')
      const { LiveAvatarSession, SessionEvent, AgentEventsEnum } = await import(
        '@heygen/liveavatar-web-sdk'
      )

      const session = new LiveAvatarSession(data.session_token, { voiceChat: true })
      sessionRef.current = session

      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        const ms = Math.round(performance.now() - startedAt)
        setStreamReadyMs(ms)
        setStatus('Avatar klar — strøm aktiv')
        log(`STREAM_READY etter ${ms} ms fra start`)
        if (videoRef.current) {
          session.attach(videoRef.current)
          // svart-video-fiks: eksplisitt play() etter attach (autoplay-policy)
          videoRef.current.play().catch(err => log('video.play() avvist: ' + err?.message))
        }
      })
      session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => log('USER_SPEAK_STARTED — mikrofonen hører deg'))
      session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => log('USER_SPEAK_ENDED'))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session.on(AgentEventsEnum.USER_TRANSCRIPTION, (e: any) => {
        const text = e?.text ?? JSON.stringify(e)
        log(`USER_TRANSCRIPTION: "${text}"`)
        setTranscripts(prev => [{ who: 'Du', text }, ...prev].slice(0, 20))
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (e: any) => {
        const text = e?.text ?? ''
        if (text) setTranscripts(prev => [{ who: 'Avatar', text }, ...prev].slice(0, 20))
      })
      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
        if (speakT0.current != null) {
          const ms = Math.round(performance.now() - speakT0.current)
          speakT0.current = null
          setLatencies(prev => [ms, ...prev])
          log(`AVATAR_SPEAK_STARTED — latency ${ms} ms`)
        }
      })
      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => log('AVATAR_SPEAK_ENDED'))
      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        setStatus('Frakoblet')
        log('SESSION_DISCONNECTED')
      })

      setStatus('Starter sesjon…')
      await session.start()
      log('session.start() ferdig')
    } catch (e) {
      setStatus('Feil')
      log('FEIL: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function speak() {
    const s = sessionRef.current
    if (!s) return
    speakT0.current = performance.now()
    log('repeat() kalt — venter på tale…')
    try {
      s.repeat(TEST_SETNING)
    } catch (e) {
      log('repeat-feil: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function toggleListening() {
    const s = sessionRef.current
    if (!s) return
    try {
      if (listening) {
        s.stopListening()
        setListening(false)
        log('stopListening()')
      } else {
        s.startListening()
        setListening(true)
        log('startListening() — snakk til avataren nå')
      }
    } catch (e) {
      log('lytte-feil: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function stop() {
    try {
      await sessionRef.current?.stop()
    } catch {}
    setStatus('Stoppet')
    log('session.stop()')
  }

  const avg =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null

  return (
    <div style={{ maxWidth: 880, margin: '40px auto', fontFamily: 'system-ui', padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>LiveAvatar — Fase 0 latency-PoC</h1>
      <p style={{ color: '#555', fontSize: 14 }}>
        Måler tid fra <code>repeat(tekst)</code> til avataren begynner å snakke
        (<code>AVATAR_SPEAK_STARTED</code>). Status: <strong>{status}</strong>
      </p>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button onClick={start} style={btn('#2563eb')}>1. Start sesjon</button>
        <button onClick={speak} style={btn('#16a34a')}>2. Si testsetning</button>
        <button onClick={toggleListening} style={btn(listening ? '#dc2626' : '#9333ea')}>
          {listening ? '🎙 Stopp lytting' : '3. 🎙 Start lytting'}
        </button>
        <button onClick={stop} style={btn('#6b7280')}>Stopp</button>
      </div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', maxWidth: 520, background: '#000', borderRadius: 8, aspectRatio: '16/9' }}
      />

      <div style={{ display: 'flex', gap: 24, margin: '16px 0', fontSize: 14 }}>
        <div>Tid til strøm klar: <strong>{streamReadyMs != null ? `${streamReadyMs} ms` : '—'}</strong></div>
        <div>Snitt tale-latency: <strong>{avg != null ? `${avg} ms` : '—'}</strong></div>
        <div>Målinger: <strong>{latencies.length > 0 ? latencies.map(l => `${l}ms`).join(', ') : '—'}</strong></div>
      </div>

      {transcripts.length > 0 && (
        <div style={{ margin: '12px 0', padding: 12, background: '#f3f4f6', borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Transkripsjon (nyeste øverst)</div>
          <ul style={{ fontSize: 13, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
            {transcripts.map((tr, i) => (
              <li key={i}><strong>{tr.who}:</strong> {tr.text}</li>
            ))}
          </ul>
        </div>
      )}

      <details open>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: '#555' }}>Hendelseslogg</summary>
        <ul style={{ fontSize: 12, fontFamily: 'monospace', lineHeight: 1.6 }}>
          {logs.map((l, i) => (
            <li key={i}>{l.t} — {l.msg}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function btn(bg: string): React.CSSProperties {
  return {
    background: bg, color: '#fff', border: 'none', borderRadius: 6,
    padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  }
}
