import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../../lib/supabase/server'
import { finishPendingPublications } from '../route'

// Klienten poller hit etter «Publiser naa» naar Instagram svarte «pending».
// Hvert kall sjekker containeren hos Meta EN gang og publiserer hvis den er
// ferdig -- ingen venting paa serversiden, saa vi holder oss godt under
// Netlifys 26-sekundersgrense.

export async function GET(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ids = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  if (ids.length === 0) return NextResponse.json({ error: 'Mangler ids' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Kun egne rader: filteret paa user_id gjoer at ids fra andre brukere
  // hverken fullfoeres eller lekker i svaret under.
  await finishPendingPublications(supabase, { userId: user.id, ids })

  const { data, error } = await supabase
    .from('reelhome_publications')
    .select('id, page_name, status, error')
    .eq('user_id', user.id)
    .in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ results: data ?? [] })
}
