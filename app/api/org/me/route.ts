import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createSupabaseServerClient()

    // Profil hentes med service role (RLS-nøkkelformat-fella) — brukes både til
    // å velge riktig medlemskap og til kjedeadmin-avgjørelsen.
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: prof } = await serviceClient
      .from('profiles')
      .select('organization_id, account_type')
      .eq('id', user.id)
      .maybeSingle()

    // HENT LISTE, ikke .maybeSingle(): en bruker med to medlemskap (skjedde
    // 2026-08-06 da onboarding kunne kjøres to ganger) fikk stille feil her —
    // rolle ble null og alle admin-menyer forsvant. Ved flere: bruk medlemskapet
    // som matcher profilens aktive organisasjon, ellers det nyeste.
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('organization_id, role, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const membership =
      (memberships ?? []).find(m => m.organization_id === prof?.organization_id) ??
      (memberships ?? [])[0] ?? null

    // Superadmin bypass
    const superadminEmail = process.env.LARS_EMAIL ?? ''
    if (!membership) {
      if (superadminEmail && user.email === superadminEmail) {
        return NextResponse.json({ org: null, role: 'superadmin' })
      }
      return NextResponse.json({ org: null, role: null })
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, slug, plan, trial_ends_at')
      .eq('id', membership.organization_id)
      .maybeSingle()

    // Kjede-admin: org-admin med meglerhus-konto (team_admin) kan opprette og
    // se kontorer under sin org (Kjede-siden). Solo-brukere slipper støyen.
    const isAdmin = membership.role === 'admin' ||
      (!!superadminEmail && user.email === superadminEmail)
    const isChainAdmin = isAdmin && prof?.account_type === 'team_admin'

    return NextResponse.json({ org, role: membership.role, isChainAdmin })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
