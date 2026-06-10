'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Member {
  id: string
  user_id: string
  role: string
  created_at: string
  profile: {
    name: string | null
    email: string | null
    portrait_url: string | null
  } | null
}

interface TemplateAvatar {
  id: string
  name: string
  desc: string
  voiceId: string
  portraitUrl: string
}

// ── Template avatar row ────────────────────────────────────────────────────
function AvatarRow({
  avatar,
  onSave,
}: {
  avatar: TemplateAvatar
  onSave: (id: string, voiceId: string) => Promise<void>
}) {
  const [editing, setEditing]   = useState(false)
  const [voiceId, setVoiceId]   = useState(avatar.voiceId)
  const [saving, setSaving]     = useState(false)
  const [previewing, setPreviewing] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(avatar.id, voiceId)
    setSaving(false)
    setEditing(false)
  }

  async function handlePreview() {
    setPreviewing(true)
    try {
      const res = await fetch('/api/profile/tts-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Hei, jeg heter ${avatar.name}. ${avatar.desc.charAt(0).toUpperCase() + avatar.desc.slice(1)} og klar til å hjelpe deg med boligkjøpet.`,
          voice_id: voiceId,
        }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.onended = () => { URL.revokeObjectURL(url); setPreviewing(false) }
        audio.play()
      } else {
        setPreviewing(false)
      }
    } catch {
      setPreviewing(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: '10px',
        padding: '12px 16px',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatar.portraitUrl}
        alt={avatar.name}
        style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', objectPosition: 'center 20%', flexShrink: 0 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>{avatar.name}</p>
        <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{avatar.desc}</p>
      </div>

      {editing ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <input
            value={voiceId}
            onChange={e => setVoiceId(e.target.value)}
            className="app-input"
            placeholder="ElevenLabs Voice ID"
            style={{ width: '220px', fontSize: '12px', fontFamily: 'monospace' }}
            autoFocus
          />
          <button
            onClick={handlePreview}
            disabled={previewing || !voiceId}
            className="app-btn-ghost"
            style={{ fontSize: '12px', padding: '6px 10px' }}
            title="Forhåndsvis stemme"
          >
            {previewing ? '🔊…' : '▶ Test'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="app-btn-primary"
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            {saving ? '…' : 'Lagre'}
          </button>
          <button
            onClick={() => { setEditing(false); setVoiceId(avatar.voiceId) }}
            className="app-btn-ghost"
            style={{ fontSize: '12px', padding: '6px 10px' }}
          >
            Avbryt
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <code style={{ fontSize: '11px', color: 'var(--muted)', background: 'var(--surface-2)', padding: '3px 8px', borderRadius: '6px' }}>
            {voiceId}
          </code>
          <button
            onClick={handlePreview}
            disabled={previewing}
            className="app-btn-ghost"
            style={{ fontSize: '12px', padding: '6px 10px' }}
            title="Forhåndsvis stemme"
          >
            {previewing ? '🔊…' : '▶'}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="app-btn-ghost"
            style={{ fontSize: '12px', padding: '6px 10px' }}
          >
            Endre
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main admin page ────────────────────────────────────────────────────────
export default function AdminPage() {
  const [members, setMembers]           = useState<Member[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [removing, setRemoving]         = useState<string | null>(null)
  const [templateAvatars, setTemplateAvatars] = useState<TemplateAvatar[]>([])
  // Malmeglere er plattform-konfigurasjon (globale voice-ID-er) — vises kun for superadmin.
  // Lagring håndheves uansett server-side (PATCH krever LARS_EMAIL).
  const [isSuperadmin, setIsSuperadmin] = useState(false)

  async function loadMembers() {
    setLoading(true)
    const res = await fetch('/api/org/members')
    if (!res.ok) {
      const d = await res.json()
      setError(d.error || 'Kunne ikke laste meglere')
    } else {
      const d = await res.json()
      setMembers(d.members ?? [])
      setIsSuperadmin(!!d.is_superadmin)
    }
    setLoading(false)
  }

  async function loadTemplateAvatars() {
    const res = await fetch('/api/admin/template-avatars')
    if (res.ok) {
      const d = await res.json()
      setTemplateAvatars(d.avatars ?? [])
    }
  }

  async function saveAvatarVoice(id: string, voiceId: string) {
    await fetch('/api/admin/template-avatars', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, voiceId }),
    })
    setTemplateAvatars(prev =>
      prev.map(a => a.id === id ? { ...a, voiceId } : a)
    )
  }

  async function removeMember(memberId: string) {
    if (!confirm('Er du sikker på at du vil fjerne denne megleren?')) return
    setRemoving(memberId)
    const res = await fetch('/api/org/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    })
    if (res.ok) setMembers(prev => prev.filter(m => m.id !== memberId))
    setRemoving(null)
  }

  useEffect(() => {
    loadMembers()
    loadTemplateAvatars()
  }, [])

  if (loading) {
    return (
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '64px', borderRadius: '10px', background: 'var(--line)', opacity: 0.4 }} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
        <div className="app-error">{error}</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '48px' }}>

      {/* ── Meglere ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', marginBottom: '2px' }}>Meglere</h1>
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {members.length} megler{members.length !== 1 ? 'e' : ''}
            </p>
          </div>
          <Link href="/dashboard/admin/invite" className="app-btn-primary" style={{ padding: '8px 16px', fontSize: '13px', textDecoration: 'none', display: 'inline-block' }}>
            + Inviter megler
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {members.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--muted)', textAlign: 'center', padding: '24px' }}>
              Ingen meglere ennå. Inviter den første!
            </p>
          ) : members.map(member => (
            <div
              key={member.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '12px 16px',
              }}
            >
              {member.profile?.portrait_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.profile.portrait_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--muted)' }}>
                    {member.profile?.name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {member.profile?.name ?? 'Ikke satt opp ennå'}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {member.profile?.email ?? '—'}
                </p>
              </div>

              <span className={member.role === 'admin' ? 'app-badge-gold' : 'app-badge-muted'}>
                {member.role === 'admin' ? 'Admin' : 'Megler'}
              </span>

              {member.role !== 'admin' && (
                <button onClick={() => removeMember(member.id)} disabled={removing === member.id} className="app-btn-danger">
                  {removing === member.id ? '…' : 'Fjern'}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Malmeglere (kun superadmin — global plattform-konfigurasjon) ── */}
      {isSuperadmin && templateAvatars.length > 0 && (
        <section>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>Malmeglere</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Forhåndslagde AI-meglere. Klikk ▶ for å høre stemmen, «Endre» for å bytte Voice ID fra{' '}
              <a href="https://elevenlabs.io/voice-library" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>
                ElevenLabs-biblioteket
              </a>.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {templateAvatars.map(avatar => (
              <AvatarRow key={avatar.id} avatar={avatar} onSave={saveAvatarVoice} />
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
