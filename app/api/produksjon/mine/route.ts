import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Meglerens egne produksjonsbestillinger, valgfritt filtrert på bolig.
export async function GET(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const propertyId = new URL(request.url).searchParams.get('propertyId')
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  let q = client.from('produksjonsordrer').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  if (propertyId) q = q.eq('property_id', propertyId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ordrer: data ?? [] })
}
