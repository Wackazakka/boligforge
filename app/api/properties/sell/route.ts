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

// POST { propertyId } — mark a property as sold, move its videos to "Solgte [år]"
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { propertyId } = await request.json()
  if (!propertyId) return NextResponse.json({ error: 'Mangler propertyId' }, { status: 400 })

  const supabase = getServiceClient()
  const year = new Date().getFullYear()
  const folderName = `Solgte ${year}`

  // 1. Mark property as sold
  const { error: propError } = await supabase
    .from('properties')
    .update({ status: 'sold', sold_at: new Date().toISOString() })
    .eq('id', propertyId)
    .eq('user_id', user.id)  // safety: can only sell own properties

  if (propError) return NextResponse.json({ error: propError.message }, { status: 500 })

  // 2. Find or create "Solgte [år]" collection for this user
  let { data: folder } = await supabase
    .from('video_collections')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', folderName)
    .maybeSingle()

  if (!folder) {
    const { data: newFolder, error: folderError } = await supabase
      .from('video_collections')
      .insert({ user_id: user.id, name: folderName })
      .select('id')
      .single()

    if (folderError) return NextResponse.json({ error: folderError.message }, { status: 500 })
    folder = newFolder
  }

  // 3. Get all videos for this property
  const { data: videos } = await supabase
    .from('property_videos')
    .select('id')
    .eq('property_id', propertyId)
    .eq('user_id', user.id)

  // 4. Add each video to the "Solgte [år]" collection (idempotent upsert)
  if (videos && videos.length > 0) {
    const rows = videos.map(v => ({ collection_id: folder!.id, video_id: v.id }))
    await supabase
      .from('collection_videos')
      .upsert(rows, { onConflict: 'collection_id,video_id' })
  }

  return NextResponse.json({ ok: true, folderId: folder!.id, folderName, videosMoved: videos?.length ?? 0 })
}
