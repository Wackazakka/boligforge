'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { chooseTemplateAvatarAction } from './actions'

const R2 = 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/template-avatars'

const TEMPLATE_AVATARS = [
  {
    id:          'sofia',
    name:        'Sofia',
    desc:        'Varm og profesjonell',
    voiceId:     'uNsWM1StCcpydKYOjKyu',
    portraitUrl: `${R2}/sofia.jpg`,
  },
  {
    id:          'marius',
    name:        'Marius',
    desc:        'Klar og selvsikker',
    voiceId:     's2xtA7B2CTXPPlJzch1v',
    portraitUrl: `${R2}/marius.jpg`,
  },
  {
    id:          'ingrid',
    name:        'Ingrid',
    desc:        'Nordisk og elegant',
    voiceId:     'BGEU6wFi2uNm6Kje1Yhk',
    portraitUrl: `${R2}/ingrid.jpg`,
  },
  {
    id:          'even',
    name:        'Even',
    desc:        'Rolig og trygg',
    voiceId:     'vUmLiNBm6MDcy1NUHaVr',
    portraitUrl: `${R2}/even.jpg`,
  },
  {
    id:          'hanna',
    name:        'Hanna',
    desc:        'Engasjert og moderne',
    voiceId:     'jsCqWAovK2LkecY7zXl4',
    portraitUrl: `${R2}/hanna.jpg`,
  },
  {
    id:          'erik',
    name:        'Erik',
    desc:        'Erfaren og grundig',
    voiceId:     'nhvaqgRyAq6BmFs3WcdX',
    portraitUrl: `${R2}/erik.jpg`,
  },
]

export default function AvatarOnboardingPage() {
  const [selected, setSelected] = useState<string | null>(null)
  const [error, formAction, isPending] = useActionState(chooseTemplateAvatarAction, null)

  const selectedAvatar = TEMPLATE_AVATARS.find(a => a.id === selected)

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px' }}>

      {/* Logo */}
      <div style={{ marginBottom: '48px', alignSelf: 'flex-start', marginLeft: 'auto', marginRight: 'auto', maxWidth: '760px', width: '100%' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png?v=1" alt="ReelHome" style={{ height: '72px', width: 'auto' }} />
        </Link>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>1</div>
        <div style={{ width: '32px', height: '2px', background: '#d1d5db' }} />
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#fff' }}>2</div>
      </div>

      <div style={{ width: '100%', maxWidth: '760px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f0f0f', marginBottom: '8px' }}>
          Velg hvordan du vil starte
        </h1>
        <p style={{ fontSize: '15px', color: '#737373', marginBottom: '40px' }}>
          Du kan alltid bytte til din egen avatar senere under Profil.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

          {/* ── Alternativ A: Malmegler ── */}
          <div className="app-card" style={{ padding: '28px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Raskeste start
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f0f0f', marginBottom: '8px' }}>
              Bruk en malmegler
            </h2>
            <p style={{ fontSize: '14px', color: '#737373', marginBottom: '24px', lineHeight: 1.6 }}>
              Velg en av våre forhåndslagde AI-meglere. Klar til å lage video på 2 klikk.
            </p>

            {/* Avatar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {TEMPLATE_AVATARS.map(avatar => (
                <button
                  key={avatar.id}
                  onClick={() => setSelected(avatar.id)}
                  style={{
                    border: selected === avatar.id ? '2px solid #2563eb' : '2px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '10px 8px',
                    background: selected === avatar.id ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatar.portraitUrl}
                    alt={avatar.name}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      objectPosition: 'center 20%',
                      display: 'block',
                    }}
                  />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f0f0f' }}>{avatar.name}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', lineHeight: 1.3 }}>{avatar.desc}</div>
                </button>
              ))}
            </div>

            {/* Form — submit med valgt avatar */}
            <form action={formAction}>
              <input type="hidden" name="voice_id"     value={selectedAvatar?.voiceId ?? ''} />
              <input type="hidden" name="avatar_name"  value={selectedAvatar?.name ?? ''} />
              <input type="hidden" name="portrait_url" value={selectedAvatar?.portraitUrl ?? ''} />
              {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
              <button
                type="submit"
                disabled={!selected || isPending}
                className="app-btn-primary w-full"
                style={{ opacity: !selected ? 0.4 : 1 }}
              >
                {isPending ? 'Starter…' : selected ? `Fortsett med ${selectedAvatar?.name} →` : 'Velg en avatar over'}
              </button>
            </form>
          </div>

          {/* ── Alternativ B: Egen avatar ── */}
          <div className="app-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
              Mer personlig
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f0f0f', marginBottom: '8px' }}>
              Sett opp din egen avatar
            </h2>
            <p style={{ fontSize: '14px', color: '#737373', marginBottom: '24px', lineHeight: 1.6 }}>
              Last opp portrettbilde og klon din stemme. Videoene ser ut som du snakker direkte til kjøperne.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                '🎙 Din stemme, klonet med AI',
                '📸 Ditt ansikt i profesjonelle settings',
                '🏠 Boligens megler presenterer boligen',
              ].map(item => (
                <li key={item} style={{ fontSize: '14px', color: '#374151', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span>{item.split(' ')[0]}</span>
                  <span>{item.split(' ').slice(1).join(' ')}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/dashboard/profile"
              className="app-btn-secondary w-full"
              style={{ marginTop: '24px', display: 'block', textAlign: 'center', textDecoration: 'none', padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#0f0f0f' }}
            >
              Sett opp min avatar →
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
