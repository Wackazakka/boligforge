import { NextResponse } from 'next/server'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'

function getR2() {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

export async function DELETE(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, imageUrl } = await request.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase
      .from('agent_settings_images')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Delete from R2 (best-effort)
    if (imageUrl) {
      try {
        const r2PublicUrl = process.env.R2_PUBLIC_URL || ''
        const key = imageUrl.replace(r2PublicUrl + '/', '')
        await getR2().send(
          new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME || 'contentforge-assets', Key: key })
        )
      } catch { /* ikke kritisk */ }
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
