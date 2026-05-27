// Netlify scheduled function — runs every 5 minutes and triggers the Next.js
// cron route handler, which publishes any social posts that are now due.
export default async () => {
  const base = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://reelhome.ai'
  const secret = process.env.CRON_SECRET

  try {
    const res = await fetch(`${base}/api/cron/publish-scheduled`, {
      method: 'POST',
      headers: secret ? { 'x-cron-secret': secret } : {},
    })
    const body = await res.json().catch(() => ({}))
    console.log('[scheduled:publish] result:', JSON.stringify(body))
  } catch (err) {
    console.error('[scheduled:publish] error:', err)
  }

  return new Response('ok')
}

export const config = {
  schedule: '*/5 * * * *',
}
