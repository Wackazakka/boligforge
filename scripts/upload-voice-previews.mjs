// Engangs: last opp normaliserte stemmeprøver til R2 (kjøres fra repo-rota)
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync, readdirSync } from 'fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const c = new S3Client({ region:'auto', endpoint: env.R2_ENDPOINT, credentials:{ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } })
const dir = '/private/tmp/claude-503/-Users-larskilevold-1/da87afca-a3b1-4226-978e-4dc579bc87ca/scratchpad/vprev'
for (const f of readdirSync(dir).filter(f => f.endsWith('_norm.mp3'))) {
  const vid = f.replace('_norm.mp3','')
  const key = `boligforge/voice-previews/${vid}.mp3`
  await c.send(new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME || 'contentforge-assets', Key: key, Body: readFileSync(`${dir}/${f}`), ContentType: 'audio/mpeg' }))
  console.log('opp:', key)
}
