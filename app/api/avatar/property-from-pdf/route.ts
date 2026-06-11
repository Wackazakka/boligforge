// «Salgsoppgaven ER eiendommen»: oppretter en eiendom direkte fra en opplastet
// salgsoppgave-PDF. Fakta (adresse, pris, areal …) ekstraheres automatisk av
// process-ruten når kunnskapsbasen bygges. (Lars' modell, 2026-06-11 — slipper
// Finn-lenke-steget for avatar-bruk.)

import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabase/server'
import { serviceClient } from '../../../../lib/avatar/rag'

export const runtime = 'nodejs'

export const PENDING_ADDRESS = '⏳ Behandler salgsoppgave…'

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { filename } = await request.json()
  if (!filename) return NextResponse.json({ error: 'Mangler filename' }, { status: 400 })

  const client = serviceClient()

  // 1) Eiendoms-stubb — fylles med ekte fakta av process-ruten
  const { data: property, error: propErr } = await client
    .from('properties')
    .insert({ user_id: user.id, address: PENDING_ADDRESS, title: filename })
    .select('id')
    .single()
  if (propErr) return NextResponse.json({ error: propErr.message }, { status: 500 })

  // 2) Dokumentrad + signert opplastings-URL (samme flyt som /api/avatar/documents)
  const { data: doc, error: docErr } = await client
    .from('reelhome_avatar_documents')
    .insert({ property_id: property.id, user_id: user.id, kind: 'prospekt', filename, storage_path: '' })
    .select('id')
    .single()
  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 })

  const storagePath = `${property.id}/${doc.id}.pdf`
  await client.from('reelhome_avatar_documents').update({ storage_path: storagePath }).eq('id', doc.id)

  const { data: signed, error: signErr } = await client.storage.from('avatar-docs').createSignedUploadUrl(storagePath)
  if (signErr) return NextResponse.json({ error: signErr.message }, { status: 500 })

  return NextResponse.json({
    propertyId: property.id,
    documentId: doc.id,
    upload: { url: signed.signedUrl, token: signed.token, path: signed.path },
  })
}
