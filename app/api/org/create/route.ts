import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Navn mangler' }, { status: 400 })

    const supabase = await createSupabaseServerClient()

    // Check if user already belongs to an org
    const { data: existing } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Du er allerede medlem av et firma' }, { status: 400 })
    }

    // Create org
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: name.trim(), slug, owner_id: user.id })
      .select('id, name, slug')
      .single()

    if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 })

    // Add creator as admin member
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({ organization_id: org.id, user_id: user.id, role: 'admin' })

    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

    return NextResponse.json({ org })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
