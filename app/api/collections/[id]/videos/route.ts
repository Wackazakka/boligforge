import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../../lib/supabase/server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: collectionId } = await params

  const { data, error } = await getServiceClient()
    .from('collection_videos')
    .select('video_id, added_at, property_videos(id, video_url, created_at, property_id)')
    .eq('collection_id', collectionId)
    .order('added_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const videos = (data ?? []).map(row => {
    const v = row.property_videos as unknown as { id: string; video_url: string; created_at: string; property_id: string } | null
    return v ? { ...v, added_at: row.added_at } : null
  }).filter(Boolean)

  return NextResponse.json(videos)
}
