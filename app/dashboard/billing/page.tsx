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

const PLAN_LABELS: Record<string, { label: string; price: string; color: string }> = {
  starter: { label: 'Starter', price: 'kr 499/mnd', color: 'blue' },
  pro: { label: 'Pro', price: 'kr 999/mnd', color: 'purple' },
  kontor: { label: 'Kontor', price: 'kr 699/mnd per megler', color: 'green' },
  trial: { label: 'Prøveperiode', price: '14 dager gratis', color: 'orange' },
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
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-1/3" />
          <div className="h-32 bg-gray-100 rounded-xl" />
          <div className="h-24 bg-gray-100 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!credits) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-sm text-red-600">Kunne ikke laste faktureringsinformasjon.</p>
      </div>
    )
  }

  const planInfo = PLAN_LABELS[credits.plan] ?? PLAN_LABELS.trial
  const usedPct = Math.min(100, Math.round((credits.used_this_month / credits.included_per_month) * 100))
  const resetDate = new Date(credits.reset_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-xl font-semibold text-gray-900 mb-8">Fakturering</h1>

      {/* Plan card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-2 ${
              planInfo.color === 'blue' ? 'bg-blue-50 text-blue-700' :
              planInfo.color === 'purple' ? 'bg-purple-50 text-purple-700' :
              planInfo.color === 'green' ? 'bg-green-50 text-green-700' :
              'bg-orange-50 text-orange-700'
            }`}>
              {planInfo.label}
            </span>
            <p className="text-sm text-gray-500">{planInfo.price}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Nullstilles</p>
            <p className="text-sm font-medium text-gray-700">{resetDate}</p>
          </div>
        </div>

        {/* Usage bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Videoer brukt denne måneden</span>
            <span className="font-medium text-gray-900">
              {credits.used_this_month} / {credits.included_per_month}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usedPct >= 100 ? 'bg-red-500' : usedPct >= 80 ? 'bg-orange-400' : 'bg-blue-500'
              }`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">
            {credits.available > 0
              ? `${credits.available} video${credits.available !== 1 ? 'er' : ''} igjen`
              : 'Ingen videoer igjen denne måneden'}
          </p>
        </div>

        {/* Extra credits */}
        {credits.extra_credits > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-600">Kjøpte ekstra videoer</span>
            <span className="text-sm font-medium text-gray-900">{credits.extra_credits} stk</span>
          </div>
        )}
      </div>

      {/* Inkludert i planen */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Inkludert i planen</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            {credits.included_per_month} presentasjonsvideoer per måned
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            Ubegrenset setting-bilder (stillbilder med avatar)
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            Stemme-kloning inkludert
          </li>
          <li className="flex items-center gap-2">
            <span className="text-gray-400">+</span>
            Ekstra video: kr {credits.extra_credit_price_nok}/stk
          </li>
        </ul>
      </div>

      {/* Actions — Stripe kobles til i Fase 3 */}
      <div className="space-y-3">
        <button
          disabled
          className="w-full bg-blue-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg opacity-40 cursor-not-allowed"
          title="Kommer snart"
        >
          Kjøp ekstra video — kr {credits.extra_credit_price_nok}
        </button>
        <button
          disabled
          className="w-full border border-gray-300 text-gray-600 text-sm font-medium px-4 py-2.5 rounded-lg opacity-40 cursor-not-allowed"
          title="Kommer snart"
        >
          Endre plan
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center mt-6">
        Betaling via Stripe aktiveres snart. Ta kontakt på{' '}
        <a href="mailto:hei@boligforge.no" className="underline hover:text-gray-600">hei@boligforge.no</a>
        {' '}ved spørsmål.
      </p>
    </div>
  )
}
