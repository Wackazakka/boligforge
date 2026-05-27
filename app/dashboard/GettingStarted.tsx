'use client'

import Link from 'next/link'
import { useState } from 'react'

export type ChecklistStep = {
  key: string
  label: string
  hint: string
  href: string
  done: boolean
}

const DISMISS_KEY = 'rh_getting_started_dismissed'

export default function GettingStarted({ steps }: { steps: ChecklistStep[] }) {
  // Hvis bruker tidligere har lukket kortet, ikke vis det igjen.
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  })

  if (dismissed) return null

  const doneCount = steps.filter(s => s.done).length
  const total = steps.length
  const allDone = doneCount === total
  const pct = Math.round((doneCount / total) * 100)

  function handleDismiss() {
    try { window.localStorage.setItem(DISMISS_KEY, '1') } catch {}
    setDismissed(true)
  }

  return (
    <div className="app-card" style={{ padding: '24px', marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            {allDone ? '🎉 Du er klar!' : 'Kom i gang'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '4px 0 0' }}>
            {allDone
              ? 'Alt er satt opp. Lykke til med videoene!'
              : `${doneCount} av ${total} steg fullført — gjør deg klar til din første video.`}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="app-btn-ghost text-xs"
          style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}
          title="Skjul denne sjekklisten"
        >
          Skjul
        </button>
      </div>

      {/* Progressbar */}
      <div style={{ marginTop: '14px', marginBottom: '20px', height: '4px', background: 'var(--line)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: allDone ? '#4ade80' : 'var(--blue)',
          borderRadius: '99px',
          transition: 'width 0.4s',
        }} />
      </div>

      {/* Steg */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {steps.map(step => (
          <li key={step.key}>
            <Link
              href={step.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '10px',
                textDecoration: 'none',
                background: step.done ? 'transparent' : 'var(--surface-2)',
                opacity: step.done ? 0.6 : 1,
                transition: 'background 0.15s',
              }}
            >
              {/* Status-ikon */}
              <span
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: step.done ? '#4ade80' : 'transparent',
                  color: step.done ? '#052e16' : 'var(--muted)',
                  border: step.done ? 'none' : '2px solid var(--line-2)',
                }}
              >
                {step.done ? '✓' : ''}
              </span>

              <span style={{ flex: 1 }}>
                <span style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  textDecoration: step.done ? 'line-through' : 'none',
                }}>
                  {step.label}
                </span>
                {!step.done && (
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    {step.hint}
                  </span>
                )}
              </span>

              {!step.done && (
                <span style={{ flexShrink: 0, fontSize: '13px', fontWeight: 600, color: 'var(--blue)' }}>→</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
