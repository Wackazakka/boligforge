import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { readFileSync } from 'fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const c = new S3Client({ region:'auto', endpoint: env.R2_ENDPOINT, credentials:{ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } })
let token, rows=[]
do {
  const r = await c.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET_NAME || 'contentforge-assets', Prefix: 'boligforge/tts-preview/', ContinuationToken: token }))
  for (const o of r.Contents||[]) rows.push([o.Key, o.LastModified.toISOString(), o.Size])
  token = r.IsTruncated ? r.NextContinuationToken : null
} while (token)
rows.filter(r=>r[1].startsWith('2026-08-20T12:18:4')).sort((a,b)=>a[1].localeCompare(b[1])).forEach(r=>console.log(r[0], r[1], r[2]))
