'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'

const BASE_LINKS = [
  { href: '/dashboard/properties', label: 'Eiendommer' },
  { href: '/dashboard/collections', label: 'Mapper' },
  { href: '/dashboard/settings/social', label: 'Publisering' },
  { href: '/dashboard/profile', label: 'Profil' },
]

export default function DashboardNav() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/org/me')
      .then(r => r.json())
      .then(d => { if (d.role === 'admin' || d.role === 'superadmin') setIsAdmin(true) })
      .catch(() => {})
  }, [])

  const links = isAdmin
    ? [...BASE_LINKS, { href: '/dashboard/admin', label: 'Admin' }]
    : BASE_LINKS

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
      <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px' }}>
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

      {/* Logg ut — høyre */}
      <button onClick={handleLogout} className="app-btn-ghost ml-auto text-xs">
        Logg ut
      </button>
    </nav>
  )
}
