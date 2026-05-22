import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'

export const maxDuration = 30

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

    const form = await request.formData()
    const file = form.get('file')
    if (!file || !(file instanceof File)) {
      return Response.json({ error: 'Ingen fil' }, { status: 400 })
    }
    if (!file.type.startsWith('audio/')) {
      return Response.json({ error: 'Kun lydfiler støttes' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const key = `boligforge/music/${Date.now()}_${file.name.replace(/[^a-z0-9._-]/gi, '_')}`

    await getR2().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'contentforge-assets',
      Key: key,
      Body: buf,
      ContentType: file.type || 'audio/mpeg',
    }))

    const url = `${process.env.R2_PUBLIC_URL}/${key}`

    const supabase = await createSupabaseServerClient()
    const { data: row } = await supabase
      .from('music_files')
      .insert({ name: file.name, url })
      .select('id')
      .single()

    return Response.json({ url, id: row?.id, name: file.name })
  } catch (err) {
    console.error('[music/upload]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
