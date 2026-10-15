import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { fetchHjemListing, maskEmail } from '../../../../lib/hjem'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Steg 2 i Hjem.no-inngangen (offentlig): send innloggingslenke til e-posten
// som står på valgt megler i annonsen. Annonsen slås opp på nytt her, så
// klienten aldri bestemmer mottakeren. Ny bruker → invite-lenke med
// hjem-metadata (kontor, logo, megler) som /api/auth/accept-invite bruker til
// å opprette kontoret og profilen. Eksisterende bruker → magic link, og
// metadataen oppdateres så samme rute kan sende videre til annonsen.
//
// Begrensning: maks 3 lenker per e-post per time (hjem_inngang_logg).

const MAKS_PER_TIME = 3
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://reelhome.ai'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { url?: unknown; contactIndex?: unknown }
  const url = typeof body.url === 'string' ? body.url : ''
  const idx = typeof body.contactIndex === 'number' ? body.contactIndex : -1

  const listing = await fetchHjemListing(url).catch(() => null)
  if (!listing) return NextResponse.json({ error: 'Fant ikke annonsen' }, { status: 404 })
  const contact = listing.contacts[idx]
  if (!contact?.email) return NextResponse.json({ error: 'Denne megleren har ingen e-postadresse i annonsen' }, { status: 400 })

  // Lokal testing uten å sende e-post til ekte meglere: HJEM_INNGANG_TESTMOTTAKER
  // i .env.local overstyrer mottakeren. Aldri satt i Netlify.
  const testmottaker = process.env.NODE_ENV !== 'production' ? process.env.HJEM_INNGANG_TESTMOTTAKER : undefined
  const email = testmottaker || contact.email

  const sb = admin()

  const { count } = await sb
    .from('hjem_inngang_logg')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
  if ((count ?? 0) >= MAKS_PER_TIME) {
    return NextResponse.json({ error: 'Vi har alt sendt flere lenker til denne adressen den siste timen. Sjekk innboksen, også søppelpost.' }, { status: 429 })
  }

  const hjem = {
    listing_url: listing.url,
    listing_hash: listing.hash,
    agency_id: listing.agency?.externalId ?? null,
    agency_name: listing.agency?.name ?? null,
    agency_parent_id: listing.agency?.parentId ?? null,
    agency_logo_url: listing.agency?.logoUrl ?? null,
    name: contact.name,
    phone: contact.phone,
    position: contact.position,
    image: contact.image,
    done: false,
  }

  const redirectTo = `${SITE}/auth/accept-invite`
  let actionLink: string | null = null
  let userExists = false

  // Ny bruker: invite med metadata. Finnes brukeren, feiler invite → magic link
  // og metadataen oppdateres på brukeren.
  const invite = await sb.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo, data: { full_name: contact.name, hjem } },
  })
  if (!invite.error && invite.data?.properties?.action_link) {
    actionLink = invite.data.properties.action_link
  } else {
    userExists = true
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const eksisterende = list?.users.find(u => u.email?.toLowerCase() === email)
    if (eksisterende) {
      await sb.auth.admin.updateUserById(eksisterende.id, { user_metadata: { ...eksisterende.user_metadata, hjem } })
    }
    const magic = await sb.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })
    if (magic.error || !magic.data?.properties?.action_link) {
      console.error('[hjem/send-lenke] generateLink feilet:', invite.error?.message, magic.error?.message)
      return NextResponse.json({ error: 'Kunne ikke lage innloggingslenke. Prøv igjen om litt.' }, { status: 500 })
    }
    actionLink = magic.data.properties.action_link
  }

  await sb.from('hjem_inngang_logg').insert({ listing_hash: listing.hash, email, user_exists: userExists })

  const fornavn = contact.name.split(' ')[0] || 'der'
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f0f0f">
      <p style="font-size:22px;font-weight:700;margin:0 0 12px">Hei, ${fornavn}!</p>
      <p style="font-size:15px;line-height:1.6;color:#525252;margin:0 0 20px">
        Her er lenken din til ReelHome for <strong>${listing.address || listing.title}</strong>.
        ${userExists ? 'Den logger deg inn og henter annonsen.' : `Kontoen din hos ${listing.agency?.name ?? 'kontoret'} står klar med logo og profil fra annonsen — ett klikk, så er du i gang.`}
      </p>
      <p style="margin:0 0 24px">
        <a href="${actionLink}" style="display:inline-block;background:#0f0f0f;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">Åpne ReelHome</a>
      </p>
      <p style="font-size:12px;color:#737373;line-height:1.6;margin:0">
        Lenken er personlig og virker én gang. Var det ikke du som ba om den, kan du se bort fra denne e-posten.
        Spørsmål? Svar på denne e-posten eller skriv til hei@reelhome.ai.
      </p>
    </div>`

  const resend = new Resend(process.env.RESEND_API_KEY!)
  const { error: sendError } = await resend.emails.send({
    from: 'ReelHome <noreply@reelhome.ai>',
    to: email,
    replyTo: 'hei@reelhome.ai',
    subject: `Lenken din til ReelHome — ${listing.address || listing.title}`,
    html,
  })
  if (sendError) {
    console.error('[hjem/send-lenke] Resend-feil:', sendError)
    return NextResponse.json({ error: 'Kunne ikke sende e-posten. Prøv igjen om litt.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    emailMasked: maskEmail(email),
    userExists,
    // Kun lokalt med testmottaker: lenken returneres så flyten kan testes uten innboks.
    ...(testmottaker ? { testLink: actionLink } : {}),
  })
}
