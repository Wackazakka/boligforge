import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fal } from '@fal-ai/client'

fal.config({ credentials: process.env.FAL_KEY! })

const SCRAPER_URL = 'http://139.59.212.218:3003'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: Request) {
  try {
    const { propertyId, script, voiceId, avatarImageUrl, propertyImages } = await request.json()

    if (!script || !voiceId || !avatarImageUrl) {
      return NextResponse.json({ error: 'Mangler script, voiceId eller avatarImageUrl' }, { status: 400 })
    }

    // Step 1: ElevenLabs TTS
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_turbo_v2_5',
        language_code: 'no',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    })

    if (!ttsRes.ok) {
      const err = await ttsRes.text()
      return NextResponse.json({ error: `ElevenLabs feilet: ${err}` }, { status: 500 })
    }

    const audioBuffer = await ttsRes.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString('base64')
    const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`

    // Step 2: Upload audio to fal storage
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
    const audioFile = new File([audioBlob], 'speech.mp3', { type: 'audio/mpeg' })
    const audioUrl = await fal.storage.upload(audioFile)

    // Step 3: VEED Fabric lipsync
    const lipsyncResult = await fal.run('fal-ai/veed/avatars/video-lipsync', {
      input: {
        video_url: avatarImageUrl,
        audio_url: audioUrl,
      },
    }) as { video_url?: string; data?: { video_url?: string } }

    const lipsyncVideoUrl = lipsyncResult?.video_url ?? (lipsyncResult as { data?: { video_url?: string } })?.data?.video_url
    if (!lipsyncVideoUrl) {
      return NextResponse.json({ error: 'VEED Fabric returnerte ingen video' }, { status: 500 })
    }

    // Step 4: ffmpeg assembly on droplet
    const assembleRes = await fetch(`${SCRAPER_URL}/assemble-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatarVideoUrl: lipsyncVideoUrl,
        audioUrl,
        propertyImages: (propertyImages || []).slice(0, 8),
      }),
      signal: AbortSignal.timeout(120000),
    })

    if (!assembleRes.ok) {
      const err = await assembleRes.json().catch(() => ({ error: 'Assembly feilet' }))
      return NextResponse.json({ error: err.error || 'Assembly feilet' }, { status: 500 })
    }

    const { videoUrl } = await assembleRes.json()

    // Step 5: Save to production_jobs
    if (propertyId) {
      await getSupabase().from('production_jobs').insert({
        property_id: propertyId,
        script,
        video_url: videoUrl,
        status: 'done',
      })
    }

    return NextResponse.json({ videoUrl })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
