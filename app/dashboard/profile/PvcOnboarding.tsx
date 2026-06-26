'use client'

// Self-serve Professional Voice Cloning (PVC) — premium stemmekvalitet.
// Flyt: start → last opp/ta opp ≥30 min lyd → verifisering (les frasen) → trening
// (2–6 t) → ferdig. Status hentes fra /api/avatar/pvc/status.

import { useEffect, useRef, useState } from 'react'

type Phase = 'loading' | 'none' | 'samples' | 'verifying' | 'training' | 'ready' | 'failed'
const MIN_MINUTES = 30

export default function PvcOnboarding() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [sampleCount, setSampleCount] = useState(0)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [goVerify, setGoVerify] = useState(false)
  const [captcha, setCaptcha] = useState<{ text?: string; image?: string; data?: unknown } | null>(null)

  // lyd-opptaker
  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const [recording, setRecording] = useState(false)
  const [recTarget, setRecTarget] = useState<'sample' | 'verify' | null>(null)
  const [verifyBlob, setVerifyBlob] = useState<Blob | null>(null)

  async function refresh() {
    try {
      const d = await (await fetch('/api/avatar/pvc/status')).json()
      setPhase((d.status as Phase) || 'none')
      if (typeof d.sample_count === 'number') setSampleCount(d.sample_count)
    } catch { setPhase('none') }
  }
  useEffect(() => { refresh() }, [])

  // Poll mens trening pågår
  useEffect(() => {
    if (phase !== 'training') return
    const t = setInterval(refresh, 30000)
    return () => clearInterval(t)
  }, [phase])

  async function start() {
    setBusy('Starter…'); setErr('')
    try {
      const r = await fetch('/api/avatar/pvc/create', { method: 'POST' })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setPhase('samples')
    } catch (e) { setErr(msg(e)) } finally { setBusy('') }
  }

  async function uploadSample(blob: Blob, filename: string) {
    const u = await fetch('/api/avatar/pvc/sample-url', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename }),
    })
    const ud = await u.json(); if (!u.ok) throw new Error(ud.error)
    const put = await fetch(ud.url, { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type || 'audio/webm' } })
    if (!put.ok) throw new Error('Opplasting feilet')
    const a = await fetch('/api/avatar/pvc/add-sample', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: ud.path }),
    })
    const ad = await a.json(); if (!a.ok) throw new Error(ad.error)
    setSampleCount(ad.sample_count)
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setBusy(`Laster opp ${files.length} fil(er)…`); setErr('')
    try { for (const f of files) await uploadSample(f, f.name) }
    catch (e) { setErr(msg(e)) } finally { setBusy('') }
  }

  // opptaker
  async function startRec(target: 'sample' | 'verify') {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType: mime })
      recRef.current = mr
      mr.ondataavailable = ev => { if (ev.data.size) chunksRef.current.push(ev.data) }
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime })
        streamRef.current?.getTracks().forEach(t => t.stop())
        if (target === 'verify') { setVerifyBlob(blob); return }
        setBusy('Laster opp opptak…')
        try { await uploadSample(blob, `opptak-${Date.now()}.webm`) } catch (e) { setErr(msg(e)) } finally { setBusy('') }
      }
      mr.start(); setRecording(true); setRecTarget(target)
    } catch { setErr('Får ikke tilgang til mikrofon.') }
  }
  function stopRec() {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
    setRecording(false); setRecTarget(null)
  }

  async function loadCaptcha() {
    setBusy('Henter verifisering…'); setErr('')
    try { setCaptcha(await (await fetch('/api/avatar/pvc/captcha')).json()) }
    catch (e) { setErr(msg(e)) } finally { setBusy('') }
  }
  async function submitVerify() {
    if (!verifyBlob) return
    setBusy('Sender verifisering…'); setErr('')
    try {
      const fd = new FormData(); fd.append('recording', verifyBlob, 'verification.webm')
      const r = await fetch('/api/avatar/pvc/captcha', { method: 'POST', body: fd })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setVerifyBlob(null); await refresh()
    } catch (e) { setErr(msg(e)) } finally { setBusy('') }
  }
  async function train() {
    setBusy('Starter trening…'); setErr('')
    try {
      const r = await fetch('/api/avatar/pvc/train', { method: 'POST' })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setPhase('training')
    } catch (e) { setErr(msg(e)) } finally { setBusy('') }
  }

  const box: React.CSSProperties = { border: '1px solid var(--border, #e5e5e5)', borderRadius: 12, padding: 16, marginTop: 12 }
  const recBtn = (t: 'sample' | 'verify', label: string) =>
    recording && recTarget === t
      ? <button onClick={stopRec} style={btn('#16a34a')}>■ Stopp</button>
      : <button onClick={() => startRec(t)} disabled={recording} style={btn('#dc2626')}>● {label}</button>

  if (phase === 'loading') return <div style={box}><p style={s13}>Laster…</p></div>

  if (phase === 'ready') return (
    <div style={box}>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#16a34a' }}>✅ Din proff-stemme (PVC) er klar</p>
      <p style={{ ...s13, marginTop: 4 }}>Den brukes nå som din stemme i video og digital visning — høyeste kvalitet.</p>
    </div>
  )

  if (phase === 'training') return (
    <div style={box}>
      <p style={{ fontSize: 14, fontWeight: 600 }}>⏳ Trener proff-stemmen din</p>
      <p style={{ ...s13, marginTop: 4 }}>Dette tar typisk 2–6 timer. Du kan lukke siden — vi binder stemmen automatisk når den er ferdig. ({sampleCount} lydklipp brukt)</p>
    </div>
  )

  if (phase === 'none') return (
    <div style={box}>
      <p style={{ fontSize: 14, fontWeight: 700 }}>Proff-stemme (PVC) — høyeste kvalitet</p>
      <p style={{ ...s13, margin: '4px 0 12px' }}>
        En profesjonell stemmeklone trenes på <strong>minst 30 minutter</strong> (ideelt 1–3 timer) med din egen lyd, og gir markant bedre kvalitet enn standard. Du kan ta opp i nettleseren eller laste opp lydfiler. Til slutt gjør du en kort verifisering.
      </p>
      <label style={consentRow}>
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
        <span>Jeg samtykker til at min stemme klones profesjonelt for ReelHome, og bekrefter at jeg eier stemmen.</span>
      </label>
      <button onClick={start} disabled={!consent || !!busy} style={btn(consent ? '#2563eb' : '#9ca3af')}>{busy || 'Start proff-stemme'}</button>
      {err && <p style={errS}>{err}</p>}
    </div>
  )

  // phase 'samples' eller 'verifying'
  const enoughForVerify = sampleCount > 0
  return (
    <div style={box}>
      <p style={{ fontSize: 14, fontWeight: 700 }}>Proff-stemme (PVC)</p>

      {!goVerify && phase === 'samples' && (
        <>
          <p style={{ ...s13, margin: '4px 0 10px' }}>
            Last opp eller ta opp lyd til du har <strong>minst {MIN_MINUTES} min</strong> totalt. Snakk naturlig, som i en visning. Lydklipp lagt til: <strong>{sampleCount}</strong>.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {recBtn('sample', 'Ta opp lyd')}
            <label style={{ ...btn('#6b7280'), display: 'inline-block' }}>
              Last opp lydfiler
              <input type="file" accept="audio/*" multiple onChange={onFiles} style={{ display: 'none' }} />
            </label>
            <button onClick={() => setGoVerify(true)} disabled={!enoughForVerify} style={btn(enoughForVerify ? '#2563eb' : '#9ca3af')}>
              Gå til verifisering →
            </button>
          </div>
        </>
      )}

      {(goVerify || phase === 'verifying') && (
        <>
          <p style={{ ...s13, margin: '4px 0 10px' }}>
            <strong>Verifisering.</strong> Hent utfordringen under, og les den høyt mens du tar opp — med samme stemme og utstyr som i opptakene.
          </p>
          <button onClick={loadCaptcha} disabled={!!busy} style={btn('#2563eb')}>{busy || 'Hent verifisering'}</button>
          {captcha && (
            <div style={{ ...box, marginTop: 10, background: '#f8f8f8' }}>
              {captcha.text && <p style={{ fontSize: 15, fontWeight: 600 }}>«{captcha.text}»</p>}
              {captcha.image && <img src={captcha.image} alt="captcha" style={{ maxWidth: '100%' }} />}
              {!captcha.text && !captcha.image && <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(captcha.data ?? captcha, null, 2)}</pre>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
            {recBtn('verify', 'Ta opp verifisering')}
            {verifyBlob && <button onClick={submitVerify} disabled={!!busy} style={btn('#16a34a')}>{busy || 'Send verifisering'}</button>}
          </div>
          {phase === 'verifying' && (
            <div style={{ marginTop: 12 }}>
              <p style={{ ...s13, color: '#16a34a', fontWeight: 600 }}>✅ Verifisert. Klar for trening.</p>
              <button onClick={train} disabled={!!busy} style={{ ...btn('#2563eb'), marginTop: 6 }}>{busy || 'Start trening'}</button>
            </div>
          )}
          {phase === 'samples' && <button onClick={() => setGoVerify(false)} style={{ ...btn('#6b7280'), marginTop: 10 }}>← Tilbake til opptak</button>}
        </>
      )}
      {err && <p style={errS}>{err}</p>}
    </div>
  )
}

const s13: React.CSSProperties = { fontSize: 13, color: '#555' }
const errS: React.CSSProperties = { color: '#dc2626', fontSize: 13, marginTop: 8 }
const consentRow: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-start', margin: '0 0 12px', fontSize: 13, color: '#333' }
function btn(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
}
function msg(e: unknown) { return e instanceof Error ? e.message : String(e) }
