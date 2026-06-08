'use client'
export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

const ACCENT = '#2563eb'
const input: React.CSSProperties = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px', color: '#111', fontSize: 15, outline: 'none', width: '100%' }
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }

function Recruit() {
  const sp = useSearchParams()
  const token = sp.get('t') ?? ''

  const [state, setState] = useState<'loading' | 'ok' | 'invalid'>('loading')
  const [managerName, setManagerName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [refCode, setRefCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ ref_url: string; emailSent: boolean } | null>(null)

  useEffect(() => {
    if (!token) { setState('invalid'); return }
    fetch(`/api/recruit?t=${encodeURIComponent(token)}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { if (d.ok) { setManagerName(d.manager_name); setState('ok') } else setState('invalid') })
      .catch(() => setState('invalid'))
  }, [token])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    const res = await fetch('/api/recruit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: token, name, email, ref_code: refCode }),
    })
    const d = await res.json()
    if (!res.ok) { setError(d.error ?? 'Noe gikk galt'); setBusy(false); return }
    setDone({ ref_url: d.ref_url, emailSent: d.emailSent })
    setBusy(false)
  }

  return (
    <Shell>
      {state === 'loading' && <p style={{ color: '#9ca3af' }}>Laster...</p>}

      {state === 'invalid' && (
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Ugyldig lenke</h2>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Denne rekrutteringslenken er ikke gyldig. Be salgssjefen din om en ny.</p>
        </div>
      )}

      {state === 'ok' && !done && (
        <div style={card}>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 900 }}>Bli ReelHome-selger</h1>
          <p style={{ color: '#6b7280', margin: '0 0 22px', fontSize: 15 }}>Du er invitert av <b style={{ color: '#111' }}>{managerName}</b>. Fyll ut, så får du din egen henvisningslenke og portal med en gang.</p>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label style={label}>Navn</label><input style={input} value={name} onChange={e => setName(e.target.value)} required placeholder="Ola Hansen" /></div>
            <div><label style={label}>E-post</label><input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="ola@example.com" /></div>
            <div>
              <label style={label}>Ønsket ref-kode</label>
              <input style={input} value={refCode} onChange={e => setRefCode(e.target.value)} required placeholder="hansen123" />
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9ca3af' }}>3–40 tegn: a–z, 0–9, bindestrek (-) og understrek (_). Dette blir din lenke: <span style={{ fontFamily: 'monospace', color: ACCENT }}>reelhome.ai/?ref=koden</span></p>
            </div>
            {error && <div style={{ color: '#dc2626', fontSize: 14 }}>{error}</div>}
            <button type="submit" disabled={busy} style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontWeight: 800, fontSize: 16, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, marginTop: 4 }}>{busy ? 'Oppretter...' : 'Bli selger'}</button>
          </form>
        </div>
      )}

      {done && (
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.4)' }}>
            <span style={{ fontSize: 28, color: '#059669' }}>✓</span>
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>Du er nå ReelHome-selger! 🎉</h2>
          <p style={{ color: '#6b7280', fontSize: 15, margin: '0 0 18px' }}>{done.emailSent ? 'Vi har sendt portal-lenka og detaljer til e-posten din.' : 'Kontoen din er opprettet.'}</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Din henvisningslenke</p>
          <p style={{ margin: 0 }}><a href={done.ref_url} style={{ color: ACCENT, fontSize: 15, wordBreak: 'break-all' }}>{done.ref_url}</a></p>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f8', color: '#111', padding: '48px 20px', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}><span style={{ fontSize: 26, fontWeight: 900, color: ACCENT }}>ReelHome<span style={{ color: '#111' }}>.ai</span></span></div>
        {children}
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<Shell><p style={{ color: '#9ca3af' }}>Laster...</p></Shell>}>
      <Recruit />
    </Suspense>
  )
}
