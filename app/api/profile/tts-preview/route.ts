export const maxDuration = 30

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

  const audio = await res.arrayBuffer()
  return new Response(audio, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
