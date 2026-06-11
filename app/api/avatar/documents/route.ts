// Avatar-kunnskapsbase: dokumenthåndtering (Fase 1, Spor A2).
// POST registrerer dokumentet og returnerer en SIGNERT opplastings-URL —
// klienten laster PDF-en direkte til Supabase Storage (omgår Netlifys
// ~4,5 MB Lambda-grense; prospekter/tilstandsrapporter er ofte større).

import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabase/server'
import { serviceClient } from '../../../../lib/avatar/rag'

export const runtime = 'nodejs'

const BUCKET = 'avatar-docs'
const KINDS = ['prospekt', 'tilstandsrapport', 'vedlegg', 'energiattest', 'annet']

async function assertOwnsProperty(client: ReturnType<typeof serviceClient>, userId: string, propertyId: string) {
  const { data } = await client.from('properties').select('id').eq('id', propertyId).eq('user_id', userId).maybeSingle()
  return !!data
}

// ── POST — registrer dokument + signert opplastings-URL ──────────────────────
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { propertyId, kind, filename } = await request.json()
  if (!propertyId || !filename) return NextResponse.json({ error: 'Mangler propertyId/filename' }, { status: 400 })
  if (!KINDS.includes(kind)) return NextResponse.json({ error: `kind må være en av: ${KINDS.join(', ')}` }, { status: 400 })

  const client = serviceClient()
  if (!(await assertOwnsProperty(client, user.id, propertyId))) {
    return NextResponse.json({ error: 'Eiendommen tilhører ikke deg' }, { status: 403 })
  }

  const { data: doc, error } = await client
    .from('reelhome_avatar_documents')
    .insert({ property_id: propertyId, user_id: user.id, kind, filename, storage_path: '' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const storagePath = `${propertyId}/${doc.id}.pdf`
  await client.from('reelhome_avatar_documents').update({ storage_path: storagePath }).eq('id', doc.id)

  const { data: signed, error: signErr } = await client.storage.from(BUCKET).createSignedUploadUrl(storagePath)
  if (signErr) return NextResponse.json({ error: `Signert URL feilet: ${signErr.message}` }, { status: 500 })

  return NextResponse.json({
    document: { ...doc, storage_path: storagePath },
    upload: { url: signed.signedUrl, token: signed.token, path: signed.path },
  })
}

// ── GET ?propertyId= — list dokumenter m/ status ──────────────────────────────
export async function GET(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const propertyId = new URL(request.url).searchParams.get('propertyId')
  if (!propertyId) return NextResponse.json({ error: 'Mangler propertyId' }, { status: 400 })

  const client = serviceClient()
  if (!(await assertOwnsProperty(client, user.id, propertyId))) {
    return NextResponse.json({ error: 'Eiendommen tilhører ikke deg' }, { status: 403 })
  }

  const { data, error } = await client
    .from('reelhome_avatar_documents')
    .select('id, kind, filename, status, error, pages, created_at')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ documents: data })
}

// ── DELETE — fjern dokument + chunks + fil ────────────────────────────────────
export async function DELETE(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { documentId } = await request.json()
  if (!documentId) return NextResponse.json({ error: 'Mangler documentId' }, { status: 400 })

  const client = serviceClient()
  const { data: doc } = await client
    .from('reelhome_avatar_documents')
    .select('id, user_id, storage_path')
    .eq('id', documentId)
    .maybeSingle()
  if (!doc || doc.user_id !== user.id) return NextResponse.json({ error: 'Ikke funnet' }, { status: 404 })

  if (doc.storage_path) await client.storage.from(BUCKET).remove([doc.storage_path])
  // chunks slettes via on delete cascade
  const { error } = await client.from('reelhome_avatar_documents').delete().eq('id', documentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
