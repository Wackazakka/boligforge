import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'

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
  const { text, voiceId } = await request.json()
  if (!text || !voiceId) {
    return new Response('Missing text or voiceId', { status: 400 })
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      language_code: 'no',
      voice_settings: { stability: 0.5, similarity_boost: 0.8 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(`ElevenLabs error: ${err}`, { status: 500 })
  }

  const audioBuf = await res.arrayBuffer()

  // Upload to R2 so the worker can reuse this exact audio later
  const key = `boligforge/tts-preview/${randomUUID()}.mp3`
  try {
    await getR2().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'contentforge-assets',
      Key: key,
      Body: Buffer.from(audioBuf),
      ContentType: 'audio/mpeg',
    }))
  } catch (e) {
    console.warn('[tts-preview] R2 upload failed, falling back to blob-only:', e)
    // Fall back: return raw audio so playback still works
    return new Response(audioBuf, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    })
  }

  const audioUrl = `${process.env.R2_PUBLIC_URL}/${key}`

  // Return JSON with both the public URL and the audio data (base64) for immediate playback
  const base64 = Buffer.from(audioBuf).toString('base64')
  return Response.json({ audioUrl, audioBase64: base64 })
}
