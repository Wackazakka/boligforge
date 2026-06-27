'use client'

// Digital visning via LiveAvatar (FULL-modus). LiveAvatar gjør STT + TTS + render
// og kaller vår Claude/RAG-adapter for svarene (per-bolig via dynamic_variables).
// Klienten styrer bare sesjon + UI; samtalen flyter gjennom adapteren automatisk.

import { useEffect, useRef, useState } from 'react'
import { startUsageMeter, type UsageMeter } from '../../lib/avatar/usageClient'

type Turn = { who: 'user' | 'avatar'; text: string }
type Status = 'idle' | 'kobler' | 'klar' | 'lytter' | 'snakker' | 'avsluttet' | 'feil'

export default function LiveAvatarView({ propertyId, address }: { propertyId: string; address: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null)
  const meterRef = useRef<UsageMeter | null>(null)
  const avatarOpenRef = useRef(false)
  const [status, setStatus] = useState<Status>('idle')
  const [turns, setTurns] = useState<Turn[]>([])
  const [errMsg, setErrMsg] = useState('')
  const [micOn, setMicOn] = useState(false)
  const [typed, setTyped] = useState('')

  async function start() {
    setStatus('kobler')
    setErrMsg('')
    try {
      const res = await fetch(`/api/avatar/liveavatar-token?propertyId=${propertyId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kunne ikke starte')

      const { LiveAvatarSession, SessionEvent, AgentEventsEnum } = await import('@heygen/liveavatar-web-sdk')
      const session = new LiveAvatarSession(data.session_token, { voiceChat: true })
      sessionRef.current = session

      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        setStatus('klar')
        if (!meterRef.current) meterRef.current = startUsageMeter(propertyId, 'liveavatar')
        if (videoRef.current) {
          session.attach(videoRef.current)
          videoRef.current.play().catch(() => {})
        }
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session.on(AgentEventsEnum.USER_TRANSCRIPTION, (e: any) => {
        const text = (e?.text ?? '').trim()
        avatarOpenRef.current = false
        if (text) setTurns(prev => [...prev, { who: 'user', text }])
      })
      // Tekst i takt med talen: bygg avatar-svaret fra streamede chunks mens han
      // snakker, og finaliser med full transkripsjon. (AVATAR_TRANSCRIPTION alene
      // kom først etter at han var ferdig å si det.)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION_CHUNK, (e: any) => {
        const chunk = e?.text ?? ''
        if (!chunk) return
        setTurns(prev => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (avatarOpenRef.current && last?.who === 'avatar') {
            copy[copy.length - 1] = { ...last, text: last.text + chunk }
            return copy
          }
          return [...copy, { who: 'avatar', text: chunk }]
        })
        avatarOpenRef.current = true
      })
      // Bevisst: vi lytter IKKE på AVATAR_TRANSCRIPTION (full tekst etter talen) —
      // chunk-strømmen over gir allerede komplett tekst i takt med talen, og å ta
      // begge ga dobbel boble.
      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => { avatarOpenRef.current = false; setStatus('snakker') })
      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => setStatus(s => (s === 'snakker' ? 'klar' : s)))
      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        meterRef.current?.stop(); meterRef.current = null
        setStatus('avsluttet')
      })

      await session.start()
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e))
      setStatus('feil')
    }
  }

  async function toggleMic() {
    const s = sessionRef.current
    if (!s) return
    try {
      if (micOn) {
        s.stopListening()
        s.voiceChat?.stop?.()
        setMicOn(false)
      } else {
        // Trykk på mikrofonen avbryter avataren hvis han snakker
        try { s.interrupt() } catch {}
        await s.voiceChat.start()
        if (s.voiceChat.isMuted) await s.voiceChat.unmute()
        s.startListening()
        setMicOn(true)
        setStatus('lytter')
      }
    } catch (e) {
      setErrMsg(`Mikrofon-feil: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  function sendTyped() {
    const t = typed.trim()
    if (!t || !sessionRef.current) return
    setTyped('')
    try { sessionRef.current.message(t) } catch {}
  }

  async function end() {
    try { await sessionRef.current?.stop() } catch {}
    sessionRef.current = null
    meterRef.current?.stop(); meterRef.current = null
    setMicOn(false)
    setStatus('avsluttet')
  }

  // Stopp måleren hvis komponenten unmountes mid-sesjon
  useEffect(() => () => { meterRef.current?.stop() }, [])

  const statusLabel: Record<Status, string> = {
    idle: 'Klar til å starte', kobler: 'Kobler til megler…', klar: 'Tilkoblet',
    lytter: '🎙 Lytter — bare snakk', snakker: '💬 Avataren snakker',
    avsluttet: 'Samtalen avsluttet', feil: 'Noe gikk galt',
  }

  return (
    <div style={{ maxWidth: 880, margin: '24px auto', padding: 16, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Digital visning{address ? ` av ${address}` : ''}</h1>
      <p style={{ color: '#555', fontSize: 13, margin: '4px 0 12px' }}>
        Status: <strong>{statusLabel[status]}</strong>
      </p>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#1e40af', lineHeight: 1.5, margin: '0 0 14px' }}>
        <strong>Slik gjør du:</strong> Trykk <strong>«Snakk med avataren»</strong> og still spørsmålet. <strong>Sjekk at det du sa dukker opp riktig i transkripsjonen til høyre</strong> før du trykker stopp — da vet du at han oppfattet spørsmålet. Snakker han for lenge, trykk bare <strong>«Snakk med avataren»</strong> igjen — da stopper han og hører på deg.
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 380px', minWidth: 320 }}>
          <video ref={videoRef} autoPlay playsInline
            style={{ width: '100%', background: '#000', borderRadius: 12, aspectRatio: '16/9' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {status === 'idle' && <button onClick={start} style={btn('#2563eb')}>Start samtale</button>}
            {status !== 'idle' && status !== 'avsluttet' && status !== 'kobler' && status !== 'feil' && (
              <button onClick={toggleMic} style={btn(micOn ? '#16a34a' : '#9333ea')}>
                {micOn ? '✅ Stopp mikrofon' : '🎙 Snakk med avataren'}
              </button>
            )}
            {status !== 'idle' && status !== 'avsluttet' && (
              <button onClick={end} style={btn('#6b7280')}>Avslutt samtalen</button>
            )}
            {(status === 'avsluttet' || status === 'feil') && (
              <button onClick={() => window.location.reload()} style={btn('#2563eb')}>Start ny samtale</button>
            )}
          </div>
          {errMsg && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{errMsg}</p>}
          {status !== 'idle' && status !== 'avsluttet' && status !== 'kobler' && status !== 'feil' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={typed} onChange={e => setTyped(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendTyped() }}
                placeholder="…eller skriv spørsmålet her"
                style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 13 }} />
            </div>
          )}
        </div>
        <div style={{ flex: '1 1 320px', minWidth: 300, border: '1px solid #ddd', borderRadius: 12, padding: 14, maxHeight: 480, overflowY: 'auto', background: '#fafafa' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Samtale</div>
          {turns.length === 0 && <p style={{ fontSize: 13, color: '#999' }}>Transkripsjonen vises her.</p>}
          {turns.map((t, i) => (
            <div key={i} style={{ marginBottom: 10, textAlign: t.who === 'user' ? 'right' : 'left' }}>
              <div style={{
                display: 'inline-block', maxWidth: '90%', padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                background: t.who === 'user' ? '#2563eb' : '#fff', color: t.who === 'user' ? '#fff' : '#111',
                border: t.who === 'user' ? 'none' : '1px solid #e5e5e5',
              }}>{t.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function btn(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
}
