import type { SupabaseClient } from '@supabase/supabase-js'

// Kilden til sannhet for videokvote er `video_credits` (per bruker) — det er
// tabellen /api/video/generate håndhever og dashbordet viser. Den historiske
// `credits`-tabellen (per org) leses ikke av noe og skal ikke skrives til.
//
// Månedlig nullstilling av used_this_month gjøres av pg_cron-jobben
// `reset-video-credits` i Supabase — se supabase/migrations/20260806_video_credits_reset_cron.sql.
export const VIDEOS_BY_PLAN: Record<string, number> = {
  starter: 3,
  pro: 10,
  office: 7, // per megler (Stripe quantity = antall seter)
  kontor: 7,
}

// Kvoten en bruker uten aktiv betalende plan får (samme som DB-defaulten).
export const FREE_VIDEOS_PER_MONTH = 3

// Sett plan + månedskvote for gitte brukere. Rører ikke used_this_month eller
// extra_credits: PostgREST-upsert oppdaterer bare kolonnene i payloaden ved
// konflikt, og nye rader får tabellens defaults for resten.
export async function setPlanForUsers(
  supabase: SupabaseClient,
  userIds: string[],
  plan: string,
  includedPerMonth: number,
) {
  if (!userIds.length) return null
  const rows = userIds.map((user_id) => ({ user_id, plan, included_per_month: includedPerMonth }))
  const { error } = await supabase
    .from('video_credits')
    .upsert(rows, { onConflict: 'user_id' })
  return error
}

export async function orgMemberIds(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
  return (data ?? []).map((m) => m.user_id as string)
}
