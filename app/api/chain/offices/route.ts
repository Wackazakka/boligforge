import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

// Opprett et kontor under kjeden og inviter kontorsjefen.
// Invitasjonen sender role='admin' i metadata — auth-callbacken gjør da den
// inviterte til admin (kontorsjef) i barne-orgen i stedet for vanlig medlem.

export const runtime = 'nodejs'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reelhome.ai'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, adminEmail } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Kontornavn er påkrevd' }, { status: 400 })
  if (!adminEmail?.trim()) return NextResponse.json({ error: 'Kontorsjefens e-post er påkrevd' }, { status: 400 })

  const client = sb()

  const { data: membership } = await client
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  const isSuper = !!process.env.LARS_EMAIL && user.email === process.env.LARS_EMAIL
  if (!membership?.organization_id || (membership.role !== 'admin' && !isSuper)) {
    return NextResponse.json({ error: 'Kun kjedeadmin kan opprette kontorer' }, { status: 403 })
  }
  const chainId = membership.organization_id

  // 1. Opprett kontor-orgen under kjeden (speiler provisionOrg-feltene)
  const slug        = `${slugify(name.trim())}-${Math.random().toString(36).slice(2, 7)}`
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: office, error: orgError } = await client
    .from('organizations')
    .insert({
      name: name.trim(),
      slug,
      plan: 'pro',
      trial_ends_at: trialEndsAt,
      parent_organization_id: chainId,
      // owner_id er NOT NULL. Kjedeadmin står som eier til kontorsjefen har
      // akseptert invitasjonen (eierskifte er en senere støttehandling).
      owner_id: user.id,
    })
    .select('id, name')
    .single()

  if (orgError || !office) {
    console.error('[chain/offices] org insert error', orgError)
    return NextResponse.json({ error: orgError?.message ?? 'Kunne ikke opprette kontor' }, { status: 500 })
  }

  // 2. Inviter kontorsjefen (samme mekanikk som team/invite, men role='admin')
  const { error: inviteError } = await client.auth.admin.inviteUserByEmail(
    adminEmail.trim(),
    {
      redirectTo: `${BASE_URL}/onboarding?org=${office.id}`,
      data: {
        organization_id: office.id,
        invited_by:      user.id,
        role:            'admin',
      },
    }
  )

  if (inviteError) {
    if (inviteError.message.includes('already been registered') || inviteError.message.includes('already exists')) {
      // Flytting av eksisterende brukere er bevisst utenfor omfang — kontoret er
      // opprettet, men sjefen må inviteres med en e-post uten eksisterende konto.
      return NextResponse.json({
        error: `${adminEmail.trim()} har allerede en ReelHome-konto. Bruk en annen e-postadresse, eller kontakt support for å flytte en eksisterende bruker.`,
        officeId: office.id,
      }, { status: 409 })
    }
    console.error('[chain/offices] invite error', inviteError)
    return NextResponse.json({ error: inviteError.message, officeId: office.id }, { status: 500 })
  }

  return NextResponse.json({ success: true, officeId: office.id, officeName: office.name })
}
