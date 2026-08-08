import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'
import { keyForAccount, pickAccountWithCapacity, PRIMARY_ACCOUNT } from '../../../../lib/elevenlabs-accounts'

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

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const audio = formData.get('audio') as File | null
    const name = (formData.get('name') as string) || 'Meglers stemme'

    if (!audio) {
      return Response.json({ error: 'Mangler lydfil' }, { status: 400 })
    }

    // 1) Ta vare på stemmeprøven FØR kloning. Uten den kan en klone aldri
    // flyttes til en annen ElevenLabs-konto (eller gjenskapes hos en annen
    // leverandør) uten at megleren må gjøre nytt opptak — og stemmeplassene
    // per konto har et hardt tak. Feiler opplastingen, blokkerer vi ikke
    // kloningen; da mangler vi bare flytte-muligheten for akkurat den.
    const audioBuf = Buffer.from(await audio.arrayBuffer())
    let sampleUrl: string | null = null
    try {
      const ext = (audio.name?.split('.').pop() || 'webm').toLowerCase().slice(0, 5)
      const key = `boligforge/voice-samples/${user.id}/${randomUUID()}.${ext}`
      await getR2().send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || 'contentforge-assets',
        Key: key,
        Body: audioBuf,
        ContentType: audio.type || 'audio/webm',
      }))
      sampleUrl = `${process.env.R2_PUBLIC_URL}/${key}`
    } catch (e) {
      console.error('[clone-voice] kunne ikke lagre stemmeprøve (fortsetter):', e)
    }

    // 2) Velg konto med ledig stemmeplass. Med bare én konto konfigurert
    // oppfører dette seg som før (primærkontoen).
    const picked = await pickAccountWithCapacity()
    if (!picked) {
      return Response.json({
        error: 'Ingen ledige stemmeplasser hos leverandøren akkurat nå. Vi utvider kapasiteten — prøv igjen senere, eller bruk en av standardstemmene i mellomtiden.',
      }, { status: 503 })
    }
    const { account, key: apiKey } = picked

    // 3) Instant Voice Cloning. remove_background_noise: meglere tar ofte opp i
    // åpne kontorlandskap, og støy i opptaket klones INN i stemmen — den følger
    // da hver eneste video megleren lager.
    const elForm = new FormData()
    elForm.append('name', name)
    elForm.append('files', new Blob([new Uint8Array(audioBuf)], { type: audio.type || 'audio/webm' }), 'recording.webm')
    elForm.append('remove_background_noise', 'true')

    const elRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
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
    console.log(`[clone-voice] bruker ${user.id} → voice ${voiceId} på konto ${account}`)

    // Save voice_id to agent profile
    const supabase = await createSupabaseServerClient()
    const { error: dbError } = await supabase
      .from('agent_profiles')
      .upsert(
        {
          user_id: user.id,
          default_voice_id: voiceId,
          cloned_voice_id: voiceId,
          elevenlabs_account: account,
          ...(sampleUrl ? { voice_sample_url: sampleUrl } : {}),
        },
        { onConflict: 'user_id' }
      )

    if (dbError) {
      console.error('[clone-voice] Supabase error:', dbError)
      // Voice was cloned successfully — return voice_id even if DB save failed
    }

    // Best-effort: importer den klonede stemmen til LiveAvatar også, så premium
    // video-avatar bruker meglerens egen stemme. Blokkerer ikke IVC-resultatet.
    try {
      const secretId = process.env.LIVEAVATAR_ELEVEN_SECRET_ID
      const laKey = process.env.LIVEAVATAR_API_KEY
      if (secretId && laKey && account === PRIMARY_ACCOUNT) {
        const laRes = await fetch('https://api.liveavatar.com/v1/voices/third_party', {
          method: 'POST',
          headers: { 'X-API-KEY': laKey, 'content-type': 'application/json' },
          body: JSON.stringify({ provider_voice_id: voiceId, secret_id: secretId, name: `${name}`.slice(0, 60) }),
        })
        const laData = await laRes.json().catch(() => ({}))
        const laVoiceId = laData?.data?.voice_id || laData?.data?.id
        if (laVoiceId) {
          await supabase.from('agent_profiles').upsert(
            { user_id: user.id, liveavatar_voice_id: laVoiceId }, { onConflict: 'user_id' },
          )
        } else {
          console.warn('[clone-voice] LiveAvatar-binding ga ingen voice_id:', laData?.message)
        }
      }
    } catch (e) {
      console.warn('[clone-voice] LiveAvatar-binding feilet (ikke-blokkerende):', e)
    }

    return Response.json({ voice_id: voiceId })
  } catch (err: unknown) {
    console.error('[clone-voice]', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

// Kort referanse for kapasitet — brukes av drift/backoffice for å se hvor nær
// taket vi er FØR meglere møter en feilmelding.
export async function GET() {
  const user = await getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const key = keyForAccount(PRIMARY_ACCOUNT)
  if (!key) return Response.json({ error: 'Ingen nøkkel konfigurert' }, { status: 500 })
  const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key } })
  const s = await res.json()
  return Response.json({
    tier: s.tier,
    voiceSlots: `${s.voice_slots_used}/${s.voice_limit}`,
    voiceOpsLeft: (s.max_voice_add_edits ?? 0) - (s.voice_add_edit_counter ?? 0),
  })
}
