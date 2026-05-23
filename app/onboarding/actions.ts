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

export async function createOrgAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const user = await getUser()
  if (!user) return 'Ikke innlogget – logg inn og prøv igjen'

  const name = formData.get('orgName')?.toString().trim()
  if (!name) return 'Firmanavn er påkrevd'

  const slug        = `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Opprett org
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name, slug, plan: 'pro', owner_id: user.id, trial_ends_at: trialEndsAt })
    .select('id')
    .single()

  if (orgError || !org) {
    console.error('createOrgAction: org insert error', orgError)
    return orgError?.message ?? 'Kunne ikke opprette organisasjon'
  }

  // 2. Sett organization_id på profil
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, organization_id: org.id, full_name: user.user_metadata?.full_name ?? '', role: 'admin' },
      { onConflict: 'id' }
    )

  if (profileError) {
    console.error('createOrgAction: profile upsert error', profileError)
    return profileError.message
  }

  // 2b. Verifiser at organization_id faktisk ble skrevet
  const { data: check } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  console.log(`createOrgAction: profile etter upsert → organization_id=${check?.organization_id}, forventet=${org.id}`)

  if (check?.organization_id !== org.id) {
    // Prøv eksplisitt UPDATE som fallback
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ organization_id: org.id })
      .eq('id', user.id)

    if (updateError) {
      console.error('createOrgAction: fallback update error', updateError)
      return updateError.message
    }
    console.log('createOrgAction: brukte fallback UPDATE for organization_id')
  }

  // 3. Opprett credits (10 videoer for Pro)
  const { error: creditsError } = await supabase
    .from('credits')
    .upsert(
      { organization_id: org.id, total: 10, used: 0, reset_at: trialEndsAt, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id' }
    )

  if (creditsError) {
    console.error('createOrgAction: credits upsert error', creditsError)
    return creditsError.message
  }

  console.log(`createOrgAction: ferdig — org ${org.id}, bruker ${user.id}`)

  // Server-side redirect — bypasser RSC-cache og cookie-problematikk
  redirect('/dashboard')
}
