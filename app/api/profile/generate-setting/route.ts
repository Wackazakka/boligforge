import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export const maxDuration = 120

// Ideogram Character prompts: full scene description — face is preserved via reference_image_urls
const SETTING_PROMPTS: Record<string, string> = {
  modern_home: 'A professional Norwegian real estate agent standing outdoors in front of a beautiful modern Norwegian home. White render walls, large black-frame windows, lush green garden, warm golden-hour sunlight. The agent looks confident and natural, wearing business casual attire. Editorial real estate photography, shallow depth of field.',
  office: 'A professional Norwegian real estate agent standing in a bright Scandinavian open-plan office. Light wood surfaces, tall windows with soft daylight, subtle greenery in the background. The agent looks approachable and confident. Clean editorial photography look.',
  studio: 'A professional Norwegian real estate agent against a smooth warm-neutral gradient studio backdrop. Soft, even professional lighting from the side. Confident, natural expression. High-end professional headshot, sharp focus on face.',
  neighborhood: 'A professional Norwegian real estate agent standing outdoors on a sunny Norwegian residential street. Traditional wooden houses painted in muted colors, leafy trees, clear blue sky, golden afternoon light. The agent looks relaxed and confident. Editorial lifestyle photography.',
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
    const { setting, portraitUrl, propertyImageUrl, prompt: customPrompt } = await request.json()

    if (!setting || !portraitUrl) {
      return Response.json({ error: 'Missing setting or portraitUrl' }, { status: 400 })
    }

    let falRes: Response

    if (setting === 'property_front') {
      if (!propertyImageUrl) {
        return Response.json({ error: 'Mangler propertyImageUrl for property_front' }, { status: 400 })
      }

      // OmniGen: composites the actual face + actual property image
      falRes = await fetch('https://fal.run/fal-ai/omnigen-v1', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${process.env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input_image_urls: [portraitUrl, propertyImageUrl],
          prompt: customPrompt || 'Half-body portrait of the person from <img><|image_1|></img> standing in the foreground. The person is large, centered, and fills most of the frame from waist up. The house from <img><|image_2|></img> is visible softly blurred behind them. Professional real estate photography.',
          negative_prompt: 'blurry, distorted face, extra fingers, bad anatomy, watermark, text, tiny person, small figure, full body, wide shot',
          num_images: 1,
          guidance_scale: 5.0,
          img_guidance_scale: 1.8,
          num_inference_steps: 20,
          image_size: 'landscape_16_9',
        }),
      })
    } else {
      const prompt = customPrompt || SETTING_PROMPTS[setting]
      if (!prompt) {
        return Response.json({ error: 'Unknown setting type' }, { status: 400 })
      }

      // Ideogram V3 Character QUALITY: best face fidelity, ~60-90s.
      falRes = await fetch('https://fal.run/fal-ai/ideogram/character', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${process.env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference_image_urls: [portraitUrl],
          prompt,
          negative_prompt: 'blurry, distorted face, deformed, extra fingers, bad anatomy, watermark, text, cartoon, illustration, painting, unrealistic skin',
          rendering_speed: 'QUALITY',
          style: 'REALISTIC',
          expand_prompt: false,
          num_images: 1,
          image_size: 'landscape_16_9',
          seed: Math.floor(Math.random() * 999999999),
        }),
      })
    }

    if (!falRes.ok) {
      const errText = await falRes.text()
      console.error('[generate-setting] fal.ai error:', falRes.status, errText)
      // Parse fal.ai validation error for cleaner message
      try {
        const errJson = JSON.parse(errText)
        const msg = errJson?.detail?.[0]?.msg || errJson?.message || errText
        return Response.json({ error: `fal.ai ${falRes.status}: ${msg}` }, { status: 500 })
      } catch {
        return Response.json({ error: `fal.ai ${falRes.status}: ${errText.slice(0, 200)}` }, { status: 500 })
      }
    }

    const falData = await falRes.json()
    const falImageUrl = falData.images?.[0]?.url
    if (!falImageUrl) {
      return Response.json({ error: 'No image returned from fal.ai' }, { status: 500 })
    }

    // For OmniGen (property_front): use fal.ai URL directly to save time
    // For PuLID: download and re-host on R2 for permanent storage
    let url: string
    if (setting === 'property_front') {
      url = falImageUrl
    } else {
      const imgRes = await fetch(falImageUrl)
      if (!imgRes.ok) return Response.json({ error: 'Failed to fetch fal.ai result' }, { status: 500 })
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
      const contentType = imgRes.headers.get('content-type') || 'image/png'
      const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png'

      const bucket = process.env.R2_BUCKET_NAME || 'contentforge-assets'
      const key = `boligforge/agent/settings/${setting}_${Date.now()}.${ext}`

      await getR2().send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: imgBuffer, ContentType: contentType })
      )
      url = `${process.env.R2_PUBLIC_URL}/${key}`
    }

    await getSupabase().from('agent_settings_images').insert({
      setting_type: setting,
      image_url: url,
    })

    return Response.json({ url, setting })
  } catch (err: unknown) {
    console.error('[generate-setting]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
