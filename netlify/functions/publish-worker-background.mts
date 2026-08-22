// Netlify Background Function — publiserer Instagram Reels asynkront.
//
// BAKGRUNN: Instagram krever at vi poller Reels-containeren til Meta er ferdig
// med prosesseringen (kan ta lengre tid enn Netlifys ~26s serverless-tak) FØR
// media_publish. Kjørt inline i en vanlig request kappes funksjonen → klienten
// fikk en HTML-timeoutside, og historikk-raden ble aldri logget.
//
// `-background`-suffikset i filnavnet gjør dette til en Background Function:
// den svarer 202 umiddelbart og kan kjøre i opptil 15 minutter. Dispatcheren
// (lib/social/publish-core.ts → dispatchInstagramJobs) fyrer den av og venter
// kun på 202-en; selve pollingen + publiseringen + logging skjer her.
import { runInstagramJob, type InstagramJob } from '../../lib/social/publish-core'

export default async (req: Request) => {
  // Auth: samme delte hemmelighet som cron-en. Tillat kall uten header hvis
  // CRON_SECRET er usatt (likt cron-stien), men avvis feil header.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const provided = req.headers.get('x-worker-secret')
    if (provided !== secret) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  let jobs: InstagramJob[] = []
  try {
    const body = await req.json()
    jobs = Array.isArray(body?.jobs) ? body.jobs : []
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  console.log(`[worker] Behandler ${jobs.length} Instagram-jobb(er)`)
  for (const job of jobs) {
    // runInstagramJob fanger egne feil og skriver en 'failed'-rad — én jobb
    // som feiler skal ikke stoppe de andre.
    try {
      await runInstagramJob(job)
    } catch (err) {
      console.error('[worker] uventet feil i jobb:', err)
    }
  }
  console.log('[worker] Ferdig')

  return new Response('ok')
}
