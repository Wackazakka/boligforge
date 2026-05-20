import sharp from 'sharp'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

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
    const { portraitUrl, propertyImageUrl } = await request.json()
    if (!portraitUrl || !propertyImageUrl) {
      return Response.json({ error: 'Missing portraitUrl or propertyImageUrl' }, { status: 400 })
    }

    // Step 1: Remove background from portrait using Bria
    const briaRes = await fetch('https://fal.run/fal-ai/bria/background/remove', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image_url: portraitUrl }),
    })

    if (!briaRes.ok) {
      const errText = await briaRes.text()
      return Response.json({ error: `Background removal failed: ${errText.slice(0, 200)}` }, { status: 500 })
    }

    const briaData = await briaRes.json()
    const cutoutUrl = briaData?.image?.url
    if (!cutoutUrl) {
      return Response.json({ error: 'No cutout returned from Bria' }, { status: 500 })
    }

    // Step 2: Download both images in parallel
    // Finn.no CDN requires Referer header for server-side fetches
    const [cutoutRes, propertyRes] = await Promise.all([
      fetch(cutoutUrl),
      fetch(propertyImageUrl, {
        headers: {
          'Referer': 'https://www.finn.no',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      }),
    ])

    if (!cutoutRes.ok || !propertyRes.ok) {
      return Response.json({ error: 'Failed to download images' }, { status: 500 })
    }

    const [cutoutBuffer, propertyBuffer] = await Promise.all([
      cutoutRes.arrayBuffer().then(Buffer.from),
      propertyRes.arrayBuffer().then(Buffer.from),
    ])

    // Step 3: Composite with Sharp
    // Property image is background; agent cutout placed at lower-center
    const bgMeta = await sharp(propertyBuffer).metadata()
    const bgWidth = bgMeta.width ?? 1200
    const bgHeight = bgMeta.height ?? 800

    // Agent height: 70% of bg height (prominent but not overwhelming)
    const agentHeight = Math.round(bgHeight * 0.70)
    const agentPng = await sharp(cutoutBuffer)
      .resize({ height: agentHeight, withoutEnlargement: false })
      .png()
      .toBuffer()

    const agentMeta = await sharp(agentPng).metadata()
    const agentWidth = agentMeta.width ?? 400

    // Position: centered horizontally, feet at bottom (2% margin)
    const left = Math.max(0, Math.round((bgWidth - agentWidth) / 2))
    const top = Math.max(0, bgHeight - agentHeight - Math.round(bgHeight * 0.02))

    const composited = await sharp(propertyBuffer)
      .composite([{ input: agentPng, left, top, blend: 'over' }])
      .jpeg({ quality: 92 })
      .toBuffer()

    // Step 4: Upload to R2
    const bucket = process.env.R2_BUCKET_NAME || 'contentforge-assets'
    const key = `boligforge/agent/composite/${Date.now()}.jpg`

    await getR2().send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: composited, ContentType: 'image/jpeg' })
    )
    const url = `${process.env.R2_PUBLIC_URL}/${key}`

    // Step 5: Save to Supabase
    const { data: row } = await getSupabase()
      .from('agent_settings_images')
      .insert({ setting_type: 'property_front', image_url: url })
      .select('id')
      .single()

    return Response.json({ url, id: row?.id })
  } catch (err: unknown) {
    console.error('[composite-avatar]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
