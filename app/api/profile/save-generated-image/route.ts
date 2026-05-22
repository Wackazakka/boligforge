import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'

// Lightweight route: receives fal.ai image URL, re-hosts on R2, saves to Supabase
// Called by client after fal.subscribe() completes — well under 10s

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
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { falImageUrl, setting } = await request.json()
    if (!falImageUrl || !setting) {
      return Response.json({ error: 'Missing falImageUrl or setting' }, { status: 400 })
    }

    const imgRes = await fetch(falImageUrl)
    if (!imgRes.ok) {
      return Response.json({ error: 'Failed to fetch image from fal.ai' }, { status: 500 })
    }
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : 'jpg'

    const bucket = process.env.R2_BUCKET_NAME || 'contentforge-assets'
    const key = `boligforge/agent/settings/${user.id}/${setting}_${Date.now()}.${ext}`

    await getR2().send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: imgBuffer, ContentType: contentType })
    )
    const url = `${process.env.R2_PUBLIC_URL}/${key}`

    const supabase = await createSupabaseServerClient()
    const { data: row } = await supabase
      .from('agent_settings_images')
      .insert({ setting_type: setting, image_url: url, user_id: user.id })
      .select('id')
      .single()

    return Response.json({ url, setting, id: row?.id })
  } catch (err: unknown) {
    console.error('[save-generated-image]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
