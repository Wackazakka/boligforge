import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'
import { resolveLogo } from '../../../../lib/org-branding'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Har brukeren laget en video foer? Statuskortet paa profilen sa «Lag din
  // FOERSTE video» ogsaa til folk som hadde laget flere. Head-count, saa det
  // koster ingen rader — og det henger paa et kall profilsiden gjoer uansett.
  const { count: videoCount } = await supabase
    .from('property_videos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('video_url', 'is', null)
    .neq('video_url', '')
  const hasVideo = (videoCount ?? 0) > 0
  if (!data) {
    // Fersk bruker uten meglerprofil: forhåndsutfyll fra kontoen så skjemaet
    // ikke spør om ting vi allerede vet. Brukeren kan overstyre fritt —
    // meglerprofilen (presentasjonskortet i videoer/visninger) kan avvike
    // fra innloggingskontoen med vilje.
    return NextResponse.json({
      name:  (user.user_metadata?.full_name as string | undefined) ?? '',
      email: user.email ?? '',
      has_video: hasVideo,
    })
  }
  const { default_voice_id, cloned_voice_id, ...rest } = data
  // Kjeden/meglerhuset kan ha satt en offisiell logo som overstyrer den
  // personlige — videogenereringen leser logo_url herfra, så den løses her.
  const logo = await resolveLogo(user.id, rest.logo_url)
  return NextResponse.json({
    ...rest,
    logo_url: logo.url,
    logo_locked: logo.locked,
    logo_source: logo.source,
    voice_id: default_voice_id,
    cloned_voice_id,
    has_video: hasVideo,
  })
}
