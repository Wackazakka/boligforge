// Offentlig (uautentisert) port-config som kjøper-siden leser for å vise riktig
// påmeldingsskjema. Lekker kun det kjøper trenger: om porten er på, hvilken modus,
// visningsdato og adresse. Ingen sensitive felter.
import { NextResponse } from 'next/server'
import { serviceClient } from '../../../../lib/avatar/rag'

export async function GET(request: Request) {
  const propertyId = new URL(request.url).searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'Mangler propertyId' }, { status: 400 })
  const svc = serviceClient()
  const { data: cfg } = await svc
    .from('reelhome_avatar_config')
    .select('enabled, gate_mode, viewing_date')
    .eq('property_id', propertyId)
    .maybeSingle()
  const { data: prop } = await svc.from('properties').select('address').eq('id', propertyId).maybeSingle()
  return NextResponse.json({
    enabled: cfg?.enabled ?? false,
    gate_mode: cfg?.gate_mode ?? 'contact',
    viewing_date: cfg?.viewing_date ?? null,
    address: prop?.address ?? null,
  })
}
