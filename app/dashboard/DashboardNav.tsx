'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'

const BASE_LINKS = [
  { href: '/dashboard/properties', label: 'Eiendommer' },
  { href: '/dashboard/profile', label: 'Profil' },
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
    <nav className="bg-white border-b border-gray-200 px-6 py-0 flex items-center gap-1 h-12">
      <span className="text-sm font-bold text-gray-900 mr-4">BoligForge</span>
      {links.map(link => {
        const active = pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
      <button
        onClick={handleLogout}
        className="ml-auto text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100"
      >
        Logg ut
      </button>
    </nav>
  )
}
