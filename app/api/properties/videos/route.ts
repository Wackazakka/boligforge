import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jvnavubholyvihvytqkn.supabase.co'

function getServiceClient() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'Mangler propertyId' }, { status: 400 })

  const { data, error } = await getServiceClient()
    .from('production_jobs')
    .select('id, video_url, created_at, status')
    .eq('property_id', propertyId)
    .eq('status', 'done')
    .not('video_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
