import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createSupabaseServerClient()

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

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
    // profiles leses med service role (samme RLS-verktøy som dashboardet).
    let isChainAdmin = false
    const isAdmin = membership.role === 'admin' ||
      (!!superadminEmail && user.email === superadminEmail)
    if (isAdmin) {
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: prof } = await serviceClient
        .from('profiles')
        .select('account_type')
        .eq('id', user.id)
        .maybeSingle()
      isChainAdmin = prof?.account_type === 'team_admin'
    }

    return NextResponse.json({ org, role: membership.role, isChainAdmin })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
