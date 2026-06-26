// Delt hjelper for ElevenLabs Professional Voice Cloning (PVC).
// PVC-flyt: create → samples (≥30 min) → captcha-verifisering → train → poll
// til fine_tuned → bind til LiveAvatar (third-party).
//
// State lagres som pvc.json i onboarding-bucketen (ingen DB-migrering nødvendig).

import { serviceClient } from './rag'

const EL = 'https://api.elevenlabs.io'
export const PVC_BUCKET = 'liveavatar-onboarding'

export type PvcStatus = 'created' | 'samples' | 'verifying' | 'training' | 'ready' | 'failed'
export interface PvcState {
  voice_id: string
  status: PvcStatus
  sample_count: number
  created_at: string
  liveavatar_voice_id?: string
  note?: string
}

export function elKey(): string {
  const k = process.env.ELEVENLABS_API_KEY
  if (!k) throw new Error('ELEVENLABS_API_KEY mangler')
  return k
}

// JSON-kall mot ElevenLabs
export async function elJson(path: string, init: RequestInit = {}) {
  const res = await fetch(`${EL}${path}`, {
    ...init,
    headers: { 'xi-api-key': elKey(), ...(init.headers || {}) },
  })
  const text = await res.text()
  let data: unknown = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { ok: res.ok, status: res.status, data }
}

export function pvcPath(userId: string) { return `${userId}/pvc.json` }

export async function readPvcState(userId: string): Promise<PvcState | null> {
  const client = serviceClient()
  const { data } = await client.storage.from(PVC_BUCKET).download(pvcPath(userId))
  if (!data) return null
  try { return JSON.parse(await data.text()) as PvcState } catch { return null }
}

export async function writePvcState(userId: string, state: PvcState): Promise<void> {
  const client = serviceClient()
  await client.storage.from(PVC_BUCKET).upload(pvcPath(userId), JSON.stringify(state, null, 2), {
    contentType: 'application/json', upsert: true,
  })
}

// Binder en ferdig ElevenLabs-stemme til LiveAvatar (third-party) → liveavatar_voice_id
export async function bindToLiveAvatar(voiceId: string, name: string): Promise<string | null> {
  const secretId = process.env.LIVEAVATAR_ELEVEN_SECRET_ID
  const apiKey = process.env.LIVEAVATAR_API_KEY
  if (!secretId || !apiKey) return null
  const res = await fetch('https://api.liveavatar.com/v1/voices/third_party', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ provider_voice_id: voiceId, secret_id: secretId, name: name.slice(0, 60) }),
  })
  const d = await res.json().catch(() => ({}))
  return d?.data?.voice_id || d?.data?.id || null
}
