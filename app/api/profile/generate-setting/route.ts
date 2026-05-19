import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export const maxDuration = 120

// Prompts describe the full scene — PuLID generates from scratch with the agent's face as identity reference
const SETTING_PROMPTS: Record<string, string> = {
  modern_home: 'A professional Norwegian real estate agent standing outdoors in front of a beautiful modern Norwegian home. White render walls, large black-frame windows, lush green garden, warm golden-hour sunlight. The agent is smiling confidently, wearing business casual attire. Editorial real estate photography, shallow depth of field.',
  office: 'A professional Norwegian real estate agent standing in a bright Scandinavian open-plan office. Light wood surfaces, tall windows with soft daylight, subtle greenery in the background. The agent looks approachable and confident. Clean editorial photography look.',
  studio: 'A professional Norwegian real estate agent against a smooth warm-neutral gradient studio backdrop. Soft, even professional lighting from the side. Confident, friendly expression. High-end professional headshot, sharp focus on face.',
  neighborhood: 'A professional Norwegian real estate agent standing outdoors on a sunny Norwegian residential street. Traditional wooden houses painted in muted colors, leafy trees, clear blue sky, golden afternoon light. The agent is relaxed and smiling. Editorial lifestyle photography.',
  property_front: 'A professional Norwegian real estate agent standing in front of a beautiful white Norwegian family home at dusk. The house has a large wraparound deck with white railings, a double garage, large windows with warm interior lighting, lush garden with green shrubs. The agent stands on the gravel driveway, smiling confidently. Editorial real estate photography, blue-hour lighting.',
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
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const keepAlive = setInterval(() => {
        try { controller.enqueue(encoder.encode('\n')) } catch { /* closed */ }
      }, 5000)

      const send = (data: object) => {
        clearInterval(keepAlive)
        try {
          controller.enqueue(encoder.encode(JSON.stringify(data)))
          controller.close()
        } catch { /* closed */ }
      }

      try {
        const { setting, portraitUrl } = await request.json()

        if (!setting || !portraitUrl) return send({ error: 'Missing setting or portraitUrl' })

        const prompt = SETTING_PROMPTS[setting]
        if (!prompt) return send({ error: 'Unknown setting type' })

        // PuLID: identity-preserving generation — face image as reference, scene described in prompt
        const falRes = await fetch('https://fal.run/fal-ai/pulid', {
          method: 'POST',
          headers: {
            'Authorization': `Key ${process.env.FAL_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reference_images: [{ image_url: portraitUrl }],
            prompt,
            negative_prompt: 'blurry, distorted face, extra fingers, bad anatomy, watermark, text, unrealistic',
            num_images: 1,
            guidance_scale: 1.5,
            num_inference_steps: 20,
            id_scale: 0.8,
            mode: 'fidelity',
            image_size: 'portrait_4_3',
          }),
        })

        if (!falRes.ok) {
          const err = await falRes.text()
          console.error('[generate-setting] fal.ai error:', err)
          return send({ error: 'fal.ai feilet: ' + err })
        }

        const falData = await falRes.json()
        const falImageUrl = falData.images?.[0]?.url
        if (!falImageUrl) return send({ error: 'No image returned from fal.ai' })

        // Download from fal.ai and upload to R2
        const imgRes = await fetch(falImageUrl)
        if (!imgRes.ok) return send({ error: 'Failed to fetch fal.ai result' })
        const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

        const bucket = process.env.R2_BUCKET_NAME || 'contentforge-assets'
        const key = `boligforge/agent/settings/${setting}_${Date.now()}.png`

        await getR2().send(
          new PutObjectCommand({ Bucket: bucket, Key: key, Body: imgBuffer, ContentType: 'image/png' })
        )

        const url = `${process.env.R2_PUBLIC_URL}/${key}`

        await getSupabase().from('agent_settings_images').insert({
          setting_type: setting,
          image_url: url,
        })

        send({ url, setting })
      } catch (err: unknown) {
        console.error('[generate-setting]', err)
        send({ error: String(err) })
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' },
  })
}
