import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'
import { keyForAccount } from '../../../../lib/elevenlabs-accounts'

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

  // En klonet stemme kan bare brukes med nøkkelen til KONTOEN den bor på
  // (stemmeplass-taket tvinger fram flere kontoer ved skala). Slå opp hvilken
  // konto meglerens stemme ligger på; ukjent → primærkontoen, som før.
  let account: string | null = null
  try {
    const user = await getUser()
    if (user) {
      const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } })
      const { data } = await svc.from('agent_profiles').select('elevenlabs_account, cloned_voice_id').eq('user_id', user.id).maybeSingle()
      const row = data as { elevenlabs_account?: string | null; cloned_voice_id?: string | null } | null
      if (row && row.cloned_voice_id === voiceId) account = row.elevenlabs_account ?? null
    }
  } catch { /* faller tilbake til primærkontoen */ }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': keyForAccount(account),
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
