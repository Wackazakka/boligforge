'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Credits {
  plan: string
  used_this_month: number
  included_per_month: number
  extra_credits: number
  available: number
  extra_credit_price_nok: number
  reset_at: string
}

const PLAN_LABELS: Record<string, { label: string; price: string }> = {
  starter: { label: 'Starter', price: 'kr 499/mnd' },
  pro: { label: 'Pro', price: 'kr 999/mnd' },
  kontor: { label: 'Kontor', price: 'kr 699/mnd per megler' },
  trial: { label: 'Prøveperiode', price: '14 dager gratis' },
}

export default function BillingPage() {
  const [credits, setCredits] = useState<Credits | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/video/credits')
      .then(r => r.json())
      .then(d => { setCredits(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl animate-pulse" style={{ height: i === 1 ? '160px' : '100px', background: 'var(--surface)' }} />
          ))}
        </div>
      </div>
    )
  }

  if (!credits) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="app-error">Kunne ikke laste faktureringsinformasjon.</p>
      </div>
    )
  }

  const planInfo = PLAN_LABELS[credits.plan] ?? PLAN_LABELS.trial
  const usedPct = Math.min(100, Math.round((credits.used_this_month / credits.included_per_month) * 100))
  const resetDate = new Date(credits.reset_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })

  const progressColor = usedPct >= 100 ? '#c84b4b' : usedPct >= 80 ? '#c87f30' : 'var(--gold)'

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1
        className="text-xl font-semibold mb-8"
        style={{ color: 'var(--ink)', fontFamily: 'var(--sans)' }}
      >
        Fakturering
      </h1>

      {/* Plan card */}
      <div className="app-card mb-4">
        <div className="flex items-start justify-between mb-5">
          <div>
            <span className="app-badge-gold mb-2 inline-block">{planInfo.label}</span>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{planInfo.price}</p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Nullstilles</p>
            <p className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>{resetDate}</p>
          </div>
        </div>

        {/* Usage bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--ink-2)' }}>Videoer brukt denne måneden</span>
            <span className="font-medium" style={{ color: 'var(--ink)' }}>
              {credits.used_this_month} / {credits.included_per_month}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${usedPct}%`, background: progressColor }}
            />
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {credits.available > 0
              ? `${credits.available} video${credits.available !== 1 ? 'er' : ''} igjen`
              : 'Ingen videoer igjen denne måneden'}
          </p>
        </div>

        {credits.extra_credits > 0 && (
          <div
            className="mt-4 pt-4 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--line)' }}
          >
            <span className="text-sm" style={{ color: 'var(--ink-2)' }}>Kjøpte ekstra videoer</span>
            <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{credits.extra_credits} stk</span>
          </div>
        )}
      </div>

      {/* Inkludert i planen */}
      <div className="app-card mb-4" style={{ background: 'var(--surface-2)' }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--ink-2)' }}>Inkludert i planen</h3>
        <ul className="space-y-2 text-sm" style={{ color: 'var(--muted)' }}>
          <li className="flex items-center gap-2">
            <span style={{ color: 'var(--gold)' }}>✓</span>
            {credits.included_per_month} presentasjonsvideoer per måned
          </li>
          <li className="flex items-center gap-2">
            <span style={{ color: 'var(--gold)' }}>✓</span>
            Ubegrenset setting-bilder (stillbilder med avatar)
          </li>
          <li className="flex items-center gap-2">
            <span style={{ color: 'var(--gold)' }}>✓</span>
            Stemme-kloning inkludert
          </li>
          <li className="flex items-center gap-2">
            <span style={{ color: 'var(--line-2)' }}>+</span>
            Ekstra video: kr {credits.extra_credit_price_nok}/stk
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          disabled
          className="app-btn-primary w-full opacity-40 cursor-not-allowed"
          title="Kommer snart"
        >
          Kjøp ekstra video — kr {credits.extra_credit_price_nok}
        </button>
        <button
          disabled
          className="app-btn-secondary w-full opacity-40 cursor-not-allowed"
          title="Kommer snart"
        >
          Endre plan
        </button>
      </div>

      <p className="text-xs text-center mt-6" style={{ color: 'var(--muted)' }}>
        Betaling via Stripe aktiveres snart. Ta kontakt på{' '}
        <a href="mailto:hei@reelhome.no" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
          hei@reelhome.no
        </a>
        {' '}ved spørsmål.
      </p>
    </div>
  )
}
