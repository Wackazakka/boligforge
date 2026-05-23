import DashboardNav from './DashboardNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
      <DashboardNav />
      <main>{children}</main>
    </div>
  )
}
