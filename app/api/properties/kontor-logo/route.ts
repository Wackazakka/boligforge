import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'
import { hentKontorLogo } from '../../../../lib/kontorlogo'

export const dynamic = 'force-dynamic'

// Kontorets logo fra annonsen for én bolig (hjem.no-modellen, 21/10).
// Brukes av produksjonssiden til å vise hvilken logo sluttplakaten får når
// kontoen selv ikke har noen. Selve valget ved generering skjer server-side
// i /api/video/generate, så dette er bare bekreftelsen.
export async function GET(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'Ugyldig id' }, { status: 400 })

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: prop } = await sb.from('properties').select('id, user_id').eq('id', id).maybeSingle()
  if (!prop || (prop as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: 'Boligen tilhører ikke din konto' }, { status: 403 })
  }
  const logo = await hentKontorLogo(sb, id)
  return NextResponse.json({ logoUrl: logo?.logoUrl ?? null, navn: logo?.navn ?? null })
}
