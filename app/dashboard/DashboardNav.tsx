'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'

const BASE_LINKS = [
  { href: '/dashboard/properties', label: 'Eiendommer' },
  { href: '/dashboard/profile', label: 'Profil' },
  { href: '/dashboard/billing', label: 'Fakturering' },
]

export default function DashboardNav() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/org/me')
      .then(r => r.json())
      .then(d => { if (d.role === 'admin') setIsAdmin(true) })
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
      <Link href="/" className="app-nav-logo">
        <span className="mark">R</span>
        <span>Reel<span style={{ color: 'var(--muted)' }}>Home</span></span>
      </Link>
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
      <button onClick={handleLogout} className="app-btn-ghost ml-auto text-xs">
        Logg ut
      </button>
    </nav>
  )
}
