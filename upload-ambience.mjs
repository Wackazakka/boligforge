import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync, readdirSync } from 'fs'

const client = new S3Client({
  region: 'auto',
  endpoint: 'https://c2fde28004c6c81dfe77184575d12d96.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: 'b6c1c783a26b0f10186e78c5f0d4eb9b',
    secretAccessKey: '4b6d02ed74d5bc3030aa378ea9860f99031c14da0953fdc7c4f72d908bfe471e',
  },
})

const BUCKET = 'contentforge-assets'
const PREFIX = 'boligforge/audio/ambience'
const DIR = '/tmp/ambience-mp3'
const PUBLIC = 'https://pub-5dcdfe9305a740febc87568c9ccb40a6.r2.dev'

const files = readdirSync(DIR).filter(f => f.endsWith('.mp3')).sort()

for (const file of files) {
  const key = `${PREFIX}/${file}`
  const body = readFileSync(`${DIR}/${file}`)
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: 'audio/mpeg',
    CacheControl: 'public, max-age=31536000',
  }))
  console.log(`✓ ${file}  →  ${PUBLIC}/${key}`)
}
console.log('\nFerdig!')
