'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AccountTabs() {
  const pathname = usePathname()
  const tabs = [
    { href: '/dashboard/profile',         label: 'Profil' },
    { href: '/dashboard/billing',         label: 'Fakturering' },
    { href: '/dashboard/settings/social', label: 'Sosiale medier' },
  ]
  return (
    <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--line)', marginBottom: '32px' }}>
      {tabs.map(tab => {
        const active = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--ink)' : 'var(--muted)',
              borderBottom: active ? '2px solid var(--ink)' : '2px solid transparent',
              textDecoration: 'none',
              marginBottom: '-1px',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
