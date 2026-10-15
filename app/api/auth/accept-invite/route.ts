import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

// Provisjonerer en invitert bruker fra invite-metadataene (organization_id +
// role satt av team-/org-/kjede-invitasjonsrutene). Kalles fra
// /auth/accept-invite ETTER at klienten har konsumert sesjonstokenene.
// Idempotent, og rører ALDRI en bruker som allerede tilhører en organisasjon
// (stale metadata skal ikke kunne flytte etablerte brukere).

export const runtime = 'nodejs'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const client = sb()

  // ── Hjem.no-inngangen (16/10) ─────────────────────────────────────────────
  // Metadata satt av /api/hjem/send-lenke: kontor + megler fra annonsen.
  // Kontoret opprettes av FØRSTE megler fra kontoret (hjem_agency_id), senere
  // meglere knyttes til det. Returnerende brukere sendes rett til annonsen.
  const hjem = user.user_metadata?.hjem as {
    listing_url?: string; agency_id?: number | null; agency_name?: string | null; agency_parent_id?: number | null
    agency_logo_url?: string | null; name?: string; phone?: string | null; position?: string | null; image?: string | null; done?: boolean
  } | undefined
  if (hjem && !hjem.done) {
    const hent = hjem.listing_url ? `?hent=${encodeURIComponent(hjem.listing_url)}` : ''
    const { data: membership } = await client
      .from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle()

    let next = `/dashboard/properties${hent}`
    if (!membership?.organization_id) {
      // Finn eller opprett kontoret.
      let orgId: string | null = null
      let nyttKontor = false
      if (hjem.agency_id != null) {
        const { data: org } = await client.from('organizations').select('id').eq('hjem_agency_id', hjem.agency_id).maybeSingle()
        orgId = org?.id ?? null
      }
      if (!orgId) {
        const navn = hjem.agency_name?.trim() || `${hjem.name ?? 'Megler'} (kontor)`
        const slug = `${navn.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.random().toString(36).slice(2, 7)}`
        const { data: org, error: orgError } = await client
          .from('organizations')
          .insert({ name: navn, slug, plan: 'free', owner_id: user.id, logo_url: hjem.agency_logo_url ?? null, hjem_agency_id: hjem.agency_id ?? null })
          .select('id')
          .single()
        if (orgError || !org) {
          // Samtidig første megler fra samme kontor: hent raden som vant.
          const { data: igjen } = hjem.agency_id != null
            ? await client.from('organizations').select('id').eq('hjem_agency_id', hjem.agency_id).maybeSingle()
            : { data: null }
          if (!igjen) {
            console.error('[accept-invite] hjem: organizations insert error', orgError)
            return NextResponse.json({ error: orgError?.message ?? 'Kunne ikke opprette kontoret' }, { status: 500 })
          }
          orgId = igjen.id
        } else {
          orgId = org.id
          nyttKontor = true
        }
      }

      // Første megler fra kontoret blir administrator (avtalen punkt 4).
      const admin = nyttKontor
      const { error: profileError } = await client.from('profiles').upsert({
        id: user.id,
        organization_id: orgId,
        full_name: hjem.name ?? (user.user_metadata?.full_name as string | undefined) ?? '',
        role: admin ? 'admin' : 'agent',
        account_type: admin ? 'team_admin' : 'team_member',
      }, { onConflict: 'id' })
      if (profileError) {
        console.error('[accept-invite] hjem: profile upsert error', profileError)
        return NextResponse.json({ error: profileError.message }, { status: 500 })
      }
      const { error: memberError } = await client.from('organization_members')
        .upsert({ organization_id: orgId, user_id: user.id, role: admin ? 'admin' : 'member' }, { onConflict: 'organization_id,user_id' })
      if (memberError) {
        console.error('[accept-invite] hjem: organization_members error', memberError)
        return NextResponse.json({ error: memberError.message }, { status: 500 })
      }
      // Meglerprofilen forhåndsutfylles fra annonsen (navn, tittel, telefon,
      // e-post, kontorlogo). Portrettet fra annonsen er bare et bilde, ikke en
      // avatar — det velger hun selv på profilsiden.
      await client.from('agent_profiles').upsert({
        user_id: user.id,
        name: hjem.name ?? '',
        title: hjem.position ?? null,
        phone: hjem.phone ?? null,
        email: user.email ?? null,
        logo_url: hjem.agency_logo_url ?? null,
      }, { onConflict: 'user_id' })
      console.log(`[accept-invite] hjem: user ${user.id} → org ${orgId} (${nyttKontor ? 'nytt kontor, admin' : 'eksisterende kontor'})`)
    }

    await client.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, hjem: { ...hjem, done: true } } })
    return NextResponse.json({ ok: true, next })
  }
  // ── Slutt Hjem.no-inngangen ───────────────────────────────────────────────

  const invitedOrgId = user.user_metadata?.organization_id as string | undefined
  if (!invitedOrgId) {
    return NextResponse.json({ error: 'Denne kontoen har ingen ventende invitasjon.' }, { status: 400 })
  }

  const { data: existingProfile } = await client
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (existingProfile?.organization_id) {
    // Allerede provisjonert (eller etablert bruker) — bare send videre.
    return NextResponse.json({ ok: true, next: '/dashboard' })
  }

  // Kjede-invitasjoner (opprett kontor) sender role='admin' → kontorsjef.
  // Team-/org-invitasjoner sender role='agent' → vanlig megler.
  const invitedAsAdmin = user.user_metadata?.role === 'admin'

  const { error: profileError } = await client
    .from('profiles')
    .upsert(
      {
        id:              user.id,
        organization_id: invitedOrgId,
        full_name:       user.user_metadata?.full_name ?? '',
        role:            invitedAsAdmin ? 'admin' : 'agent',
        account_type:    invitedAsAdmin ? 'team_admin' : 'team_member',
      },
      { onConflict: 'id' }
    )

  if (profileError) {
    console.error('[accept-invite] profile upsert error', profileError)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // organization_members er kilden til sannhet for rolle/nav
  const { data: existingMembership } = await client
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', invitedOrgId)
    .maybeSingle()

  if (!existingMembership) {
    const { error: memberError } = await client
      .from('organization_members')
      .insert({ organization_id: invitedOrgId, user_id: user.id, role: invitedAsAdmin ? 'admin' : 'member' })
    if (memberError) {
      console.error('[accept-invite] organization_members insert error', memberError)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }
  }

  // Ingen kvote å arve (16/10): kontorets «Lag selv»-saldo deles automatisk av
  // alle medlemmer via bolig_entitlements med user_id null (lib/boliger.ts).

  console.log(`[accept-invite] user ${user.id} linked to org ${invitedOrgId} (admin=${invitedAsAdmin})`)
  return NextResponse.json({ ok: true, next: '/onboarding/avatar' })
}
