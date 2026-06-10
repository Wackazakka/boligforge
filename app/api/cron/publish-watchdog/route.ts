import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

// Vakt for planlagt publisering. Oppdager om automatisk publisering har stoppet
// (planlagte poster som er forfalt for lenge uten å bli publisert) og varsler på e-post.
// Trigges uavhengig (GitHub Action), så den fanger også om Netlify-cron-en dør.

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const OVERDUE_MINUTES = 15 // cron kjører hvert 5. min; >15 min forsinket = noe er galt

async function run(request: Request) {
  // Valgfri secret-gate (samme mønster som cron-ruten)
  const secret = process.env.CRON_SECRET
  if (secret) {
    const provided =
      request.headers.get('x-cron-secret') ||
      new URL(request.url).searchParams.get('secret')
    if (provided && provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = getServiceClient()
  const cutoff = new Date(Date.now() - OVERDUE_MINUTES * 60 * 1000).toISOString()

  // Forfalte ventende poster som ennå ikke er varslet (error_message er null).
  const { data: stuck, error } = await supabase
    .from('reelhome_scheduled_publications')
    .select('id, user_id, scheduled_at, caption')
    .eq('status', 'pending')
    .lt('scheduled_at', cutoff)
    .is('error_message', null)
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!stuck || stuck.length === 0) return NextResponse.json({ ok: true, stuck: 0 })

  // Send e-postvarsel.
  const to = process.env.LARS_EMAIL
  if (to && process.env.RESEND_API_KEY) {
    const rows = stuck
      .map(
        s =>
          `• «${s.caption ?? '(uten tekst)'}» — planlagt ${new Date(
            s.scheduled_at,
          ).toLocaleString('nb-NO')}`,
      )
      .join('<br>')
    try {
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: 'ReelHome <noreply@reelhome.ai>',
        to,
        subject: `⚠️ ReelHome: ${stuck.length} planlagt video(er) ble ikke publisert`,
        html:
          `<p>Disse planlagte postene er forfalt for mer enn ${OVERDUE_MINUTES} minutter siden ` +
          `uten å bli publisert — det tyder på at automatisk publisering har stoppet:</p>` +
          `<p>${rows}</p>` +
          `<p>Sjekk publiseringskalenderen i ReelHome.</p>`,
      })
    } catch (e) {
      console.error('[watchdog] e-post feilet:', e)
    }
  }

  // Marker som varslet (behold 'pending' så de fortsatt kan publiseres om cron-en kommer
  // tilbake) — hindrer gjentatte varsler for samme post.
  await supabase
    .from('reelhome_scheduled_publications')
    .update({ error_message: `⚠️ Forsinket — varsel sendt ${new Date().toISOString()}` })
    .in(
      'id',
      stuck.map(s => s.id),
    )

  console.warn(`[watchdog] ${stuck.length} forsinket(e) planlagt(e) post(er) — varsel sendt`)
  return NextResponse.json({ ok: true, stuck: stuck.length, alerted: true })
}

export async function POST(request: Request) {
  return run(request)
}
export async function GET(request: Request) {
  return run(request)
}
