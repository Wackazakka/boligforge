import Link from 'next/link'

export const metadata = { title: 'ReelHome Backoffice' }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0f0f10', color: '#f0f0f0', fontFamily: 'var(--sans, system-ui)' }}>
      <nav style={{ borderBottom: '1px solid #222', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/admin" style={{ fontWeight: 700, fontSize: '14px', color: '#f0f0f0', textDecoration: 'none', letterSpacing: '-0.01em' }}>
          ⚡ ReelHome Backoffice
        </Link>
        <Link href="/admin/sellers" style={{ fontSize: '13px', color: '#a1a1aa', textDecoration: 'none' }}>
          Selgere
        </Link>
        <Link href="/dashboard" style={{ fontSize: '12px', color: '#666', textDecoration: 'none', marginLeft: 'auto' }}>
          → Dashboard
        </Link>
      </nav>
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        {children}
      </main>
    </div>
  )
}
