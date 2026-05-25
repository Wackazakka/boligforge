import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const AVATAR_R2 = 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev/boligforge/template-avatars'
const PROMPTS = {
  neighborhood: 'A professional Norwegian real estate agent standing outdoors on a sunny Norwegian residential street. Traditional wooden houses painted in muted colors, leafy trees, clear blue sky, golden afternoon light. The agent looks relaxed and confident. Editorial lifestyle photography.',
  office: 'A professional Norwegian real estate agent standing in a bright Scandinavian open-plan office. Light wood surfaces, tall windows with soft daylight, subtle greenery in the background. The agent looks approachable and confident. Clean editorial photography look.',
  modern_home: 'A professional Norwegian real estate agent standing outdoors in front of a beautiful modern Norwegian home. White render walls, large black-frame windows, lush green garden, warm golden-hour sunlight. The agent looks confident and natural, wearing business casual attire. Editorial real estate photography, shallow depth of field.',
}
const MISSING = [
  ['marius', 'neighborhood'],
  ['ingrid', 'neighborhood'],
  ['even', 'office'],
  ['hanna', 'modern_home'],
]

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
})

for (const [av, s] of MISSING) {
  console.log('→', av, s)
  const falRes = await fetch('https://fal.run/fal-ai/ideogram/character', {
    method: 'POST',
    headers: { Authorization: 'Key ' + process.env.FAL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reference_image_urls: [AVATAR_R2 + '/' + av + '.jpg'],
      prompt: PROMPTS[s],
      negative_prompt: 'blurry, distorted face, deformed, extra fingers, bad anatomy, watermark, text, cartoon',
      rendering_speed: 'QUALITY', style: 'REALISTIC', expand_prompt: false,
      num_images: 1, image_size: 'landscape_16_9', seed: Math.floor(Math.random() * 999999999),
    }),
  })
  if (!falRes.ok) { console.error('FAIL', av, s, (await falRes.text()).slice(0, 200)); continue }
  const d = await falRes.json()
  const imgUrl = d.images?.[0]?.url
  const imgRes = await fetch(imgUrl)
  const buf = Buffer.from(await imgRes.arrayBuffer())
  const key = `boligforge/presets/${av}_${s}.png`
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME || 'contentforge-assets',
    Key: key, Body: buf, ContentType: 'image/png',
  }))
  console.log('✓', av + '/' + s, '->', process.env.R2_PUBLIC_URL + '/' + key)
}
console.log('Ferdig!')
