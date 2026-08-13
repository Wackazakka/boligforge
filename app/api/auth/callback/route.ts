import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '../../../../lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { siteOrigin } from '../../../../lib/site-origin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = siteOrigin(request)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard/profile'

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
  }

  const supabase = await createSupabaseServerClient()
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !sessionData.user) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
  }

  const user = sessionData.user

  // Check if this is an invited team member — the invite redirectTo contains ?org=<id>
  // Extract org from `next` param (e.g. next=/onboarding?org=<uuid>)
  const nextUrl       = new URL(`${origin}${next}`)
  const invitedOrgId  = nextUrl.searchParams.get('org') ??
                        searchParams.get('org') ??
                        (user.user_metadata?.organization_id as string | undefined) ?? null

  if (invitedOrgId) {
    // Provision profile as team_member without creating a new org
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Kjede-invitasjoner (opprett kontor) sender role='admin' i metadata — da skal
    // den inviterte bli kontorsjef (admin) i barne-orgen. Alle andre invitasjoner
    // (Team-siden sender role='agent') beholder dagens defaults uendret.
    const invitedAsAdmin = user.user_metadata?.role === 'admin'

    const { error: profileError } = await serviceClient
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
      console.error('[auth/callback] invited profile upsert error', profileError)
      // Non-fatal — continue to avatar onboarding so user can at least set up profile
    } else {
      console.log(`[auth/callback] invited user ${user.id} linked to org ${invitedOrgId}`)
    }

    // organization_members er kilden til sannhet for medlemskap (org-/team-sidene
    // leser herfra) — uten denne raden er den inviterte usynlig i Admin/Team.
    const { data: existingMembership } = await serviceClient
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', invitedOrgId)
      .maybeSingle()
    if (!existingMembership) {
      const { error: memberError } = await serviceClient
        .from('organization_members')
        .insert({ organization_id: invitedOrgId, user_id: user.id, role: invitedAsAdmin ? 'admin' : 'member' })
      if (memberError) console.error('[auth/callback] organization_members insert error', memberError)
    }

    // Invited users skip the org-creation onboarding step and go straight to avatar
    return NextResponse.redirect(`${origin}/onboarding/avatar`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
