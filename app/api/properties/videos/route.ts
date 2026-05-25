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
    .from('property_videos')
    .select('id, video_url, created_at, collection_videos(collection_id)')
    .eq('property_id', propertyId)
    .not('video_url', 'is', null)
    .neq('video_url', '')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten collection_ids for each video
  const videos = (data ?? []).map(v => ({
    id:             v.id,
    video_url:      v.video_url,
    created_at:     v.created_at,
    collection_ids: (v.collection_videos as unknown as { collection_id: string }[])?.map(c => c.collection_id) ?? [],
  }))

  return NextResponse.json(videos)
}

export async function DELETE(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { videoId } = await request.json()
  if (!videoId) return NextResponse.json({ error: 'Mangler videoId' }, { status: 400 })

  const { error } = await getServiceClient()
    .from('property_videos')
    .delete()
    .eq('id', videoId)
    .eq('user_id', user.id)   // can only delete own videos

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
