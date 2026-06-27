import Link from 'next/link'

export const metadata = { title: 'ReelHome Backoffice' }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
      <nav style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }} aria-label="ReelHome Backoffice">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand-kit/reelhome-mark.svg" alt="" width={24} height={24} />
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            ReelHome<span style={{ color: 'var(--blue)' }}>.ai</span> <span style={{ color: 'var(--muted)', fontWeight: 500 }}>Backoffice</span>
          </span>
        </Link>
        <Link href="/admin" style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', fontWeight: 600 }}>
          Oversikt
        </Link>
        <Link href="/admin/sellers" style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', fontWeight: 600 }}>
          Selgere
        </Link>
        <Link href="/admin/avatar-queue" style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', fontWeight: 600 }}>
          Avatar-kø
        </Link>
        <Link href="/admin/usage" style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', fontWeight: 600 }}>
          Bruk
        </Link>
        <Link href="/admin/avatars" style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', fontWeight: 600 }}>
          Avatarer
        </Link>
        <Link href="/admin/kalkyle" style={{ fontSize: 13, color: 'var(--ink-3)', textDecoration: 'none', fontWeight: 600 }}>
          Kalkyle
        </Link>
        <Link href="/dashboard" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none', marginLeft: 'auto' }}>
          → Dashboard
        </Link>
      </nav>
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        {children}
      </main>
    </div>
  )
}
