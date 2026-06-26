// Kalles etter at videoen er lastet opp. Lagrer samtykke-spor (juridisk/GDPR) og
// markerer at opptaket venter på avatar-opprettelse (vårt manuelle LiveAvatar-steg).

import { NextResponse } from 'next/server'
import { getUser } from '../../../../../lib/supabase/server'
import { serviceClient } from '../../../../../lib/avatar/rag'

export const runtime = 'nodejs'
const BUCKET = 'liveavatar-onboarding'

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (!body.consent) return NextResponse.json({ error: 'Samtykke kreves' }, { status: 400 })

  const client = serviceClient()

  // Samtykke-spor — lagres som fil ved siden av opptaket
  const consent = {
    user_id: user.id,
    consented: true,
    name: String(body.name || ''),
    statement: 'Bekrefter at jeg er personen i opptaket og samtykker til at min stemme og mitt ansikt klones til en digital avatar for ReelHome.',
    consented_at: new Date().toISOString(),
  }
  await client.storage.from(BUCKET).upload(`${user.id}/consent.json`, JSON.stringify(consent, null, 2), {
    contentType: 'application/json', upsert: true,
  }).catch((e) => console.warn('[onboarding/complete] samtykke-lagring feilet:', e))

  return NextResponse.json({ ok: true, status: 'pending' })
}
