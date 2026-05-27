'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../lib/supabase/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function provisionOrg(
  userId: string,
  orgName: string,
  accountType: 'solo' | 'team_admin'
): Promise<string | null> {
  const slug        = `${slugify(orgName)}-${Math.random().toString(36).slice(2, 7)}`
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Opprett org
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: orgName, slug, plan: 'pro', owner_id: userId, trial_ends_at: trialEndsAt })
    .select('id')
    .single()

  if (orgError || !org) {
    console.error('provisionOrg: org insert error', orgError)
    return orgError?.message ?? 'Kunne ikke opprette organisasjon'
  }

  // 2. Sett organization_id og account_type på profil
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id:              userId,
        organization_id: org.id,
        full_name:       '',
        role:            'admin',
        account_type:    accountType,
      },
      { onConflict: 'id' }
    )

  if (profileError) {
    console.error('provisionOrg: profile upsert error', profileError)
    return profileError.message
  }

  // 2b. Verifiser at organization_id faktisk ble skrevet
  const { data: check } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle()

  console.log(`provisionOrg: profile etter upsert → organization_id=${check?.organization_id}, forventet=${org.id}`)

  if (check?.organization_id !== org.id) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ organization_id: org.id, account_type: accountType })
      .eq('id', userId)

    if (updateError) {
      console.error('provisionOrg: fallback update error', updateError)
      return updateError.message
    }
    console.log('provisionOrg: brukte fallback UPDATE for organization_id')
  }

  // 3. Opprett credits (10 videoer for Pro)
  const { error: creditsError } = await supabase
    .from('credits')
    .upsert(
      { organization_id: org.id, total: 10, used: 0, reset_at: trialEndsAt, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id' }
    )

  if (creditsError) {
    console.error('provisionOrg: credits upsert error', creditsError)
    return creditsError.message
  }

  console.log(`provisionOrg: ferdig — org ${org.id}, bruker ${userId}`)
  return null
}

// -----------------------------------------------------------------------
// createOrgAction — brukes av team_admin som skriver inn firmanavn
// -----------------------------------------------------------------------
export async function createOrgAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const user = await getUser()
  if (!user) return 'Ikke innlogget – logg inn og prøv igjen'

  const name = formData.get('orgName')?.toString().trim()
  if (!name) return 'Firmanavn er påkrevd'

  const err = await provisionOrg(user.id, name, 'team_admin')
  if (err) return err

  redirect('/onboarding/avatar')
}

// -----------------------------------------------------------------------
// createSoloOrgAction — brukes av solo-megler (ingen org-navn-steg)
// Genererer org-navn fra brukerens fulle navn eller e-post.
// -----------------------------------------------------------------------
export async function createSoloOrgAction(
  _prevState: string | null,
  _formData: FormData
): Promise<string | null> {
  const user = await getUser()
  if (!user) return 'Ikke innlogget – logg inn og prøv igjen'

  // Bruk fullt navn fra metadata, fallback til e-post-prefix
  const displayName =
    user.user_metadata?.full_name?.toString().trim() ||
    user.email?.split('@')[0] ||
    'min konto'

  const orgName = displayName

  const err = await provisionOrg(user.id, orgName, 'solo')
  if (err) return err

  redirect('/onboarding/avatar')
}
