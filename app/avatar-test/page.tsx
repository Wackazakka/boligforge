'use client'

// Enkel testside for avatar-hjernen (/api/avatar/ask) — Fase 1.
// Velg en eiendom, still spørsmål, se svaret avataren ville sagt.
// Blir senere erstattet av kjøper-klienten (B5) + Avatar-fanen (A3).

import { useEffect, useRef, useState } from 'react'

type Property = { id: string; address: string | null; price: number | null }
type Turn = { role: 'user' | 'assistant'; content: string; ms?: number; lead?: boolean; sources?: number }

export default function AvatarTestPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [propertyId, setPropertyId] = useState('')
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/properties/list')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setProperties(d)
          if (d.length > 0) setPropertyId(d[0].id)
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

      <label style={{ fontSize: 13, fontWeight: 600 }}>Eiendom</label>
      <select
        value={propertyId}
        onChange={e => { setPropertyId(e.target.value); setTurns([]) }}
        style={{ display: 'block', width: '100%', padding: 10, margin: '6px 0 16px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 }}
      >
        {properties.map(p => (
          <option key={p.id} value={p.id}>
            {p.address ?? p.id}{p.price ? ` — ${p.price.toLocaleString('nb-NO')} kr` : ''}
          </option>
        ))}
      </select>

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
