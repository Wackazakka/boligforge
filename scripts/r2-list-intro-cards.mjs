// Engangs: finn Ninas intro-kort på R2 (kjøres fra repo-rota for node_modules)
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { readFileSync } from 'fs'
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const c = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
})
const prefix = process.argv[2] || 'boligforge/intro-cards/f8ae89ce'
const r = await c.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET_NAME || 'contentforge-assets', Prefix: prefix }))
for (const o of r.Contents || []) console.log(o.Key, o.Size, o.LastModified?.toISOString())
if (!r.Contents?.length) console.log('(ingen treff)')
