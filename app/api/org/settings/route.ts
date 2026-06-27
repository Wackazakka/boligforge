// Byrå-funksjonsflagg. GET: rolle + om Live-Avatar/PVC er tillatt. PATCH (kun
// byråsjef = role 'admin'): skru flaggene av/på for hele byrået.
// Defaulter til «tillatt» hvis kolonnene ikke finnes ennå (før migrering).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

export const runtime = 'nodejs'

function svc() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function context(userId: string, email: string | undefined) {
  const supabase = svc()
  const { data: membership } = await supabase
    .from('organization_members').select('organization_id, role').eq('user_id', userId).maybeSingle()
  const isSuper = !!process.env.LARS_EMAIL && email === process.env.LARS_EMAIL
  return { supabase, membership, isSuper }
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase, membership, isSuper } = await context(user.id, user.email)

  // Solo/uten byrå → behandle som egen sjef, alt tillatt
  if (!membership) {
    return NextResponse.json({ role: isSuper ? 'superadmin' : null, isAdmin: true, allow_did: true, allow_liveavatar: true, allow_pvc: true })
  }

  const isAdmin = membership.role === 'admin' || isSuper
  let allow_did = true, allow_liveavatar = true, allow_pvc = true
  try {
    const { data: org } = await supabase
      .from('organizations').select('allow_did, allow_liveavatar, allow_pvc').eq('id', membership.organization_id).maybeSingle()
    if (org) { allow_did = org.allow_did ?? true; allow_liveavatar = org.allow_liveavatar ?? true; allow_pvc = org.allow_pvc ?? true }
  } catch { /* kolonner finnes ikke ennå → behold default true */ }

  return NextResponse.json({ role: membership.role, isAdmin, allow_did, allow_liveavatar, allow_pvc })
}

export async function PATCH(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase, membership, isSuper } = await context(user.id, user.email)

  if (!membership || (membership.role !== 'admin' && !isSuper)) {
    return NextResponse.json({ error: 'Bare byråsjef kan endre dette' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const update: Record<string, boolean> = {}
  if (typeof body.allow_did === 'boolean') update.allow_did = body.allow_did
  if (typeof body.allow_liveavatar === 'boolean') update.allow_liveavatar = body.allow_liveavatar
  if (typeof body.allow_pvc === 'boolean') update.allow_pvc = body.allow_pvc
  if (!Object.keys(update).length) return NextResponse.json({ error: 'Ingen endring' }, { status: 400 })

  const { error } = await supabase.from('organizations').update(update).eq('id', membership.organization_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, ...update })
}
