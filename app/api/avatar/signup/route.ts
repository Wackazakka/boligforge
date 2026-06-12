// Kjøper-påmelding (Spor C, uautentisert). Validerer felt mot porten (gate_mode),
// lager en viewing_signup med token + samtykke, returnerer token til kjøper-siden.
import { NextResponse } from 'next/server'
import { serviceClient } from '../../../../lib/avatar/rag'

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}))
  const { propertyId, name, email, phone, consent } = b
  if (!propertyId) return NextResponse.json({ error: 'Mangler propertyId' }, { status: 400 })
  if (!consent) return NextResponse.json({ error: 'Samtykke kreves' }, { status: 400 })

  const svc = serviceClient()
  const { data: cfg } = await svc
    .from('reelhome_avatar_config')
    .select('enabled, gate_mode, viewing_date, token_expiry_hours')
    .eq('property_id', propertyId)
    .maybeSingle()
  if (!cfg?.enabled) return NextResponse.json({ error: 'AI-megleren er ikke aktivert for denne boligen.' }, { status: 403 })

  // Feltkrav per modus: contact/viewing krever full kontaktinfo; consent krever kun samtykke.
  if (cfg.gate_mode === 'contact' || cfg.gate_mode === 'viewing') {
    if (!name || !email || !phone) {
      return NextResponse.json({ error: 'Navn, e-post og telefon kreves.' }, { status: 400 })
    }
  }

  const expiryHours = cfg.token_expiry_hours ?? 48
  const base = cfg.viewing_date ? new Date(cfg.viewing_date) : new Date()
  const expiresAt = new Date(base.getTime() + expiryHours * 3600 * 1000)

  const { data: signup, error } = await svc
    .from('reelhome_viewing_signups')
    .insert({
      property_id: propertyId,
      buyer_name: name ?? null,
      buyer_email: email ?? null,
      buyer_phone: phone ?? null,
      consent_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select('token')
    .single()
  if (error || !signup) return NextResponse.json({ error: error?.message ?? 'Påmelding feilet' }, { status: 500 })

  return NextResponse.json({ token: signup.token })
}
