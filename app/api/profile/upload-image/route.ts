import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
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

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file || !type) {
      return NextResponse.json({ error: 'Missing file or type' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || 'jpg'
    const key = `boligforge/agent/${user.id}/${type}.${ext}`
    const bucket = process.env.R2_BUCKET_NAME || 'contentforge-assets'

    await getR2().send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: file.type })
    )

    const url = `${process.env.R2_PUBLIC_URL}/${key}`
    const updateField = type === 'logo' ? { logo_url: url } : { portrait_url: url }

    const supabase = await createSupabaseServerClient()
    await supabase.from('agent_profiles').upsert(
      { user_id: user.id, ...updateField },
      { onConflict: 'user_id' }
    )

    return NextResponse.json({ url })
  } catch (err: unknown) {
    console.error('[upload-image]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
