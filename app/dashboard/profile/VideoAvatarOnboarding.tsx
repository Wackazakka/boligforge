'use client'

// Onboarding for premium video-avatar (LiveAvatar). Megler tar opp ~2 min video i
// nettleseren (kamera+mic) ELLER laster opp en fil → lagres → vi lager avataren.
// Status: none (opptak) → pending (venter på avatar) → ready (aktiv).

import { useEffect, useRef, useState } from 'react'

type Status = 'loading' | 'none' | 'pending' | 'ready'

export default function VideoAvatarOnboarding() {
  const previewRef = useRef<HTMLVideoElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [status, setStatus] = useState<Status>('loading')
  const [consent, setConsent] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [blobUrl, setBlobUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch('/api/avatar/onboarding/status').then(r => r.json())
      .then(d => setStatus(d.status === 'ready' ? 'ready' : d.status === 'pending' ? 'pending' : 'none'))
      .catch(() => setStatus('none'))
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  async function startCamera() {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280 }, audio: true })
      streamRef.current = stream
      setCameraOn(true)
      if (previewRef.current) { previewRef.current.srcObject = stream; previewRef.current.muted = true; await previewRef.current.play().catch(() => {}) }
    } catch {
      setErr('Får ikke tilgang til kamera/mikrofon. Tillat det i nettleseren — eller last opp en videofil i stedet.')
    }
  }

  function startRecording() {
    const stream = streamRef.current
    if (!stream) return
    chunksRef.current = []
    const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4'
    const mr = new MediaRecorder(stream, { mimeType: mime })
    recorderRef.current = mr
    mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const b = new Blob(chunksRef.current, { type: mime })
      setBlob(b); setBlobUrl(URL.createObjectURL(b))
    }
    mr.start()
    setRecording(true); setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    streamRef.current?.getTracks().forEach(t => t.stop())
    setCameraOn(false)
  }

  function reset() {
    setBlob(null); setBlobUrl(''); setErr('')
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setBlob(f); setBlobUrl(URL.createObjectURL(f)) }
  }

  async function submit() {
    if (!blob || !consent) return
    setUploading(true); setErr('')
    try {
      const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('quicktime') ? 'mov' : 'webm'
      const r = await fetch(`/api/avatar/onboarding/upload-url?ext=${ext}`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Klarte ikke å starte opplasting')
      const put = await fetch(d.url, { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type } })
      if (!put.ok) throw new Error('Opplasting av videoen feilet')
      const c = await fetch('/api/avatar/onboarding/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consent: true }),
      })
      if (!c.ok) throw new Error('Fullføring feilet')
      setStatus('pending')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setUploading(false) }
  }

  const box: React.CSSProperties = { border: '1px solid var(--border, #e5e5e5)', borderRadius: 12, padding: 16, marginTop: 12 }
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`

  if (status === 'loading') return <div style={box}><p style={{ fontSize: 13, color: '#777' }}>Laster…</p></div>

  if (status === 'ready') return (
    <div style={box}>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#16a34a' }}>✅ Din video-avatar er aktiv</p>
      <p style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Interessenter ser deg som en naturtro video-avatar under digital visning.</p>
    </div>
  )

  if (status === 'pending') return (
    <div style={box}>
      <p style={{ fontSize: 14, fontWeight: 600 }}>⏳ Videoen din er mottatt</p>
      <p style={{ fontSize: 13, color: '#555', marginTop: 4 }}>Vi lager video-avataren din nå. Du får beskjed når den er klar (vanligvis innen kort tid).</p>
    </div>
  )

  return (
    <div style={box}>
      <p style={{ fontSize: 14, fontWeight: 700 }}>Premium: video-avatar</p>
      <p style={{ fontSize: 13, color: '#555', margin: '4px 0 12px' }}>
        Ta opp ca. <strong>2 minutter</strong> der du ser rolig inn i kameraet og snakker naturlig (f.eks. presenter deg selv og at du gleder deg til å vise frem boliger). God belysning og lite bakgrunnsstøy gir best resultat.
      </p>

      {!blob ? (
        <>
          <video ref={previewRef} autoPlay playsInline muted
            style={{ width: '100%', maxWidth: 420, background: '#000', borderRadius: 10, aspectRatio: '16/9', display: cameraOn ? 'block' : 'none' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {!cameraOn && <button onClick={startCamera} style={btn('#2563eb')}>📷 Start kamera</button>}
            {cameraOn && !recording && <button onClick={startRecording} style={btn('#dc2626')}>● Ta opp</button>}
            {recording && <button onClick={stopRecording} style={btn('#16a34a')}>■ Stopp ({mmss})</button>}
            <label style={{ ...btn('#6b7280'), display: 'inline-block' }}>
              Last opp fil i stedet
              <input type="file" accept="video/*" onChange={onFile} style={{ display: 'none' }} />
            </label>
          </div>
        </>
      ) : (
        <>
          <video src={blobUrl} controls playsInline style={{ width: '100%', maxWidth: 420, background: '#000', borderRadius: 10, aspectRatio: '16/9' }} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '12px 0', fontSize: 13, color: '#333' }}>
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
            <span>Jeg bekrefter at jeg er personen i opptaket, og samtykker til at min stemme og mitt ansikt klones til en digital avatar for ReelHome.</span>
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={submit} disabled={!consent || uploading} style={{ ...btn(consent ? '#16a34a' : '#9ca3af'), opacity: uploading ? 0.7 : 1 }}>
              {uploading ? 'Laster opp…' : 'Send inn'}
            </button>
            <button onClick={reset} style={btn('#6b7280')}>Ta på nytt</button>
          </div>
        </>
      )}
      {err && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{err}</p>}
    </div>
  )
}

function btn(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
}
