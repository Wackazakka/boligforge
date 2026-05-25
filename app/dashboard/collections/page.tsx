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
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '280px 1fr' : '1fr', gap: '24px', alignItems: 'start' }}>

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
                        <a href={v.video_url} download style={{ fontSize: '12px', color: 'var(--blue)', textDecoration: 'none' }}>
                          Last ned
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
