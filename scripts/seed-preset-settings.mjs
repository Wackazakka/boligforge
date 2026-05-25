/**
 * Seed-script: genererer 6 avatarer × 4 settings = 24 bilder via fal.ai,
 * laster dem opp til R2, og printer en ferdig AVATAR_PRESETS-konstant.
 *
 * Kjør med:
 *   node --env-file=.env.local scripts/seed-preset-settings.mjs
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const AVATAR_R2 = 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/template-avatars'

const AVATARS = ['sofia', 'marius', 'ingrid', 'even', 'hanna', 'erik']

const SETTINGS = {
  modern_home: 'A professional Norwegian real estate agent standing outdoors in front of a beautiful modern Norwegian home. White render walls, large black-frame windows, lush green garden, warm golden-hour sunlight. The agent looks confident and natural, wearing business casual attire. Editorial real estate photography, shallow depth of field.',
  office: 'A professional Norwegian real estate agent standing in a bright Scandinavian open-plan office. Light wood surfaces, tall windows with soft daylight, subtle greenery in the background. The agent looks approachable and confident. Clean editorial photography look.',
  studio: 'A professional Norwegian real estate agent against a smooth warm-neutral gradient studio backdrop. Soft, even professional lighting from the side. Confident, natural expression. High-end professional headshot, sharp focus on face.',
  neighborhood: 'A professional Norwegian real estate agent standing outdoors on a sunny Norwegian residential street. Traditional wooden houses painted in muted colors, leafy trees, clear blue sky, golden afternoon light. The agent looks relaxed and confident. Editorial lifestyle photography.',
}

function getR2() {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  })
}

async function generateOne(avatarId, settingId) {
  const portraitUrl = `${AVATAR_R2}/${avatarId}.jpg`
  const prompt = SETTINGS[settingId]

  console.log(`  → Starter: ${avatarId}/${settingId}`)

  const falRes = await fetch('https://fal.run/fal-ai/ideogram/character', {
    method: 'POST',
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reference_image_urls: [portraitUrl],
      prompt,
      negative_prompt:
        'blurry, distorted face, deformed, extra fingers, bad anatomy, watermark, text, cartoon, illustration, painting, unrealistic skin',
      rendering_speed: 'QUALITY',
      style: 'REALISTIC',
      expand_prompt: false,
      num_images: 1,
      image_size: 'landscape_16_9',
      seed: Math.floor(Math.random() * 999999999),
    }),
  })

  if (!falRes.ok) {
    const txt = await falRes.text()
    throw new Error(`fal.ai ${falRes.status} for ${avatarId}/${settingId}: ${txt.slice(0, 200)}`)
  }

  const falData = await falRes.json()
  const falImageUrl = falData.images?.[0]?.url
  if (!falImageUrl) throw new Error(`Ingen bilde-URL fra fal.ai for ${avatarId}/${settingId}`)

  // Last ned og re-host på R2
  const imgRes = await fetch(falImageUrl)
  if (!imgRes.ok) throw new Error(`Klarte ikke hente bilde fra fal.ai for ${avatarId}/${settingId}`)
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
  const ext = contentType.includes('png') ? 'png' : 'jpg'

  const bucket = process.env.R2_BUCKET_NAME || 'contentforge-assets'
  const key = `boligforge/presets/${avatarId}_${settingId}.${ext}`

  await getR2().send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: imgBuffer, ContentType: contentType })
  )

  const url = `${process.env.R2_PUBLIC_URL}/${key}`
  console.log(`  ✓ Ferdig: ${avatarId}/${settingId} → ${url}`)
  return { avatarId, settingId, url }
}

async function main() {
  // Sjekk obligatoriske env-variabler
  const required = ['FAL_KEY', 'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL']
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Mangler env-variabel: ${key}`)
      process.exit(1)
    }
  }

  console.log(`\nGenererer ${AVATARS.length} avatarer × ${Object.keys(SETTINGS).length} settings = ${AVATARS.length * Object.keys(SETTINGS).length} bilder...\n`)
  console.log('Kjører alle parallelt. Estimert tid: ~90 sekunder.\n')

  const jobs = []
  for (const avatarId of AVATARS) {
    for (const settingId of Object.keys(SETTINGS)) {
      jobs.push(generateOne(avatarId, settingId))
    }
  }

  const results = await Promise.allSettled(jobs)

  const succeeded = []
  const failed = []
  for (const r of results) {
    if (r.status === 'fulfilled') succeeded.push(r.value)
    else failed.push(r.reason)
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} feil:`)
    for (const e of failed) console.error(' ', e.message || e)
  }

  if (succeeded.length === 0) {
    console.error('\nIngen bilder generert.')
    process.exit(1)
  }

  // Bygg opp AVATAR_PRESETS-objekt
  const presets = {}
  for (const { avatarId, settingId, url } of succeeded) {
    if (!presets[avatarId]) presets[avatarId] = {}
    presets[avatarId][settingId] = url
  }

  console.log('\n\n========== KOPIER DETTE INN I KODEN ==========\n')
  console.log('const AVATAR_PRESETS: Record<string, Record<string, string>> = ' +
    JSON.stringify(presets, null, 2))
  console.log('\n==============================================\n')
  console.log(`✓ ${succeeded.length}/${jobs.length} bilder generert og lastet opp til R2.`)
}

main().catch(e => { console.error(e); process.exit(1) })
