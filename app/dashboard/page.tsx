import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '../../lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import TopupBanner from './TopupBanner'

// Service-role client for data reads — brukes etter at bruker er verifisert
// via createSupabaseServerClient().auth.getUser(). Bypasser RLS-problematikk
// med den nye sb_publishable-nøkkelformatet.
const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export default async function DashboardPage() {
  // Brukeridentitet verifiseres alltid med SSR-klienten (cookie-session)
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Data leses med service role for å unngå RLS-problemer med ny nøkkelformat
  const { data: profile } = await serviceSupabase
    .from('profiles')
    .select('full_name, organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.organization_id) redirect('/onboarding')

  const { data: credits } = await serviceSupabase
    .from('credits')
    .select('total, used')
    .eq('organization_id', profile.organization_id)
    .maybeSingle()

  const { data: org } = await serviceSupabase
    .from('organizations')
    .select('trial_ends_at')
    .eq('id', profile.organization_id)
    .maybeSingle()

  const remaining  = credits ? credits.total - credits.used : 0
  const total      = credits?.total ?? 0
  const firstName  = profile.full_name?.split(' ')[0] ?? 'der'
  const usedPct    = total > 0 ? Math.round(((credits?.used ?? 0) / total) * 100) : 0

  const trialDaysLeft = org?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null
  const isInTrial = trialDaysLeft !== null && trialDaysLeft > 0

  return (
    <div className="p-6">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        {/* Velkomst */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
            Hei, {firstName} 👋
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--muted)' }}>
            Klar til å lage en ny visningsvideo?
          </p>
        </div>

        {/* Trial-banner */}
        {isInTrial && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '10px',
            padding: '14px 20px',
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <p style={{ fontSize: '14px', color: '#92400e', margin: 0 }}>
              ⏳ Du har <strong>{trialDaysLeft} dag{trialDaysLeft === 1 ? '' : 'er'} igjen</strong> av din gratis prøveperiode.
            </p>
            <Link
              href="/dashboard/billing"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#2563eb',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Velg plan for å fortsette etter trialen →
            </Link>
          </div>
        )}

        {/* Topup-banner — vises når ≤ 1 video gjenstår */}
        {remaining <= 1 && credits && (
          <TopupBanner remaining={remaining} />
        )}

        {/* Stats-rad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '40px' }}>

          {/* Gjenstående videoer */}
          <div className="app-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, marginBottom: '10px' }}>
              Gjenstående videoer
            </div>
            <div style={{
              fontSize: '44px', fontWeight: 700, lineHeight: 1,
              color: remaining > 0 ? 'var(--ink)' : '#ef4444',
            }}>
              {remaining}
            </div>
            {total > 0 && (
              <>
                <div style={{ fontSize: '13px', color: 'var(--muted-2)', marginTop: '6px' }}>
                  av {total} denne måneden
                </div>
                {/* Progressbar */}
                <div style={{ marginTop: '14px', height: '4px', background: 'var(--line)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${usedPct}%`,
                    background: usedPct > 80 ? '#ef4444' : 'var(--blue)',
                    borderRadius: '99px',
                    transition: 'width 0.4s',
                  }} />
                </div>
              </>
            )}
            {!credits && (
              <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
                Ingen aktiv plan ·{' '}
                <Link href="/dashboard/billing" style={{ color: 'var(--blue)', textDecoration: 'none' }}>
                  Velg plan
                </Link>
              </div>
            )}
          </div>

        </div>

        {/* Hoved-CTA */}
        <Link
          href="/dashboard/properties"
          className="app-btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '15px', padding: '12px 24px' }}
        >
          <span>+</span> Lag ny video
        </Link>

      </div>
    </div>
  )
}
