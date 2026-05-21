import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60

const USER_ID = '00000000-0000-0000-0000-000000000001'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio') as File | null
    const name = (formData.get('name') as string) || 'Meglers stemme'

    if (!audio) {
      return Response.json({ error: 'Mangler lydfil' }, { status: 400 })
    }

    // Send audio to ElevenLabs Instant Voice Cloning
    const elForm = new FormData()
    elForm.append('name', name)
    elForm.append('files', audio, 'recording.webm')

    const elRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
      body: elForm,
    })

    if (!elRes.ok) {
      const errText = await elRes.text()
      console.error('[clone-voice] ElevenLabs error:', elRes.status, errText)
      return Response.json(
        { error: `ElevenLabs feil (${elRes.status}): ${errText.slice(0, 200)}` },
        { status: 500 }
      )
    }

    const elData = await elRes.json()
    const voiceId = elData.voice_id
    if (!voiceId) {
      return Response.json({ error: 'Ingen voice_id returnert fra ElevenLabs' }, { status: 500 })
    }

    // Save voice_id to agent profile
    const { error: dbError } = await getSupabase()
      .from('agent_profiles')
      .upsert(
        { user_id: USER_ID, default_voice_id: voiceId },
        { onConflict: 'user_id' }
      )

    if (dbError) {
      console.error('[clone-voice] Supabase error:', dbError)
      // Voice was cloned successfully — return voice_id even if DB save failed
    }

    return Response.json({ voice_id: voiceId })
  } catch (err: unknown) {
    console.error('[clone-voice]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
