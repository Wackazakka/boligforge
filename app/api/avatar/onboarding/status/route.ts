// Status for video-avatar-onboarding: none (ikke startet) / pending (video lastet
// opp, venter på avatar) / ready (liveavatar_avatar_id satt → aktiv).

import { NextResponse } from 'next/server'
import { getUser } from '../../../../../lib/supabase/server'
import { serviceClient } from '../../../../../lib/avatar/rag'

export const runtime = 'nodejs'
const BUCKET = 'liveavatar-onboarding'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = serviceClient()
  const { data: profile } = await client
    .from('agent_profiles').select('liveavatar_avatar_id, liveavatar_voice_id').eq('user_id', user.id).maybeSingle()
  const { data: files } = await client.storage.from(BUCKET).list(user.id)

  const hasVideo = !!files?.some(f => f.name.startsWith('avatar-video'))
  const hasAvatar = !!profile?.liveavatar_avatar_id
  const status = hasAvatar ? 'ready' : hasVideo ? 'pending' : 'none'

  return NextResponse.json({ status, hasVideo, hasAvatar, hasVoice: !!profile?.liveavatar_voice_id })
}
