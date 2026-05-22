import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createSupabaseServerClient, getUser } from '../../../lib/supabase/server'

const WORKER_URL = 'http://139.59.212.218:3003'

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { propertyId, script, voiceId, avatarImageUrl, portraitUrl, backgroundImageUrl, propertyImages, segments, outro } = await request.json()

    const useSegments = Array.isArray(segments) && segments.length > 0
    if (!useSegments && (!script || !voiceId || !avatarImageUrl)) {
      return NextResponse.json({ error: 'Mangler script, voiceId eller avatarImageUrl' }, { status: 400 })
    }
    if (useSegments && (!voiceId || !avatarImageUrl)) {
      return NextResponse.json({ error: 'Mangler voiceId eller avatarImageUrl' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()

    // ── Credit check ────────────────────────────────────────────────────────
    let { data: credits } = await supabase
      .from('video_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // Auto-create credits row if missing
    if (!credits) {
      const { data: newCredits } = await supabase
        .from('video_credits')
        .insert({ user_id: user.id })
        .select('*')
        .single()
      credits = newCredits
    }

    if (credits) {
      const available = (credits.included_per_month ?? 3) + (credits.extra_credits ?? 0) - (credits.used_this_month ?? 0)
      if (available <= 0) {
        return NextResponse.json(
          {
            error: 'Ingen videokreditter igjen denne måneden',
            code: 'NO_CREDITS',
            extra_credit_price_nok: credits.plan === 'pro' ? 249 : credits.plan === 'kontor' ? 199 : 299,
          },
          { status: 402 }
        )
      }
    }
    // ── End credit check ────────────────────────────────────────────────────

    const jobId = randomUUID()
    const scriptText = useSegments ? segments.map((s: { text: string }) => s.text).join(' ') : script

    // Create a pending job record
    if (propertyId) {
      supabase.from('production_jobs').insert({
        id: jobId,
        property_id: propertyId,
        script: scriptText,
        status: 'queued',
      }).then(({ error }) => { if (error) console.warn('[video/generate] production_jobs insert:', error.message) })
    }

    // Dispatch to droplet worker
    const workerRes = await fetch(`${WORKER_URL}/jobs/video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(useSegments
        ? { jobId, propertyId, avatarImageUrl, portraitUrl, backgroundImageUrl, voiceId, segments, outro }
        : { jobId, propertyId, avatarImageUrl, scriptText: script, voiceId, imageUrls: (propertyImages || []).slice(0, 8) }
      ),
    })

    if (!workerRes.ok) {
      const err = await workerRes.json().catch(() => ({ error: 'Worker feil' }))
      return NextResponse.json({ error: err.error || 'Worker feilet ved oppstart' }, { status: 500 })
    }

    // ── Increment usage ──────────────────────────────────────────────────────
    if (credits) {
      const newUsed = (credits.used_this_month ?? 0) + 1
      const usedExtra = newUsed > (credits.included_per_month ?? 3)
      await supabase
        .from('video_credits')
        .update({
          used_this_month: newUsed,
          ...(usedExtra && credits.extra_credits > 0
            ? { extra_credits: Math.max(0, credits.extra_credits - 1) }
            : {}),
        })
        .eq('user_id', user.id)
    }
    // ── End increment ────────────────────────────────────────────────────────

    return NextResponse.json({ jobId, status: 'queued' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
