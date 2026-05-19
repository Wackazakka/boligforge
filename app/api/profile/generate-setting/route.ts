import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const SETTING_PROMPTS: Record<string, string> = {
  modern_home: 'A professional real estate agent standing in front of a beautiful modern Norwegian residential home with clean architecture, natural light, professional photo',
  office: 'A professional real estate agent in a bright, modern Scandinavian office environment with clean lines and minimalist decor, professional headshot',
  studio: 'A professional real estate agent against a clean, neutral studio backdrop with soft professional lighting, business portrait',
  neighborhood: 'A professional real estate agent standing outdoors in a pleasant Norwegian residential neighborhood with houses visible in the background, natural daylight',
}

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

export async function POST(request: Request) {
  try {
    const { setting, portraitUrl } = await request.json()

    if (!setting || !portraitUrl) {
      return NextResponse.json({ error: 'Missing setting or portraitUrl' }, { status: 400 })
    }

    const prompt = SETTING_PROMPTS[setting]
    if (!prompt) {
      return NextResponse.json({ error: 'Unknown setting type' }, { status: 400 })
    }

    const portraitRes = await fetch(portraitUrl)
    if (!portraitRes.ok) throw new Error('Failed to fetch portrait image')
    const portraitBuffer = Buffer.from(await portraitRes.arrayBuffer())

    const formData = new FormData()
    const imageBlob = new Blob([portraitBuffer], { type: 'image/png' })
    formData.append('image[]', imageBlob, 'portrait.png')
    formData.append('prompt', prompt)
    formData.append('model', 'gpt-image-1')
    formData.append('n', '1')
    formData.append('size', '1024x1024')
    formData.append('quality', 'medium')

    const openaiRes = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: formData,
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      console.error('[generate-setting] OpenAI error:', err)
      return NextResponse.json({ error: 'OpenAI feilet: ' + err }, { status: 502 })
    }

    const openaiData = await openaiRes.json()
    const b64 = openaiData.data?.[0]?.b64_json
    if (!b64) throw new Error('No image in OpenAI response')

    const imgBuffer = Buffer.from(b64, 'base64')
    const bucket = process.env.R2_BUCKET_NAME || 'contentforge-assets'
    const key = `boligforge/agent/settings/${setting}_${Date.now()}.png`

    await getR2().send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: imgBuffer, ContentType: 'image/png' })
    )

    const url = `${process.env.R2_PUBLIC_URL}/${key}`

    await getSupabase().from('agent_settings_images').insert({
      user_id: 'default',
      setting_type: setting,
      image_url: url,
    })

    return NextResponse.json({ url, setting })
  } catch (err: unknown) {
    console.error('[generate-setting]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
