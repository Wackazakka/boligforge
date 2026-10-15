import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getUser } from '../../../../lib/supabase/server'
import { STATUS, type OrdreStatus } from '../../../../lib/produksjon'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Ordrekøen for oss (superadmin = LARS_EMAIL, som backoffice).
const SUPERADMIN_EMAIL = process.env.LARS_EMAIL ?? ''

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function superadmin() {
  const user = await getUser()
  if (!user?.email || !SUPERADMIN_EMAIL || user.email !== SUPERADMIN_EMAIL) return null
  return user
}

export async function GET() {
  if (!(await superadmin())) return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 })
  const client = sb()
  const { data: ordrer, error } = await client.from('produksjonsordrer').select('*').order('created_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const propIds = [...new Set((ordrer ?? []).map(o => o.property_id))]
  const userIds = [...new Set((ordrer ?? []).map(o => o.user_id))]
  const orgIds = [...new Set((ordrer ?? []).map(o => o.organization_id).filter(Boolean))]
  const [props, profiles, orgs, auth] = await Promise.all([
    propIds.length ? client.from('properties').select('id, address, hjem_url, finn_url, images').in('id', propIds) : Promise.resolve({ data: [] }),
    userIds.length ? client.from('profiles').select('id, full_name').in('id', userIds) : Promise.resolve({ data: [] }),
    orgIds.length ? client.from('organizations').select('id, name').in('id', orgIds) : Promise.resolve({ data: [] }),
    client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])
  const propMap = Object.fromEntries((props.data ?? []).map(p => [p.id, p]))
  const navnMap = Object.fromEntries((profiles.data ?? []).map(p => [p.id, p.full_name]))
  const orgMap = Object.fromEntries((orgs.data ?? []).map(o => [o.id, o.name]))
  const epostMap = Object.fromEntries((auth.data?.users ?? []).map(u => [u.id, u.email]))

  return NextResponse.json({
    ordrer: (ordrer ?? []).map(o => ({
      ...o,
      bolig: propMap[o.property_id] ?? null,
      megler: { navn: navnMap[o.user_id] ?? '', epost: epostMap[o.user_id] ?? '' },
      kontor: o.organization_id ? orgMap[o.organization_id] ?? '' : '',
    })),
  })
}

/** Body: { id, status?, notat_intern? } */
export async function PATCH(request: Request) {
  if (!(await superadmin())) return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 })
  const b = (await request.json().catch(() => ({}))) as { id?: string; status?: string; notat_intern?: string }
  if (!b.id) return NextResponse.json({ error: 'Mangler id' }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof b.status === 'string' && b.status in STATUS) patch.status = b.status as OrdreStatus
  if (typeof b.notat_intern === 'string') patch.notat_intern = b.notat_intern.slice(0, 4000)
  const client = sb()
  const { data, error } = await client.from('produksjonsordrer').update(patch).eq('id', b.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // «Til godkjenning»: si fra til megleren at forhåndsvisningen ligger klar på boligsiden.
  if (patch.status === 'til_godkjenning') {
    try {
      const { data: u } = await client.auth.admin.getUserById(data.user_id)
      const { data: p } = await client.from('properties').select('address').eq('id', data.property_id).maybeSingle()
      if (u?.user?.email) {
        await new Resend(process.env.RESEND_API_KEY!).emails.send({
          from: 'ReelHome <noreply@reelhome.ai>',
          to: u.user.email,
          replyTo: 'hei@reelhome.ai',
          subject: `Forhåndsvisning klar — ${p?.address ?? 'boligen din'}`,
          html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f0f0f">
            <p style="font-size:20px;font-weight:700;margin:0 0 12px">Videoen er klar til godkjenning</p>
            <p style="font-size:14px;color:#525252;line-height:1.6">Åpne boligsiden for <strong>${p?.address ?? 'boligen'}</strong> i ReelHome og se gjennom videoen. Svar på denne e-posten med «godkjent», eller med det du vil ha endret — én endringsrunde er inkludert.</p>
            <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/properties/${data.property_id}" style="display:inline-block;background:#0f0f0f;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">Se videoen</a></p>
          </div>`,
        })
      }
    } catch (e) { console.error('[admin/produksjon] e-post feilet:', e) }
  }
  return NextResponse.json({ ordre: data })
}
