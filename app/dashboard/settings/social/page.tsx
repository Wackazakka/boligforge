'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import AccountTabs from '../../profile/AccountTabs'

type Connection = {
  id: string
  platform: 'facebook' | 'instagram' | 'linkedin'
  page_id: string
  page_name: string
  token_expires_at: string | null
  created_at: string
}

type PageContent = {
  page: { id: string; name: string; pictureUrl: string | null; followers: number | null }
  posts: {
    id: string
    message: string | null
    createdTime: string | null
    imageUrl: string | null
    permalink: string | null
  }[]
}

const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  facebook:  { label: 'Facebook',  color: '#1877F2', icon: 'f' },
  instagram: { label: 'Instagram', color: '#E1306C', icon: '▶' },
  linkedin:  { label: 'LinkedIn',  color: '#0A66C2', icon: 'in' },
}

function SocialSettingsContent() {
  const searchParams   = useSearchParams()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading,     setLoading]     = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  // Sideinnhold hentes live fra Facebook naar megleren ber om det — én rad per
  // tilkobling. Ingenting lagres; dette er kun for aa se at riktig side er
  // koblet til og hva som faktisk ligger ute paa den.
  const [pageContent, setPageContent] = useState<Record<string, PageContent>>({})
  const [contentLoading, setContentLoading] = useState<string | null>(null)
  const [contentError, setContentError] = useState<Record<string, string>>({})

  async function loadPageContent(connectionId: string) {
    setContentLoading(connectionId)
    setContentError(prev => {
      const next = { ...prev }
      delete next[connectionId]
      return next
    })
    try {
      const res = await fetch(`/api/social/page-content?connectionId=${connectionId}`)
      const data = await res.json()
      if (!res.ok) {
        setContentError(prev => ({ ...prev, [connectionId]: data.error ?? 'Kunne ikke hente innhold' }))
        return
      }
      setPageContent(prev => ({ ...prev, [connectionId]: data }))
    } catch {
      setContentError(prev => ({ ...prev, [connectionId]: 'Kunne ikke hente innhold' }))
    } finally {
      setContentLoading(null)
    }
  }

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

  const facebookConnections  = connections.filter(c => c.platform === 'facebook')
  const instagramConnections = connections.filter(c => c.platform === 'instagram')
  const linkedinConnections  = connections.filter(c => c.platform === 'linkedin')

  // Viser hva som faktisk ligger paa Facebook-siden. Bruker
  // pages_read_engagement og er den eneste flaten som gjoer det.
  function PageContentPanel({ connectionId }: { connectionId: string }) {
    const content = pageContent[connectionId]
    const err     = contentError[connectionId]
    const busy    = contentLoading === connectionId

    if (!content) {
      return (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
          <button
            onClick={() => loadPageContent(connectionId)}
            disabled={busy}
            className="app-btn-secondary"
            style={{ fontSize: '12px' }}
          >
            {busy ? 'Henter fra Facebook…' : 'Vis innhold fra siden'}
          </button>
          {err && (
            <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>{err}</p>
          )}
        </div>
      )
    }

    return (
      <div style={{ marginTop: '10px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          {content.page.pictureUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={content.page.pictureUrl}
              alt={content.page.name}
              width={40}
              height={40}
              style={{ borderRadius: '50%', display: 'block' }}
            />
          )}
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              {content.page.name}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {content.page.followers !== null
                ? `${content.page.followers.toLocaleString('nb-NO')} følgere`
                : 'Facebook-side'}
            </p>
          </div>
        </div>

        {content.posts.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Ingen innlegg på siden ennå.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {content.posts.map(p => (
              <div key={p.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                {p.imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.imageUrl}
                    alt=""
                    width={48}
                    height={48}
                    style={{ borderRadius: '6px', objectFit: 'cover', display: 'block', flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: '12px', color: 'var(--ink)', marginBottom: '2px',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {p.message ?? '(uten tekst)'}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {p.createdTime
                      ? new Date(p.createdTime).toLocaleString('nb-NO', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })
                      : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => loadPageContent(connectionId)}
          disabled={busy}
          style={{
            fontSize: '11px', color: 'var(--muted)', background: 'none',
            border: 'none', cursor: 'pointer', padding: '8px 0 0',
          }}
        >
          {busy ? 'Oppdaterer…' : 'Oppdater'}
        </button>
      </div>
    )
  }

  function PlatformSection({
    platform,
    conns,
    connectHref,
    connectNote,
  }: {
    platform: 'facebook' | 'instagram' | 'linkedin'
    conns: Connection[]
    connectHref?: string
    connectNote?: string
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
          {connectHref ? (
            <a
              href={connectHref}
              className="app-btn-secondary"
              style={{ fontSize: '13px', textDecoration: 'none' }}
            >
              + Koble til
            </a>
          ) : connectNote ? (
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{connectNote}</span>
          ) : null}
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
                  padding:        '10px 14px',
                  borderRadius:   '8px',
                  background:     'var(--surface-2)',
                  border:         isExpired ? '1px solid #f87171' : '1px solid var(--line)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

                  {platform === 'facebook' && (
                    <PageContentPanel connectionId={c.id} />
                  )}
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
            platform="instagram"
            conns={instagramConnections}
            connectNote="Kobles til automatisk via Facebook"
          />
          <PlatformSection
            platform="linkedin"
            conns={linkedinConnections}
            connectHref="/api/social/linkedin"
          />
        </>
      )}

      <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '32px', textAlign: 'center' }}>
        Facebook- og Instagram-tilkoblinger varer 60 dager · LinkedIn-tilkoblinger varer ~60 dager
      </p>
    </div>
  )
}

export default function SocialSettingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px 24px' }}><AccountTabs /></div>}>
      <SocialSettingsContent />
    </Suspense>
  )
}
