'use client'

// Enkel testside for avatar-hjernen (/api/avatar/ask) — Fase 1.
// Velg en eiendom, still spørsmål, se svaret avataren ville sagt.
// Blir senere erstattet av kjøper-klienten (B5) + Avatar-fanen (A3).

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Property = { id: string; address: string | null; price: number | null }
type AvatarDoc = { id: string; kind: string; filename: string; status: string; error: string | null; pages: number | null; created_at: string }

const DOC_KINDS = [
  { id: 'prospekt', label: 'Salgsoppgave / prospekt' },
  { id: 'tilstandsrapport', label: 'Tilstandsrapport (takst)' },
  { id: 'energiattest', label: 'Energiattest' },
  { id: 'vedlegg', label: 'Vedlegg' },
  { id: 'annet', label: 'Annet' },
]
type Turn = { role: 'user' | 'assistant'; content: string; ms?: number; lead?: boolean; sources?: number }

export default function AvatarTestPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [propertyId, setPropertyId] = useState('')
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const [docs, setDocs] = useState<AvatarDoc[]>([])
  const [docKind, setDocKind] = useState('tilstandsrapport')
  const [uploading, setUploading] = useState(false)
  const [docMsg, setDocMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadDocs(pid: string) {
    if (!pid) return
    const res = await fetch(`/api/avatar/documents?propertyId=${pid}`)
    if (res.ok) setDocs((await res.json()).documents ?? [])
  }

  const newPropRef = useRef<HTMLInputElement>(null)
  const [creatingProp, setCreatingProp] = useState(false)

  async function createPropertyFromPdf() {
    const file = newPropRef.current?.files?.[0]
    if (!file) { setDocMsg('Velg en salgsoppgave-PDF først'); return }
    setCreatingProp(true)
    setDocMsg('Oppretter eiendom fra salgsoppgaven…')
    try {
      const reg = await fetch('/api/avatar/property-from-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name }),
      })
      const regData = await reg.json()
      if (!reg.ok) throw new Error(regData.error)

      setDocMsg(`Laster opp ${(file.size / 1024 / 1024).toFixed(1)} MB…`)
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { error: upErr } = await supabase.storage.from('avatar-docs')
        .uploadToSignedUrl(regData.upload.path, regData.upload.token, file, { contentType: 'application/pdf' })
      if (upErr) throw new Error(upErr.message)

      setDocMsg('Bygger kunnskapsbase og henter boligfakta fra PDF-en…')
      const proc = await fetch('/api/avatar/documents/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: regData.documentId }),
      })
      const procData = await proc.json()
      if (!proc.ok) throw new Error(procData.error)
      setDocMsg(`✅ Eiendom opprettet: ${procData.extractedAddress ?? '(adresse ikke funnet)'} — ${procData.pages} sider → ${procData.chunks} biter`)

      // last eiendomslisten på nytt og velg den nye
      const list = await (await fetch('/api/properties/list')).json()
      if (Array.isArray(list)) {
        setProperties(list)
        setPropertyId(regData.propertyId)
        setTurns([])
        loadDocs(regData.propertyId)
      }
      if (newPropRef.current) newPropRef.current.value = ''
    } catch (e) {
      setDocMsg(`Feil: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setCreatingProp(false)
    }
  }

  async function uploadDoc() {
    const file = fileRef.current?.files?.[0]
    if (!file || !propertyId) return
    if (!file.name.toLowerCase().endsWith('.pdf')) { setDocMsg('Kun PDF støttes foreløpig'); return }
    setUploading(true)
    setDocMsg('Registrerer dokument…')
    try {
      // 1) registrer + få signert opplastings-URL
      const reg = await fetch('/api/avatar/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, kind: docKind, filename: file.name }),
      })
      const regData = await reg.json()
      if (!reg.ok) throw new Error(regData.error)

      // 2) last opp direkte til Storage (omgår serverens størrelsesgrense)
      setDocMsg(`Laster opp ${(file.size / 1024 / 1024).toFixed(1)} MB…`)
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { error: upErr } = await supabase.storage
        .from('avatar-docs')
        .uploadToSignedUrl(regData.upload.path, regData.upload.token, file, { contentType: 'application/pdf' })
      if (upErr) throw new Error(`Opplasting: ${upErr.message}`)

      // 3) prosesser (tekst → kunnskapsbase)
      setDocMsg('Bygger kunnskapsbase (tekst → søkbare biter)…')
      const proc = await fetch('/api/avatar/documents/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: regData.document.id }),
      })
      const procData = await proc.json()
      if (!proc.ok) throw new Error(procData.error)
      setDocMsg(`✅ Klar! ${procData.pages} sider → ${procData.chunks} søkbare biter`)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setDocMsg(`Feil: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setUploading(false)
      loadDocs(propertyId)
    }
  }

  useEffect(() => {
    fetch('/api/properties/list')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setProperties(d)
          if (d.length > 0) { setPropertyId(d[0].id); loadDocs(d[0].id) }
        } else setError(d.error || 'Kunne ikke hente eiendommer — er du innlogget?')
      })
      .catch(() => setError('Kunne ikke hente eiendommer'))
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns])

  async function ask() {
    const q = question.trim()
    if (!q || !propertyId || loading) return
    setQuestion('')
    setError('')
    setTurns(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)
    const t0 = performance.now()
    try {
      const history = turns.map(t => ({ role: t.role, content: t.content }))
      const res = await fetch('/api/avatar/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, question: q, history }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Ukjent feil')
      setTurns(prev => [...prev, {
        role: 'assistant', content: d.answer,
        ms: Math.round(performance.now() - t0),
        lead: d.leadCaptured, sources: d.sources?.length ?? 0,
      }])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', padding: 16, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Avatar-hjernen — test</h1>
      <p style={{ color: '#555', fontSize: 14, marginBottom: 16 }}>
        Skriv spørsmål som om du var en interessent på digital visning. Svaret er det avataren ville sagt høyt.
        Prøv også å si at du vil på visning — da skal den be om navnet ditt og registrere deg.
      </p>

      <div style={{ border: '1px dashed #2563eb', borderRadius: 10, padding: 12, marginBottom: 16, background: '#eff6ff' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>➕ Ny eiendom fra salgsoppgave</div>
        <p style={{ fontSize: 12, color: '#555', margin: '0 0 8px' }}>
          Last opp en salgsoppgave-PDF — eiendommen opprettes automatisk med adresse, pris og fakta hentet fra dokumentet.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={newPropRef} type="file" accept="application/pdf" style={{ fontSize: 13 }} />
          <button onClick={createPropertyFromPdf} disabled={creatingProp}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: creatingProp ? 0.6 : 1 }}>
            {creatingProp ? 'Oppretter…' : 'Opprett eiendom'}
          </button>
        </div>
      </div>

      <label style={{ fontSize: 13, fontWeight: 600 }}>Eiendom</label>
      {propertyId && (
        <a href={`/avatar-samtale?property=${propertyId}`}
          style={{ float: 'right', fontSize: 13, fontWeight: 600, color: '#9333ea', textDecoration: 'none' }}>
          🎥 Snakk med avataren →
        </a>
      )}
      <select
        value={propertyId}
        onChange={e => { setPropertyId(e.target.value); setTurns([]); loadDocs(e.target.value) }}
        style={{ display: 'block', width: '100%', padding: 10, margin: '6px 0 16px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 }}
      >
        {properties.map(p => (
          <option key={p.id} value={p.id}>
            {p.address ?? p.id}{p.price ? ` — ${p.price.toLocaleString('nb-NO')} kr` : ''}
          </option>
        ))}
      </select>

      <div style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16, marginBottom: 16, background: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
          📄 Kunnskapsbase for: {properties.find(p => p.id === propertyId)?.address ?? 'valgt eiendom'}
        </div>
        <p style={{ fontSize: 12, color: '#b45309', margin: '0 0 10px' }}>
          Dokumentene under tilhører eiendommen valgt øverst. Last kun opp dokumenter som gjelder denne boligen — bytt eiendom i nedtrekkslisten først hvis dokumentet gjelder en annen.
        </p>
        {docs.length === 0 ? (
          <p style={{ fontSize: 13, color: '#999', margin: '0 0 10px' }}>Ingen dokumenter ennå — last opp salgsoppgave/tilstandsrapport, så kan avataren svare på detaljspørsmål.</p>
        ) : (
          <ul style={{ fontSize: 13, margin: '0 0 10px', paddingLeft: 18 }}>
            {docs.map(d => (
              <li key={d.id} style={{ marginBottom: 4 }}>
                <strong>{d.filename}</strong> ({DOC_KINDS.find(k => k.id === d.kind)?.label ?? d.kind}) —{' '}
                {d.status === 'ready' && <span style={{ color: '#16a34a' }}>✅ klar{d.pages ? ` (${d.pages} sider)` : ''}</span>}
                {d.status === 'failed' && <span style={{ color: '#dc2626' }}>❌ feilet: {d.error}</span>}
                {(d.status === 'pending' || d.status === 'processing') && <span style={{ color: '#d97706' }}>⏳ {d.status}</span>}
                {' '}
                <button onClick={async () => { setDocMsg('Re-prosesserer…'); const r = await fetch('/api/avatar/documents/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: d.id }) }); const j = await r.json(); setDocMsg(r.ok ? `✅ Re-prosessert: ${j.pages} sider → ${j.chunks} biter` : `Feil: ${j.error}`); loadDocs(propertyId) }}
                  style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>re-prosesser</button>
                {' '}
                <button onClick={async () => { await fetch('/api/avatar/documents', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: d.id }) }); loadDocs(propertyId) }}
                  style={{ fontSize: 11, color: '#999', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>slett</button>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={docKind} onChange={e => setDocKind(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc', fontSize: 13 }}>
            {DOC_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <input ref={fileRef} type="file" accept="application/pdf" style={{ fontSize: 13 }} />
          <button onClick={uploadDoc} disabled={uploading}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: uploading ? 0.6 : 1 }}>
            {uploading ? 'Jobber…' : 'Last opp'}
          </button>
        </div>
        {docMsg && <p style={{ fontSize: 12, color: docMsg.startsWith('Feil') ? '#dc2626' : '#555', marginTop: 8 }}>{docMsg}</p>}
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16, minHeight: 220, maxHeight: 420, overflowY: 'auto', background: '#fafafa' }}>
        {turns.length === 0 && (
          <p style={{ color: '#999', fontSize: 14 }}>
            Eksempler: «Hva koster boligen?» · «Hvor mange soverom er det?» · «Når ble den bygget?» · «Jeg vil gjerne på visning»
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} style={{ marginBottom: 12, textAlign: t.role === 'user' ? 'right' : 'left' }}>
            <div style={{
              display: 'inline-block', maxWidth: '85%', padding: '10px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.5,
              background: t.role === 'user' ? '#2563eb' : '#fff',
              color: t.role === 'user' ? '#fff' : '#111',
              border: t.role === 'user' ? 'none' : '1px solid #e5e5e5',
            }}>
              {t.content}
              {t.role === 'assistant' && (
                <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
                  {t.ms} ms · {t.sources} dokumentutdrag brukt{t.lead ? ' · ✅ interessent registrert!' : ''}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <p style={{ color: '#999', fontSize: 13 }}>Avataren tenker…</p>}
        <div ref={bottomRef} />
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>Feil: {error}</p>}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="Still et spørsmål om boligen…"
          style={{ flex: 1, padding: '12px 14px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 }}
        />
        <button
          onClick={ask}
          disabled={loading || !question.trim()}
          style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          Spør
        </button>
      </div>
    </div>
  )
}
