import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email } = await request.json()
    if (!email?.trim()) return NextResponse.json({ error: 'E-post mangler' }, { status: 400 })

    const supabase = await createSupabaseServerClient()

    // Verify caller is admin
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Kun admin kan invitere meglere' }, { status: 403 })
    }

    // Use service role to invite user via Supabase Auth
    const serviceClient = getServiceClient()
    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
        data: { organization_id: membership.organization_id, role: 'agent' },
      }
    )

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }

    // If user already exists, add them directly
    const invitedUserId = inviteData?.user?.id
    if (invitedUserId) {
      const { error: memberError } = await supabase
        .from('organization_members')
        .upsert(
          { organization_id: membership.organization_id, user_id: invitedUserId, role: 'agent' },
          { onConflict: 'organization_id,user_id' }
        )
      if (memberError) console.error('[invite] member upsert error:', memberError)
    }

    return NextResponse.json({ success: true, email: email.trim() })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
