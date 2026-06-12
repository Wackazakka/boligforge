'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Plan = 'starter' | 'aktiv' | 'pro' | 'enkelt'
type Status = 'anonymous' | 'trial' | 'paid'

export default function PricingCTA({ plan }: { plan: Plan }) {
  const [status, setStatus] = useState<Status>('anonymous')

  useEffect(() => {
    fetch('/api/org/me')
      .then(r => {
        if (r.status === 401) return null
        return r.json()
      })
      .then(d => {
        if (!d || (!d.org && !d.role)) return
        const trialEnd = d.org?.trial_ends_at
        if (trialEnd && new Date(trialEnd) > new Date()) {
          setStatus('trial')
        } else if (d.role) {
          setStatus('paid')
        }
      })
      .catch(() => {})
  }, [])

  if (plan === 'pro') {
    return <a href="mailto:hei@reelhome.no" className="btn btn-ghost">Snakk med salg</a>
  }

  if (status === 'trial') {
    return <Link href="/dashboard" className="btn btn-ghost">Prøveperiode aktiv →</Link>
  }

  if (status === 'paid') {
    const labels: Record<Plan, string> = {
      starter: 'Velg Starter',
      aktiv: 'Velg Aktiv',
      pro: 'Snakk med salg',
      enkelt: 'Kjøp enkeltvideo',
    }
    return <Link href="/dashboard" className="btn btn-ghost">{labels[plan]}</Link>
  }

  // anonymous
  if (plan === 'enkelt') {
    return <Link href="/auth/signup" className="btn btn-ghost">Kjøp enkeltvideo</Link>
  }
  return <Link href="/auth/signup" className="btn btn-ghost">Start gratis prøveperiode</Link>
}
