'use client'

import { useEffect, useState } from 'react'

type Bolig = { id: string; address: string | null; created_at: string; source: string | null; unlocked_at: string | null; price_nok: number; videoer: number }

type Member = {
  id: string
  full_name: string
  email: string
  role: string
  video_count: number
  boliger: { boliger: number; produksjoner: number; kostnad: number }
  bestillinger: { antall: number; aapne: number }
  boliger_liste: Bolig[]
}

type OrgStat = { boliger_denne_maaneden: number; produksjoner_denne_maaneden: number; kostnad_denne_maaneden: number; saldo_lag_selv: number; saldo_vi_produserer: number; faktura_samlet: boolean }
const TOM_ORG: OrgStat = { boliger_denne_maaneden: 0, produksjoner_denne_maaneden: 0, kostnad_denne_maaneden: 0, saldo_lag_selv: 0, saldo_vi_produserer: 0, faktura_samlet: false }

const nb = (n: number) => n.toLocaleString('nb-NO')
const KILDE: Record<string, string> = { free_first: 'gratis første', entitlement: 'abonnement', purchase: 'kjøpt', production: 'produsert av ReelHome', admin: 'uten kostnad' }

export default function TeamPage() {
  const [members, setMembers]         = useState<Member[]>([])
  const [org, setOrg]                 = useState<OrgStat>(TOM_ORG)
  const [meg, setMeg]                 = useState<string>('')
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [removing, setRemoving]       = useState<string | null>(null)
  const [utvidet, setUtvidet]         = useState<string | null>(null)
  const [lagrer, setLagrer]           = useState(false)

  // Invite form
  const [showInvite, setShowInvite]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [inviteError, setInviteError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/team/members')
      const d   = await res.json()
      if (!res.ok) { setError(d.error || 'Kunne ikke laste team'); return }
      setMembers(d.members ?? [])
      setOrg(d.org ?? TOM_ORG)
      setMeg(d.meg ?? '')
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function settRolle(memberId: string, role: 'admin' | 'member') {
    setLagrer(true); setError('')
    try {
      const res = await fetch('/api/team/members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId, role }) })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Kunne ikke endre rollen'); return }
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m))
    } finally { setLagrer(false) }
  }

  async function settFaktura(samlet: boolean) {
    setLagrer(true); setError('')
    try {
      const res = await fetch('/api/team/members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ faktura_samlet: samlet }) })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Kunne ikke lagre'); return }
      setOrg(o => ({ ...o, faktura_samlet: samlet }))
    } finally { setLagrer(false) }
  }

  async function handleRemove(memberId: string, name: string) {
    if (!confirm(`Fjerne ${name} fra kontoret? Boligene og videoene hennes blir liggende hos kontoret og flyttes til deg.`)) return
    setRemoving(memberId)
    try {
      const res = await fetch('/api/team/members', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ memberId }),
      })
      if (res.ok) setMembers(prev => prev.filter(m => m.id !== memberId))
    } finally {
      setRemoving(null)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteStatus('loading')
    setInviteError('')
    const res = await fetch('/api/team/invite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: inviteEmail.trim() }),
    })
    const d = await res.json()
    if (!res.ok) {
      setInviteError(d.error || 'Noe gikk galt')
      setInviteStatus('err')
    } else {
      setInviteStatus('ok')
    }
  }


  if (loading) return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
      {[1, 2, 3].map(i => <div key={i} style={{ height: '64px', borderRadius: '10px', background: 'var(--line)', opacity: 0.4, marginBottom: '8px' }} />)}
    </div>
  )

  if (error) return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
      <div className="app-error">{error}</div>
    </div>
  )

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '40px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>Team</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            {members.length} megler{members.length !== 1 ? 'e' : ''} i organisasjonen
          </p>
        </div>
        <button
          onClick={() => { setShowInvite(v => !v); setInviteStatus('idle'); setInviteEmail('') }}
          className="app-btn-primary"
          style={{ fontSize: '13px', padding: '8px 16px' }}
        >
          + Inviter megler
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="app-card" style={{ padding: '20px 24px' }}>
          {inviteStatus === 'ok' ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <p style={{ fontSize: '24px', marginBottom: '8px' }}>✉️</p>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', marginBottom: '4px' }}>Invitasjon sendt!</p>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>{inviteEmail} vil motta en e-post med lenke for å komme i gang.</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button onClick={() => { setInviteStatus('idle'); setInviteEmail('') }} className="app-btn-secondary" style={{ fontSize: '13px' }}>
                  Inviter en til
                </button>
                <button onClick={() => setShowInvite(false)} className="app-btn-ghost" style={{ fontSize: '13px' }}>
                  Lukk
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  E-postadresse
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="megler@firma.no"
                  required
                  className="app-input"
                  autoFocus
                />
              </div>
              {inviteStatus === 'err' && <div className="app-error">{inviteError}</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" disabled={inviteStatus === 'loading' || !inviteEmail.trim()} className="app-btn-primary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                  {inviteStatus === 'loading' ? 'Sender…' : 'Send invitasjon'}
                </button>
                <button type="button" onClick={() => setShowInvite(false)} className="app-btn-ghost" style={{ fontSize: '13px' }}>
                  Avbryt
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Boliger denne måneden (16/10: boliger, ikke kreditter) */}
      <div className="app-card" style={{ padding: '20px 24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '14px' }}>Kontoret denne måneden</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', fontSize: '13px' }}>
          <div>
            <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{org.boliger_denne_maaneden}</p>
            <p style={{ color: 'var(--muted)' }}>boliger laget selv</p>
          </div>
          <div>
            <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{org.produksjoner_denne_maaneden}</p>
            <p style={{ color: 'var(--muted)' }}>produsert av ReelHome</p>
          </div>
          <div>
            <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{org.saldo_lag_selv}</p>
            <p style={{ color: 'var(--muted)' }}>boliger igjen i «Lag selv»</p>
          </div>
          {org.saldo_vi_produserer > 0 && (
            <div>
              <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{org.saldo_vi_produserer}</p>
              <p style={{ color: 'var(--muted)' }}>boliger igjen i «Vi produserer»</p>
            </div>
          )}
          <div>
            <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.1 }}>{nb(org.kostnad_denne_maaneden)} kr</p>
            <p style={{ color: 'var(--muted)' }}>kostnad denne måneden, eks. mva</p>
          </div>
        </div>
        {/* Fakturavalg (avtalen punkt 4): per megler eller kontoret samlet.
            Kontor-abonnement faktureres alltid kontoret. */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', fontSize: '13px', color: 'var(--ink)', cursor: 'pointer' }}>
          <input type="checkbox" checked={org.faktura_samlet} disabled={lagrer} onChange={e => settFaktura(e.target.checked)} style={{ width: '15px', height: '15px', accentColor: 'var(--gold)' }} />
          Fakturer kontoret samlet <span style={{ color: 'var(--muted)' }}>— ellers faktureres hver megler for seg. Kontor-abonnement faktureres alltid kontoret.</span>
        </label>
      </div>

      {/* Member list */}
      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '12px' }}>Meglere</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {members.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--muted)' }}>
              <p style={{ fontSize: '28px', marginBottom: '8px' }}>👥</p>
              <p>Ingen meglere ennå. Inviter den første!</p>
            </div>
          ) : members.map(m => (
            <div
              key={m.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: '10px', padding: '14px 16px',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                background: 'var(--surface-2)', border: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--muted)' }}>
                  {m.full_name[0]?.toUpperCase() ?? '?'}
                </span>
              </div>

              {/* Info — får en minstebredde så navn og e-post ikke klemmes bort
                  når raden har mange tall (bryter heller til ny linje). */}
              <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.full_name}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </p>
              </div>

              {/* Videos this month */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{m.video_count}</p>
                <p style={{ fontSize: '11px', color: 'var(--muted)' }}>videoer</p>
              </div>

              {/* Boliger / bestillinger / kostnad denne måneden */}
              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '52px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>
                  {m.boliger.boliger + m.boliger.produksjoner}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--muted)' }}>boliger i mnd</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '52px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: m.bestillinger.aapne > 0 ? 'var(--gold)' : 'var(--ink)' }}>
                  {m.bestillinger.antall}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--muted)' }}>bestillinger</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '64px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{nb(m.boliger.kostnad)} kr</p>
                <p style={{ fontSize: '11px', color: 'var(--muted)' }}>denne mnd</p>
              </div>

              {/* Rolle (avtalen punkt 4: administrator kan gi rollen videre) */}
              <span className={m.role === 'admin' ? 'app-badge-gold' : 'app-badge-muted'} style={{ flexShrink: 0 }}>
                {m.role === 'admin' ? 'Admin' : 'Megler'}
              </span>
              {m.role === 'admin' ? (
                m.id !== meg && (
                  <button onClick={() => settRolle(m.id, 'member')} disabled={lagrer} className="app-btn-ghost text-xs" style={{ flexShrink: 0 }} title="Ta bort administratorrollen">Fjern admin</button>
                )
              ) : (
                <button onClick={() => settRolle(m.id, 'admin')} disabled={lagrer} className="app-btn-ghost text-xs" style={{ flexShrink: 0 }} title="Gi administratorrollen">Gjør til admin</button>
              )}

              <button onClick={() => setUtvidet(utvidet === m.id ? null : m.id)} className="app-btn-ghost text-xs" style={{ flexShrink: 0 }}>
                {utvidet === m.id ? 'Skjul' : `Boliger (${m.boliger_liste.length})`}
              </button>

              {/* Remove — only non-admins */}
              {m.role !== 'admin' && (
                <button
                  onClick={() => handleRemove(m.id, m.full_name)}
                  disabled={removing === m.id}
                  className="app-btn-danger"
                  style={{ flexShrink: 0 }}
                >
                  {removing === m.id ? '…' : 'Fjern'}
                </button>
              )}

              {/* Boliglisten til megleren (hele bredden) */}
              {utvidet === m.id && (
                <div style={{ flexBasis: '100%', borderTop: '1px solid var(--line)', paddingTop: '10px', marginTop: '4px' }}>
                  {m.boliger_liste.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Ingen boliger ennå.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '4px' }}>
                      {m.boliger_liste.map(b => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px', flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--ink)' }}>{b.address ?? 'Uten adresse'}</span>
                          <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                            {b.videoer} video{b.videoer === 1 ? '' : 'er'} · {b.source ? KILDE[b.source] ?? b.source : 'ikke låst opp'}{b.price_nok ? ` · ${nb(b.price_nok)} kr` : ''} · {new Date(b.unlocked_at ?? b.created_at).toLocaleDateString('nb-NO')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
