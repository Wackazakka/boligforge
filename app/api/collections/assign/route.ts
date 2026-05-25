import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST — toggle a video in/out of a collection
// body: { videoId, collectionId, add: boolean }
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { videoId, collectionId, add } = await request.json()
  if (!videoId || !collectionId) {
    return NextResponse.json({ error: 'Mangler videoId eller collectionId' }, { status: 400 })
  }

  const supabase = getServiceClient()

  if (add) {
    const { error } = await supabase
      .from('collection_videos')
      .upsert({ collection_id: collectionId, video_id: videoId }, { onConflict: 'collection_id,video_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('collection_videos')
      .delete()
      .eq('collection_id', collectionId)
      .eq('video_id', videoId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
