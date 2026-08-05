import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getUser } from '../../../../lib/supabase/server'

// Per-segment avatar-klipp: generer og forhåndsvis VEED Fabric-lipsyncen FØR
// videogenereringen. Klippet brukeren godkjenner sendes som seg.videoUrl til
// worker-en, som da HOPPER OVER Fabric for det segmentet — samme take i videoen
// som i forhåndsvisningen, raskere og billigere regenerering.
//
// Kø-mønster som generate-setting: Fabric bruker 1–3 min, langt over Netlifys
// ~26 s-tak, så POST sender inn jobben og GET poller til klippet er klart.

export const runtime = 'nodejs'

const QUEUE = 'https://queue.fal.run/veed/fabric-1.0'

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

function publicBase(): string {
  return process.env.R2_PUBLIC_URL || 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev'
}

// Send inn lipsync-jobben — svarer umiddelbart med request_id
export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { imageUrl, audioUrl } = await request.json()
    if (!imageUrl || !audioUrl) {
      return Response.json({ error: 'Mangler imageUrl eller audioUrl' }, { status: 400 })
    }
    // Kun ressurser fra vår egen R2 — endepunktet skal ikke kunne peke fal mot vilkårlige URL-er
    const base = publicBase()
    if (!String(imageUrl).startsWith(base) || !String(audioUrl).startsWith(base)) {
      return Response.json({ error: 'Ugyldig kilde for bilde eller lyd' }, { status: 400 })
    }

    const falRes = await fetch(QUEUE, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      // 480p matcher worker-ens egen Fabric-oppløsning (scraper.js) — klippet
      // skal være identisk med det worker-en selv ville laget.
      body: JSON.stringify({ image_url: imageUrl, audio_url: audioUrl, resolution: '480p' }),
    })

    if (!falRes.ok) {
      const errText = await falRes.text()
      console.error('[avatar-clip] fal queue submit error:', falRes.status, errText.slice(0, 300))
      return Response.json({ error: `fal.ai ${falRes.status}` }, { status: 502 })
    }

    const falData = await falRes.json()
    if (!falData.request_id) {
      return Response.json({ error: 'fal.ai returnerte ingen request_id' }, { status: 502 })
    }

    return Response.json({ request_id: falData.request_id })
  } catch (err: unknown) {
    console.error('[avatar-clip] submit', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

// Poll jobben — når ferdig: hent klippet, host på R2, returner varig URL
export async function GET(request: Request) {
  try {
    const user = await getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const requestId = new URL(request.url).searchParams.get('request_id') ?? ''
    // request_id går inn i URL-en mot fal — valider strengt (ingen sti-injeksjon)
    if (!/^[a-zA-Z0-9-]+$/.test(requestId)) {
      return Response.json({ error: 'Ugyldig request_id' }, { status: 400 })
    }

    const auth = { 'Authorization': `Key ${process.env.FAL_KEY}` }

    const statusRes = await fetch(`${QUEUE}/requests/${requestId}/status`, { headers: auth })
    if (!statusRes.ok) {
      const t = await statusRes.text()
      console.error('[avatar-clip] fal status error:', statusRes.status, t.slice(0, 200))
      return Response.json({ error: `fal.ai status ${statusRes.status}` }, { status: 502 })
    }
    const statusData = await statusRes.json()

    if (statusData.status !== 'COMPLETED') {
      // IN_QUEUE / IN_PROGRESS → klienten poller videre
      return Response.json({ status: 'pending', queue_status: statusData.status })
    }

    const resultRes = await fetch(`${QUEUE}/requests/${requestId}`, { headers: auth })
    if (!resultRes.ok) {
      return Response.json({ error: `fal.ai result ${resultRes.status}` }, { status: 502 })
    }
    const falData = await resultRes.json()
    const clipUrl = falData.video?.url
    if (!clipUrl) {
      console.error('[avatar-clip] no video in result:', JSON.stringify(falData).slice(0, 300))
      return Response.json({ error: 'Ingen video fra fal.ai' }, { status: 502 })
    }

    const clipRes = await fetch(clipUrl)
    if (!clipRes.ok) return Response.json({ error: 'Kunne ikke hente klippet' }, { status: 502 })
    const clip = Buffer.from(await clipRes.arrayBuffer())

    const bucket = process.env.R2_BUCKET_NAME || 'contentforge-assets'
    const key = `boligforge/avatar-clips/${user.id}_${Date.now()}.mp4`
    await getR2().send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: clip, ContentType: 'video/mp4' })
    )

    return Response.json({ status: 'done', url: `${publicBase()}/${key}` })
  } catch (err: unknown) {
    console.error('[avatar-clip] poll', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
