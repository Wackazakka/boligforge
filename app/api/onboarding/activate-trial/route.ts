import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const videosByPlan: Record<string, number> = { starter: 3, pro: 10, office: 7 }

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const plan: string     = body.plan
  const quantity: number = parseInt(body.quantity ?? '1', 10)

  if (!plan || !videosByPlan[plan]) {
    return NextResponse.json({ error: 'Ugyldig plan' }, { status: 400 })
  }

  // Hent org for brukeren
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'Ingen organisasjon funnet' }, { status: 400 })
  }

  const organizationId = profile.organization_id
  const trialEndsAt    = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  // Sett plan og prøveperiode på org
  const { error: orgError } = await supabase
    .from('organizations')
    .update({ plan, trial_ends_at: trialEndsAt })
    .eq('id', organizationId)

  if (orgError) {
    console.error('activate-trial org update error:', orgError)
    return NextResponse.json({ error: orgError.message }, { status: 500 })
  }

  // Opprett / oppdater credits
  const baseVideos = videosByPlan[plan]
  const total      = plan === 'office' ? baseVideos * quantity : baseVideos

  const { error: creditsError } = await supabase
    .from('credits')
    .upsert(
      {
        organization_id: organizationId,
        total,
        used:       0,
        reset_at:   trialEndsAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' }
    )

  if (creditsError) {
    console.error('activate-trial credits error:', creditsError)
    return NextResponse.json({ error: creditsError.message }, { status: 500 })
  }

  console.log(`Org ${organizationId} aktivert på "${plan}", ${total} kreditter, trial t.o.m. ${trialEndsAt}`)
  return NextResponse.json({ ok: true })
}
