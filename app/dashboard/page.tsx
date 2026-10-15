import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '../../lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import GettingStarted, { type ChecklistStep } from './GettingStarted'
import { hentSaldo } from '../../lib/boliger'

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

  // Avatar/stemme/logo lagres i agent_profiles (keyed by user_id), ikke i profiles.
  const { data: agentProfile } = await serviceSupabase
    .from('agent_profiles')
    .select('portrait_url, logo_url, default_voice_id, name, phone')
    .eq('user_id', user.id)
    .maybeSingle()

  // ── Kom-i-gang-sjekkliste: sjekk om brukeren har laget sin første video ──
  // property_videos har ingen organization_id, så vi knytter videoer til org
  // via medlemmenes user_id (samme mønster som backoffice-rapporten).
  const { data: orgMembers } = await serviceSupabase
    .from('profiles')
    .select('id')
    .eq('organization_id', profile.organization_id)

  const memberIds = (orgMembers ?? []).map(m => m.id)

  let hasVideo = false
  if (memberIds.length > 0) {
    const { count } = await serviceSupabase
      .from('property_videos')
      .select('id', { count: 'exact', head: true })
      .in('user_id', memberIds)
      .not('video_url', 'is', null)
      .neq('video_url', '')
    hasVideo = (count ?? 0) > 0
  }

  // En avatar er valgt hvis brukeren har et portrettbilde (egen eller mal)
  // ELLER har valgt en konkret setting-bakgrunn.
  const hasAvatar = Boolean(agentProfile?.portrait_url)
  const hasVoice  = Boolean(agentProfile?.default_voice_id)
  const hasLogo   = Boolean(agentProfile?.logo_url)
  // Malmegler-veien gaar rett fra onboarding til dashbordet og innom aldri
  // profilskjemaet - i motsetning til «egen avatar»-veien, som lander midt i
  // det. Uten dette steget ble navn og kontaktinfo aldri etterspurt.
  // Navn settes alltid ved registrering, saa et steg som haker av paa navn ville
  // vaert et groent merke for noe brukeren aldri gjorde. Telefon og nettside er
  // derimot ALDRI etterspurt paa malmegler-veien - den gaar rett til dashbordet og
  // innom aldri profilskjemaet. Steget staar derfor aapent til det er fylt ut,
  // merket valgfritt (som logo), saa muligheten er synlig uten aa vaere et krav.
  const hasDetails = Boolean(agentProfile?.phone)

  const checklistSteps: ChecklistStep[] = [
    { key: 'account', label: 'Konto opprettet',       hint: '',                                           href: '/dashboard',                  done: true },
    { key: 'details', label: 'Legg til kontaktinfo (valgfritt)', hint: 'Telefon, tittel og nettside på profilen din',               href: '/dashboard/profile',          done: hasDetails },
    { key: 'avatar',  label: 'Velg avatar',            hint: 'Velg en malmegler eller last opp ditt eget bilde', href: '/dashboard/profile',     done: hasAvatar },
    { key: 'voice',   label: 'Legg til en stemme',     hint: 'Velg en standardstemme eller klon din egen', href: '/dashboard/profile',          done: hasVoice },
    { key: 'logo',    label: 'Last opp logo (valgfritt)', hint: 'Vises i videoene dine',                   href: '/dashboard/profile',          done: hasLogo },
    { key: 'video',   label: 'Lag din første video',   hint: 'Lim inn en Hjem- eller Finn-lenke og generer',           href: '/dashboard/properties',       done: hasVideo },
  ]

  // Vis sjekklisten kun før første video er laget.
  const showChecklist = !hasVideo

  // Bolig-saldo (16/10): betaling er per bolig, ikke per video. Samme kilde
  // som porten i /api/video/generate (lib/boliger.ts).
  const saldo = await hentSaldo(serviceSupabase, user.id)
  const firstName = profile.full_name?.split(' ')[0] ?? 'der'
  const harAbonnement = saldo.abonnementer.length > 0
  const saldoTekst = saldo.lagSelv.igjen > 0
    ? `${saldo.lagSelv.igjen} bolig${saldo.lagSelv.igjen === 1 ? '' : 'er'} igjen i abonnementet`
    : null
  const nesteBoligTekst = saldo.gratisBoligIgjen
    ? ['Din første bolig er gratis', saldoTekst].filter(Boolean).join(' · ')
    : saldoTekst ?? `Neste bolig koster ${saldo.nestePris.toLocaleString('nb-NO')} kr`

  return (
    <div className="p-6">
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        {/* Velkomst */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
            Hei, {firstName} 👋
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--muted)' }}>
            {hasVideo ? 'Klar til å lage en ny visningsvideo?' : 'La oss gjøre deg klar til den første videoen.'}
          </p>
        </div>

        {/* Kom-i-gang-sjekkliste — kun for nye brukere uten video ennå */}
        {showChecklist && <GettingStarted steps={checklistSteps} />}

        {/* Stats-rad: boliger, ikke videoer (16/10). Alle formater og
            regenereringer på en opplåst bolig er fri, så det eneste tallet som
            betyr noe er hvor mange boliger du har laget og hva neste koster. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '40px' }}>

          <div className="app-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500, marginBottom: '10px' }}>
              Boliger denne måneden
            </div>
            <div style={{ fontSize: '44px', fontWeight: 700, lineHeight: 1, color: 'var(--ink)' }}>
              {saldo.boligerDenneMaaneden}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted-2)', marginTop: '8px' }}>
              {nesteBoligTekst}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '10px' }}>
              Alle formater og endringer på en bolig er inkludert.{' '}
              <Link href="/dashboard/billing" style={{ color: 'var(--blue)', textDecoration: 'none' }}>
                {harAbonnement ? 'Se abonnement' : 'Se priser'}
              </Link>
            </div>
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
