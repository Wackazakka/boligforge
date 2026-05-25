import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../lib/supabase/server'

const SUPERADMIN_EMAIL = process.env.LARS_EMAIL ?? ''

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET — return all collections visible to the user:
//   • Own personal folders (user_id = me)
//   • Org-level folders (org_id = my org)
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getServiceClient()
  const isSuperadmin = user.email === SUPERADMIN_EMAIL

  // Get user's org
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  const orgId = profile?.organization_id ?? null

  let query = supabase
    .from('video_collections')
    .select('id, name, created_at, user_id, org_id, collection_videos(count)')
    .order('created_at', { ascending: false })

  if (isSuperadmin) {
    // superadmin sees everything
  } else if (orgId) {
    // see own + org-level folders
    query = query.or(`user_id.eq.${user.id},org_id.eq.${orgId}`)
  } else {
    // no org — only personal
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const collections = (data ?? []).map(c => ({
    id:          c.id,
    name:        c.name,
    created_at:  c.created_at,
    is_org:      !!c.org_id,
    video_count: (c.collection_videos as unknown as { count: number }[])?.[0]?.count ?? 0,
  }))

  return NextResponse.json(collections)
}

// POST — create a collection
// body: { name, org_level?: boolean }
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, org_level } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Navn er påkrevd' }, { status: 400 })

  const supabase = getServiceClient()

  let orgId: string | null = null
  if (org_level) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .maybeSingle()

    const isSuperadmin = user.email === SUPERADMIN_EMAIL
    const isAdmin = profile?.role === 'admin' || isSuperadmin

    if (!isAdmin) return NextResponse.json({ error: 'Kun admins kan opprette byråmapper' }, { status: 403 })
    orgId = profile?.organization_id ?? null
  }

  const insert: Record<string, string | null> = { name: name.trim() }
  if (orgId) {
    insert.org_id = orgId
  } else {
    insert.user_id = user.id
  }

  const { data, error } = await supabase
    .from('video_collections')
    .insert(insert)
    .select('id, name, created_at, org_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, is_org: !!data.org_id, video_count: 0 })
}

// DELETE — remove a collection
export async function DELETE(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { collectionId } = await request.json()
  const supabase = getServiceClient()

  const isSuperadmin = user.email === SUPERADMIN_EMAIL
  let query = supabase.from('video_collections').delete().eq('id', collectionId)
  if (!isSuperadmin) query = query.eq('user_id', user.id) // only own folders

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
