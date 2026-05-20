import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

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

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function DELETE(request: Request) {
  try {
    const { id, imageUrl } = await request.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Delete from Supabase
    const { error } = await getSupabase()
      .from('agent_settings_images')
      .delete()
      .eq('id', id)

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
