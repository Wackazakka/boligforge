'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../lib/supabase/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function chooseTemplateAvatarAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const user = await getUser()
  if (!user) return 'Ikke innlogget'

  const voiceId    = formData.get('voice_id')?.toString() ?? ''
  const avatarName = formData.get('avatar_name')?.toString() ?? ''
  const portraitUrl = formData.get('portrait_url')?.toString() ?? ''

  const userFullName = user.user_metadata?.full_name ?? ''

  await supabase.from('agent_profiles').upsert(
    {
      user_id:          user.id,
      name:             avatarName,           // Presentatørnavn i video = avatar-navnet (Ingrid, Sofia, osv.)
      title:            'Eiendomsmegler',
      email:            user.email ?? '',
      default_voice_id: voiceId,
      cloned_voice_id:  voiceId,
      portrait_url:     portraitUrl || null,
      tone_of_voice:    'Varm og profesjonell. Snakker klart og tydelig om boligens fordeler.',
      default_emotion:  'neutral',
    },
    { onConflict: 'user_id' }
  )

  console.log(`[onboarding] ${userFullName} valgte malmegler ${avatarName}`)
  redirect('/dashboard')
}
