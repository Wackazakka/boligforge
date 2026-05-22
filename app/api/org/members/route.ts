import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createSupabaseServerClient()

    // Get user's org + role
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) return NextResponse.json({ error: 'Ikke medlem av noe firma' }, { status: 404 })
    if (membership.role !== 'admin') return NextResponse.json({ error: 'Kun admin kan se dette' }, { status: 403 })

    // Get all members in the org
    const { data: members, error } = await supabase
      .from('organization_members')
      .select('id, user_id, role, created_at')
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Get profiles for all members
    const userIds = members.map(m => m.user_id)
    const { data: profiles } = await supabase
      .from('agent_profiles')
      .select('user_id, name, email, portrait_url')
      .in('user_id', userIds)

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]))

    const result = members.map(m => ({
      ...m,
      profile: profileMap[m.user_id] ?? null,
    }))

    return NextResponse.json({ members: result, org_id: membership.organization_id })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { member_id } = await request.json()
    if (!member_id) return NextResponse.json({ error: 'Mangler member_id' }, { status: 400 })

    const supabase = await createSupabaseServerClient()

    // Verify caller is admin
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Kun admin kan fjerne meglere' }, { status: 403 })
    }

    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', member_id)
      .eq('organization_id', membership.organization_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
