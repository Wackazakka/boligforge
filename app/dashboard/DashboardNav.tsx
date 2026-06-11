'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'

const BASE_LINKS = [
  { href: '/dashboard/properties', label: 'Eiendommer' },
  { href: '/dashboard/collections', label: 'Mapper' },
  { href: '/dashboard/settings/social', label: 'Publisering' },
  { href: '/dashboard/calendar', label: 'Kalender' },
  { href: '/dashboard/profile', label: 'Profil' },
]

export default function DashboardNav() {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/org/me')
      .then(r => r.json())
      .then(d => { setRole(d.role ?? null) })
      .catch(() => {})
  }, [])

  const isAdmin      = role === 'admin' || role === 'superadmin'
  const isSuperadmin = role === 'superadmin'

  const links = [
    ...BASE_LINKS,
    ...(isAdmin      ? [{ href: '/dashboard/team',  label: 'Team'   }] : []),
    ...(isAdmin      ? [{ href: '/dashboard/admin', label: 'Admin'  }] : []),
    ...(isSuperadmin ? [{ href: '/admin',           label: '⚡ BO'   }] : []),
  ]

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <nav className="app-nav">
      {/* Logo — venstre */}
      <Link href="/" className="app-nav-logo rh-lockup" aria-label="ReelHome">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand-kit/reelhome-mark.svg" alt="" width="28" height="28" />
        <span className="rh-wm">ReelHome<span className="rh-ai">.ai</span></span>
      </Link>

      {/* Lenker — midtstilt */}
      <div className="app-nav-links">
        {links.map(link => {
          const active = pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`app-nav-link${active ? ' active' : ''}`}
            >
              {link.label}
            </Link>
          )
        })}
      </div>

      {/* Priser + Logg ut — høyre */}
      <div className="ml-auto flex items-center gap-3">
        <a href="/#priser" className="app-nav-link text-xs">Priser</a>
        <button onClick={handleLogout} className="app-btn-ghost text-xs">
          Logg ut
        </button>
      </div>
    </nav>
  )
}
