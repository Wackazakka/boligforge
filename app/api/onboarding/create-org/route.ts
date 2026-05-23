import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

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

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: 'Navn er påkrevd' }, { status: 400 })

  // Generer unik slug
  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`

  // Opprett org
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name, slug, plan: 'free' })
    .select('id')
    .single()

  if (orgError) {
    console.error('create-org error:', orgError)
    return NextResponse.json({ error: orgError.message }, { status: 500 })
  }

  // Upsert profil med org og admin-rolle
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id:              user.id,
      organization_id: org.id,
      full_name:       user.user_metadata?.full_name ?? '',
      role:            'admin',
    }, { onConflict: 'id' })

  if (profileError) {
    console.error('upsert profile error:', profileError)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ org_id: org.id })
}
