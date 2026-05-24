'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AccountTabs from '../../profile/AccountTabs'

type Connection = {
  id: string
  platform: 'facebook' | 'linkedin'
  page_id: string
  page_name: string
  token_expires_at: string | null
  created_at: string
}

const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  facebook: { label: 'Facebook',  color: '#1877F2', icon: 'f' },
  linkedin: { label: 'LinkedIn',  color: '#0A66C2', icon: 'in' },
}

export default function SocialSettingsPage() {
  const searchParams   = useSearchParams()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading,     setLoading]     = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const connected = searchParams.get('connected')
  const error     = searchParams.get('error')

  useEffect(() => { loadConnections() }, [])

  async function loadConnections() {
    setLoading(true)
    try {
      const res = await fetch('/api/social/connections')
      if (res.ok) setConnections(await res.json())
    } finally { setLoading(false) }
  }

  async function handleDisconnect(connectionId: string) {
    if (!confirm('Koble fra denne kontoen?')) return
    setDisconnecting(connectionId)
    try {
      await fetch('/api/social/disconnect', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ connectionId }),
      })
      await loadConnections()
    } finally { setDisconnecting(null) }
  }

  const facebookConnections = connections.filter(c => c.platform === 'facebook')
  const linkedinConnections = connections.filter(c => c.platform === 'linkedin')

  function PlatformSection({
    platform,
    conns,
    connectHref,
  }: {
    platform: 'facebook' | 'linkedin'
    conns: Connection[]
    connectHref: string
  }) {
    const meta = PLATFORM_META[platform]
    return (
      <div className="app-card" style={{ padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: meta.color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700,
            }}>
              {meta.icon}
            </div>
            <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--ink)' }}>{meta.label}</span>
          </div>
          <a
            href={connectHref}
            className="app-btn-secondary"
            style={{ fontSize: '13px', textDecoration: 'none' }}
          >
            + Koble til
          </a>
        </div>

        {conns.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Ingen {meta.label}-kontoer koblet til ennå.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {conns.map(c => {
              const expires = c.token_expires_at
                ? new Date(c.token_expires_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
                : null
              const isExpired = c.token_expires_at ? new Date(c.token_expires_at) < new Date() : false
              return (
                <div key={c.id} style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  padding:        '10px 14px',
                  borderRadius:   '8px',
                  background:     'var(--surface-2)',
                  border:         isExpired ? '1px solid #f87171' : '1px solid var(--line)',
                }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', marginBottom: '2px' }}>
                      {c.page_name}
                    </p>
                    <p style={{ fontSize: '11px', color: isExpired ? '#ef4444' : 'var(--muted)' }}>
                      {isExpired
                        ? '⚠ Token utløpt — koble til på nytt'
                        : expires
                          ? `Utløper ${expires}`
                          : 'Aktiv'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDisconnect(c.id)}
                    disabled={disconnecting === c.id}
                    style={{
                      fontSize: '12px', color: 'var(--muted)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '4px 8px', borderRadius: '6px',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#fee2e2'
                      e.currentTarget.style.color = '#dc2626'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'none'
                      e.currentTarget.style.color = 'var(--muted)'
                    }}
                  >
                    {disconnecting === c.id ? '…' : 'Koble fra'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
      <AccountTabs />

      <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
        Sosiale medier
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '32px' }}>
        Koble til kontoer for å publisere videoer direkte fra ReelHome.
        Kun landscape (16:9) støttes foreløpig.
      </p>

      {/* Toast messages */}
      {connected && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '24px',
          background: '#dcfce7', border: '1px solid #86efac', color: '#166534', fontSize: '14px',
        }}>
          ✓ {PLATFORM_META[connected]?.label ?? connected} koblet til
        </div>
      )}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '24px',
          background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '14px',
        }}>
          Feil: {error}
        </div>
      )}

      {loading ? (
        <div style={{ height: '120px', borderRadius: '12px', background: 'var(--line)', opacity: 0.4 }} />
      ) : (
        <>
          <PlatformSection
            platform="facebook"
            conns={facebookConnections}
            connectHref="/api/social/facebook"
          />
          <PlatformSection
            platform="linkedin"
            conns={linkedinConnections}
            connectHref="/api/social/linkedin"
          />
        </>
      )}

      <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '32px', textAlign: 'center' }}>
        Facebook-tilkoblinger varer 60 dager · LinkedIn-tilkoblinger varer ~60 dager
      </p>
    </div>
  )
}
