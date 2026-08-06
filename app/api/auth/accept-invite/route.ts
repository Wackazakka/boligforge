import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'
import { VIDEOS_BY_PLAN, setPlanForUsers } from '../../../../lib/video-credits'

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

  const invitedOrgId = user.user_metadata?.organization_id as string | undefined
  if (!invitedOrgId) {
    return NextResponse.json({ error: 'Denne kontoen har ingen ventende invitasjon.' }, { status: 400 })
  }

  const client = sb()

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

  // Kontor-planen er per sete: nye medlemmer i en betalende office-org arver
  // månedskvoten (7/mnd). Starter/Pro er personlige — der beholder inviterte
  // medlemmer default-kvoten.
  const { data: invitedOrg } = await client
    .from('organizations')
    .select('plan, stripe_subscription_id')
    .eq('id', invitedOrgId)
    .maybeSingle()

  const orgPlan = invitedOrg?.plan ?? ''
  if ((orgPlan === 'office' || orgPlan === 'kontor') && invitedOrg?.stripe_subscription_id) {
    const vcError = await setPlanForUsers(client, [user.id], orgPlan, VIDEOS_BY_PLAN[orgPlan])
    if (vcError) console.error('[accept-invite] video_credits seed error', vcError)
  }

  console.log(`[accept-invite] user ${user.id} linked to org ${invitedOrgId} (admin=${invitedAsAdmin})`)
  return NextResponse.json({ ok: true, next: '/onboarding/avatar' })
}
