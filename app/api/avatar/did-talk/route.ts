// Sender tekst til en aktiv D-ID stream slik at avataren snakker.
// Bruker meglerens ElevenLabs-stemmeklone hvis voice_id er oppgitt.

import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabase/server'
import { speakifyForTTS } from '../../../../lib/norwegian-numbers'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { stream_id, session_id, text, voice_id } = await request.json()
  if (!stream_id || !session_id || !text) {
    return NextResponse.json({ error: 'Mangler stream_id, session_id eller text' }, { status: 400 })
  }

  const ttsText = speakifyForTTS(text)
  const effectiveVoiceId = voice_id || process.env.DID_VOICE_ID

  // Stemme-provider. ElevenLabs (klonet meglerstemme) krever at ElevenLabs-integrasjonen
  // er koblet i D-ID Studio — ellers produserer D-ID en tom talk (started→done på ~1s,
  // ingen lyd). Default er derfor D-IDs egen norske Microsoft-stemme som alltid virker.
  // Skru på klonet stemme med DID_USE_ELEVENLABS=1 når Studio-integrasjonen er på plass.
  const useEleven = process.env.DID_USE_ELEVENLABS === '1' && !!effectiveVoiceId
  const voiceProvider = useEleven
    ? { type: 'elevenlabs', voice_id: effectiveVoiceId }
    : { type: 'microsoft', voice_id: process.env.DID_MS_VOICE || 'nb-NO-FinnNeural' }

  // D-ID Streams: tale-script sendes til selve stream-ressursen (POST /talks/streams/{id}),
  // IKKE .../talk (det finnes ikke → faller gjennom til AWS-gateway → 403 SigV4-feil).
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${process.env.DID_API_KEY}`,
  }
  // ElevenLabs-stemmer krever ElevenLabs-nøkkelen i EGET header (ikke i body eller Studio).
  // Uten den produserer D-ID en tom talk (~1s, ingen lyd) — det var nettopp feilen.
  if (useEleven && process.env.ELEVENLABS_API_KEY) {
    headers['x-api-key-external'] = JSON.stringify({ elevenlabs: process.env.ELEVENLABS_API_KEY })
  }

  const res = await fetch(`https://api.d-id.com/talks/streams/${stream_id}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      script: {
        type: 'text',
        input: ttsText,
        provider: voiceProvider,
      },
      session_id,
      config: { stitch: true },
    }),
  })

  if (!res.ok) {
    const data = await res.json()
    console.error('[did-talk] feilet:', data)
    return NextResponse.json({ error: data.description ?? data.message ?? 'D-ID talk feilet' }, { status: res.status })
  }

  return NextResponse.json({ ok: true })
}
