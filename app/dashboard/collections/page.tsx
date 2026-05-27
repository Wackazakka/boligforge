'use client'

import { useEffect, useState, useRef } from 'react'

interface Collection {
  id: string
  name: string
  created_at: string
  is_org: boolean
  video_count: number
}

interface Video {
  id: string
  video_url: string
  created_at: string
  property_id: string
}

type SocialConnection = {
  id: string
  platform: string
  page_name: string
  token_expires_at: string | null
}

export default function CollectionsPage() {
  const [collections, setCollections]     = useState<Collection[]>([])
  const [selected, setSelected]           = useState<Collection | null>(null)
  const [videos, setVideos]               = useState<Video[]>([])
  const [loading, setLoading]             = useState(true)
  const [loadingVideos, setLoadingVideos] = useState(false)
  const [isAdmin, setIsAdmin]             = useState(false)

  // New folder form state
  const [showForm, setShowForm]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [orgLevel, setOrgLevel]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Publish modal state
  const [publishModalUrl,    setPublishModalUrl]    = useState<string | null>(null)
  const [publishPropertyId,  setPublishPropertyId]  = useState<string | null>(null)
  const [publishConnections, setPublishConnections] = useState<SocialConnection[]>([])
  const [publishSelected,    setPublishSelected]    = useState<Set<string>>(new Set())
  const [publishCaption,     setPublishCaption]     = useState('')
  const [publishLoading,     setPublishLoading]     = useState(false)
  const [publishResults,     setPublishResults]     = useState<{ pageName: string; success: boolean; error?: string }[] | null>(null)
  const [publishMode,        setPublishMode]        = useState<'now' | 'schedule'>('now')
  const [scheduledAt,        setScheduledAt]        = useState('')
  const [scheduleDone,       setScheduleDone]       = useState<string | null>(null)
  const [scheduleError,      setScheduleError]      = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/collections')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setCollections(d) })
      .finally(() => setLoading(false))
    fetch('/api/org/me')
      .then(r => r.json())
      .then(d => { if (d.role === 'admin' || d.role === 'superadmin') setIsAdmin(true) })
  }, [])

  useEffect(() => {
    if (showForm) setTimeout(() => inputRef.current?.focus(), 50)
  }, [showForm])

  async function loadVideos(col: Collection) {
    setSelected(col)
    setLoadingVideos(true)
    const res = await fetch(`/api/collections/${col.id}/videos`)
    const d = await res.json()
    setVideos(Array.isArray(d) ? d : [])
    setLoadingVideos(false)
  }

  async function createCollection(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const res = await fetch('/api/collections', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: newName.trim(), org_level: orgLevel }),
    })
    const col = await res.json()
    if (col.id) {
      setCollections(prev => [{ ...col, video_count: 0 }, ...prev])
      setNewName('')
      setShowForm(false)
      setOrgLevel(false)
    }
  }

  async function deleteCollection(col: Collection) {
    if (!confirm(`Slette mappen «${col.name}»? Videoene beholdes.`)) return
    await fetch('/api/collections', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ collectionId: col.id }),
    })
    setCollections(prev => prev.filter(c => c.id !== col.id))
    if (selected?.id === col.id) { setSelected(null); setVideos([]) }
  }

  async function openPublishModal(url: string, propertyId: string | null = null) {
    setPublishModalUrl(url)
    setPublishPropertyId(propertyId)
    setPublishResults(null)
    setPublishCaption('')
    setPublishSelected(new Set())
    setPublishMode('now')
    setScheduledAt('')
    setScheduleDone(null)
    setScheduleError(null)
    setPublishLoading(true)
    try {
      const res = await fetch('/api/social/connections')
      if (res.ok) {
        const conns: SocialConnection[] = await res.json()
        setPublishConnections(conns)
        const valid = conns.filter(c => !c.token_expires_at || new Date(c.token_expires_at) > new Date())
        setPublishSelected(new Set(valid.map(c => c.id)))
      }
    } finally {
      setPublishLoading(false)
    }
  }

  async function handlePublish() {
    if (!publishModalUrl || publishSelected.size === 0) return
    setPublishLoading(true)
    setPublishResults(null)
    try {
      const res = await fetch('/api/social/publish', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          video_url:      publishModalUrl,
          caption:        publishCaption,
          connection_ids: Array.from(publishSelected),
          property_id:    publishPropertyId,
        }),
      })
      const data = await res.json()
      if (data.results) setPublishResults(data.results)
    } finally {
      setPublishLoading(false)
    }
  }

  async function handleSchedule() {
    if (!publishModalUrl || publishSelected.size === 0 || !scheduledAt) return
    if (new Date(scheduledAt).getTime() <= Date.now()) {
      setScheduleError('Tidspunktet må være i framtiden')
      return
    }
    setPublishLoading(true)
    setScheduleError(null)
    setScheduleDone(null)
    try {
      const res = await fetch('/api/social/schedule', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          video_url:      publishModalUrl,
          caption:        publishCaption,
          connection_ids: Array.from(publishSelected),
          scheduled_at:   new Date(scheduledAt).toISOString(),
          property_id:    publishPropertyId,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setScheduleDone(
          new Date(scheduledAt).toLocaleString('nb-NO', {
            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
          })
        )
      } else {
        setScheduleError(data.error || 'Kunne ikke planlegge publisering')
      }
    } finally {
      setPublishLoading(false)
    }
  }

  const personal = collections.filter(c => !c.is_org)
  const org      = collections.filter(c => c.is_org)

  const CollectionList = ({ items, label }: { items: Collection[]; label: string }) => (
    items.length === 0 ? null : (
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{label}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map(col => (
            <div
              key={col.id}
              onClick={() => loadVideos(col)}
              className="app-card"
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                border: selected?.id === col.id ? '2px solid var(--blue)' : '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '18px' }}>{col.is_org ? '🏢' : '📁'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {col.name}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {col.video_count} video{col.video_count !== 1 ? 'er' : ''}
                </p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); deleteCollection(col) }}
                style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  )

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>Mapper</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            📁 Personlige mapper er bare synlige for deg.{isAdmin && ' 🏢 Byråmapper deles med alle meglere.'}
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="app-btn-primary" style={{ fontSize: '13px', padding: '8px 16px' }}>
          + Ny mappe
        </button>
      </div>

      {/* New folder form */}
      {showForm && (
        <form onSubmit={createCollection} className="app-card" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            ref={inputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Navn på mappe, f.eks. «Frogner høst 2026»"
            className="app-input"
          />
          {isAdmin && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ink)', cursor: 'pointer' }}>
              <input type="checkbox" checked={orgLevel} onChange={e => setOrgLevel(e.target.checked)} />
              🏢 Byråmappe — synlig for alle meglere i byrået
            </label>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="app-btn-primary" style={{ fontSize: '13px', padding: '8px 16px' }}>Opprett</button>
            <button type="button" onClick={() => { setShowForm(false); setNewName(''); setOrgLevel(false) }} className="app-btn-ghost" style={{ fontSize: '13px', padding: '8px 12px' }}>Avbryt</button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3].map(i => <div key={i} style={{ height: '60px', borderRadius: '10px', background: 'var(--line)', opacity: 0.4 }} />)}
        </div>
      ) : collections.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--muted)' }}>
          <p style={{ fontSize: '32px', marginBottom: '12px' }}>📁</p>
          <p style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px', color: 'var(--ink)' }}>Ingen mapper ennå</p>
          <p style={{ fontSize: '13px' }}>Opprett en mappe, og legg videoer i den fra eiendomssiden.</p>
        </div>
      ) : (
        <div className="collections-grid" style={{ gridTemplateColumns: selected ? '280px 1fr' : '1fr' }}>

          {/* Left: folder lists */}
          <div>
            <CollectionList items={org}      label="Byråmapper" />
            <CollectionList items={personal} label="Mine mapper" />
          </div>

          {/* Right: videos in selected folder */}
          {selected && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
                  {selected.is_org ? '🏢' : '📁'} {selected.name}
                </h2>
                <button onClick={() => { setSelected(null); setVideos([]) }} style={{ fontSize: '12px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Lukk
                </button>
              </div>

              {loadingVideos ? (
                <div style={{ height: '160px', borderRadius: '12px', background: 'var(--line)', opacity: 0.4 }} />
              ) : videos.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--muted)', padding: '24px', textAlign: 'center', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--line)' }}>
                  Ingen videoer i denne mappen ennå.<br />
                  Gå til en eiendom og huk av mappen i videolisten.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                  {videos.map(v => (
                    <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <video src={v.video_url} controls style={{ width: '100%', borderRadius: '10px', aspectRatio: '16/9', objectFit: 'cover' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {new Date(v.created_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <a href={v.video_url} download style={{ fontSize: '12px', color: 'var(--blue)', textDecoration: 'none' }}>
                            Last ned
                          </a>
                          <button
                            onClick={() => openPublishModal(v.video_url, v.property_id)}
                            style={{ fontSize: '12px', color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            📤 Publiser
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ─── Publish modal ─── */}
      {publishModalUrl && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setPublishModalUrl(null) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            zIndex: 200,
            padding: '16px 16px 0 16px',
            overflowY: 'auto',
          }}
        >
          <div style={{
            background: 'var(--surface)', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '480px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            marginTop: 'auto', marginBottom: 'auto',
            paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 16px))',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                Publiser video
              </h2>
              <button
                onClick={() => setPublishModalUrl(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--muted)', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Scheduled confirmation view */}
            {scheduleDone ? (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', borderRadius: '8px', marginBottom: '20px',
                  background: '#dcfce7', border: '1px solid #86efac',
                }}>
                  <span style={{ fontSize: '16px' }}>✓</span>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: '#166534', margin: 0 }}>
                    Planlagt for {scheduleDone}
                  </p>
                </div>
                <a
                  href="/dashboard/calendar"
                  className="app-btn-secondary w-full"
                  style={{ padding: '12px', textDecoration: 'none', display: 'block', textAlign: 'center', marginBottom: '8px' }}
                >
                  Se kalender →
                </a>
                <button
                  onClick={() => setPublishModalUrl(null)}
                  className="app-btn-primary w-full"
                  style={{ padding: '12px' }}
                >
                  Lukk
                </button>
              </div>
            ) : /* Results view */
            publishResults ? (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  {publishResults.map((r, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px', borderRadius: '8px',
                      background: r.success ? '#dcfce7' : '#fee2e2',
                      border: `1px solid ${r.success ? '#86efac' : '#fca5a5'}`,
                    }}>
                      <span style={{ fontSize: '16px' }}>{r.success ? '✓' : '✗'}</span>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 500, color: r.success ? '#166534' : '#991b1b', margin: 0 }}>
                          {r.pageName}
                        </p>
                        {!r.success && r.error && (
                          <p style={{ fontSize: '12px', color: '#991b1b', margin: 0 }}>{r.error}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setPublishModalUrl(null)}
                  className="app-btn-primary w-full"
                  style={{ padding: '12px' }}
                >
                  Lukk
                </button>
              </div>
            ) : publishLoading && publishConnections.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
                Laster tilkoblinger…
              </p>
            ) : publishConnections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '16px' }}>
                  Ingen sosiale medier koblet til ennå.
                </p>
                <a
                  href="/dashboard/settings/social"
                  className="app-btn-secondary"
                  style={{ fontSize: '13px', textDecoration: 'none' }}
                >
                  Gå til innstillinger →
                </a>
              </div>
            ) : (
              <>
                {/* When to publish — shown first so it's always visible */}
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Når
                </p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  {(['now', 'schedule'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => { setPublishMode(m); setScheduleError(null) }}
                      style={{
                        flex: 1, padding: '8px', borderRadius: '8px', fontSize: '14px', fontWeight: 500,
                        cursor: 'pointer', border: '1px solid var(--line)',
                        background: publishMode === m ? 'var(--ink)' : 'var(--surface-2)',
                        color:      publishMode === m ? '#fff' : 'var(--ink)',
                      }}
                    >
                      {m === 'now' ? 'Publiser nå' : 'Planlegg'}
                    </button>
                  ))}
                </div>

                {publishMode === 'schedule' && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => { setScheduledAt(e.target.value); setScheduleError(null) }}
                    min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                    style={{
                      width: '100%', borderRadius: '8px', border: '1px solid var(--line)',
                      padding: '10px 12px', fontSize: '14px', color: 'var(--ink)',
                      background: 'var(--surface-2)', boxSizing: 'border-box', marginBottom: '20px',
                      fontFamily: 'inherit',
                    }}
                  />
                )}

                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', marginTop: '8px' }}>
                  Publiser til
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {publishConnections.map(conn => {
                    const expired = conn.token_expires_at ? new Date(conn.token_expires_at) < new Date() : false
                    const checked = publishSelected.has(conn.id)
                    return (
                      <label
                        key={conn.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 14px', borderRadius: '8px',
                          background: 'var(--surface-2)', border: `1px solid ${expired ? '#f87171' : 'var(--line)'}`,
                          cursor: expired ? 'not-allowed' : 'pointer', opacity: expired ? 0.6 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={expired}
                          onChange={() => {
                            setPublishSelected(prev => {
                              const next = new Set(prev)
                              if (next.has(conn.id)) next.delete(conn.id)
                              else next.add(conn.id)
                              return next
                            })
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', margin: 0 }}>
                            {conn.page_name}
                          </p>
                          <p style={{ fontSize: '11px', color: expired ? '#ef4444' : 'var(--muted)', margin: 0 }}>
                            {conn.platform === 'facebook' ? 'Facebook' : 'LinkedIn'}
                            {expired ? ' · Token utløpt' : ''}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>

                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Tekst / bildetekst
                </p>
                <textarea
                  value={publishCaption}
                  onChange={e => setPublishCaption(e.target.value)}
                  placeholder="Skriv en bildetekst til posten… (valgfritt)"
                  rows={3}
                  style={{
                    width: '100%', borderRadius: '8px', border: '1px solid var(--line)',
                    padding: '10px 12px', fontSize: '14px', color: 'var(--ink)',
                    background: 'var(--surface-2)', resize: 'vertical',
                    boxSizing: 'border-box', marginBottom: '20px',
                    fontFamily: 'inherit',
                  }}
                />

                {scheduleError && (
                  <p style={{ fontSize: '13px', color: '#ef4444', marginBottom: '12px' }}>{scheduleError}</p>
                )}

                {publishMode === 'now' ? (
                  <button
                    onClick={handlePublish}
                    disabled={publishLoading || publishSelected.size === 0}
                    className="app-btn-primary w-full"
                    style={{ padding: '12px', fontSize: '15px' }}
                  >
                    {publishLoading ? 'Publiserer…' : `Publiser nå (${publishSelected.size})`}
                  </button>
                ) : (
                  <button
                    onClick={handleSchedule}
                    disabled={publishLoading || publishSelected.size === 0 || !scheduledAt}
                    className="app-btn-primary w-full"
                    style={{ padding: '12px', fontSize: '15px' }}
                  >
                    {publishLoading ? 'Planlegger…' : `Planlegg publisering (${publishSelected.size})`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
