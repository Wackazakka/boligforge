import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'

const PLAN_DEFAULTS: Record<string, { included_per_month: number; extra_credit_price_nok: number }> = {
  starter: { included_per_month: 3, extra_credit_price_nok: 299 },
  pro: { included_per_month: 10, extra_credit_price_nok: 249 },
  kontor: { included_per_month: 7, extra_credit_price_nok: 199 },
  trial: { included_per_month: 3, extra_credit_price_nok: 299 },
}

export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createSupabaseServerClient()

    let { data: credits, error } = await supabase
      .from('video_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Auto-create row if first time
    if (!credits) {
      const { data: newCredits, error: insertError } = await supabase
        .from('video_credits')
        .insert({ user_id: user.id })
        .select('*')
        .single()

      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
      credits = newCredits
    }

    const plan = credits.plan ?? 'starter'
    const planDefaults = PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS.starter
    const available = credits.included_per_month + credits.extra_credits - credits.used_this_month
    const resetAt = credits.reset_at

    return NextResponse.json({
      plan,
      used_this_month: credits.used_this_month,
      included_per_month: credits.included_per_month ?? planDefaults.included_per_month,
      extra_credits: credits.extra_credits,
      available: Math.max(0, available),
      extra_credit_price_nok: planDefaults.extra_credit_price_nok,
      reset_at: resetAt,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
