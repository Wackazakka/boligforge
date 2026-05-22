import { NextResponse } from 'next/server'
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

    if (!membership) return NextResponse.json({ org: null, role: null })

    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, slug, plan, trial_ends_at')
      .eq('id', membership.organization_id)
      .maybeSingle()

    return NextResponse.json({ org, role: membership.role })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
