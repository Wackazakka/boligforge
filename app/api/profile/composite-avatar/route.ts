import sharp from 'sharp'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const SCRAPER_URL = 'http://139.59.212.218:3003'

// Fetch property image — if it's a Finn.no URL, proxy through scraper VPS
async function fetchPropertyImage(url: string): Promise<Buffer> {
  // Try direct fetch first (works for R2 URLs)
  const isFinnCdn = url.includes('finn') || url.includes('schibsted') || url.includes('finncdn')
  if (!isFinnCdn) {
    const res = await fetch(url)
    if (res.ok) return Buffer.from(await res.arrayBuffer())
  }
  // Proxy through scraper VPS (has Finn.no CDN access)
  const res = await fetch(`${SCRAPER_URL}/image?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(15000),
  })
  if (res.ok) return Buffer.from(await res.arrayBuffer())
  // Last resort: direct with browser headers
  const fallback = await fetch(url, {
    headers: {
      'Referer': 'https://www.finn.no',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  })
  if (!fallback.ok) throw new Error(`Could not fetch property image (${fallback.status})`)
  return Buffer.from(await fallback.arrayBuffer())
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
    const { portraitUrl, propertyImageUrl, cutoutUrl: existingCutoutUrl } = await request.json()
    if (!portraitUrl || !propertyImageUrl) {
      return Response.json({ error: 'Missing portraitUrl or propertyImageUrl' }, { status: 400 })
    }

    // Step 1: Get portrait cutout — reuse cached cutout if provided, else run Bria
    let cutoutUrl = existingCutoutUrl
    if (!cutoutUrl) {
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
      cutoutUrl = briaData?.image?.url
      if (!cutoutUrl) {
        return Response.json({ error: 'No cutout returned from Bria' }, { status: 500 })
      }

      // Re-host cutout to R2 so it can be reused across composites
      const tmpRes = await fetch(cutoutUrl)
      if (tmpRes.ok) {
        const tmpBuf = Buffer.from(await tmpRes.arrayBuffer())
        const cutoutKey = `boligforge/agent/cutout/${Date.now()}.png`
        await getR2().send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME || 'contentforge-assets',
          Key: cutoutKey,
          Body: tmpBuf,
          ContentType: 'image/png',
        }))
        cutoutUrl = `${process.env.R2_PUBLIC_URL}/${cutoutKey}`
      }
    }

    // Step 2: Download both images in parallel
    const cutoutRes = await fetch(cutoutUrl)
    if (!cutoutRes.ok) return Response.json({ error: 'Failed to download cutout' }, { status: 500 })
    const cutoutBuffer = Buffer.from(await cutoutRes.arrayBuffer())

    // Property image: route through scraper VPS if Finn.no URL
    const propertyBuffer = await fetchPropertyImage(propertyImageUrl).catch(err =>
      Promise.reject(new Error(`Property image: ${err.message}`))
    )

    // Step 3: Composite with Sharp
    // Property image is background; agent cutout placed at lower-center
    const bgMeta = await sharp(propertyBuffer).metadata()
    const bgWidth = bgMeta.width ?? 1200
    const bgHeight = bgMeta.height ?? 800

    // Resize agent: max 60% width, 60% height — fit:inside preserves aspect ratio
    const maxAgentHeight = Math.round(bgHeight * 0.60)
    const maxAgentWidth = Math.round(bgWidth * 0.60)
    const agentPng = await sharp(cutoutBuffer)
      .resize({ height: maxAgentHeight, width: maxAgentWidth, fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer()

    const agentMeta = await sharp(agentPng).metadata()
    const agentWidth = agentMeta.width ?? 400
    const agentHeight = agentMeta.height ?? 400

    // Position: centered horizontally, feet at bottom (2% margin)
    const left = Math.max(0, Math.round((bgWidth - agentWidth) / 2))
    const top = Math.max(0, bgHeight - agentHeight - Math.round(bgHeight * 0.02))

    const blurredBg = await sharp(propertyBuffer).blur(4).toBuffer()

    const composited = await sharp(blurredBg)
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

    return Response.json({ url, id: row?.id, cutoutUrl })
  } catch (err: unknown) {
    console.error('[composite-avatar]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
