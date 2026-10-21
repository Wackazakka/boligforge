import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '../../../../lib/supabase/server'
import { hentFakturaunderlag, tilCsv } from '../../../../lib/fakturaunderlag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Fakturaunderlag for administrators organisasjon (21/10, Hjem.no-modellen).
// GET ?maaned=YYYY-MM            → JSON (oversikt + rader) til Team-siden
// GET ?maaned=YYYY-MM&format=csv → CSV-nedlasting (semikolon, UTF-8 m/ BOM)
export async function GET(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: membership } = await sb
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  const m = membership as { organization_id?: string; role?: string } | null
  if (!m?.organization_id || m.role !== 'admin') {
    return NextResponse.json({ error: 'Kun admin kan se fakturaunderlaget' }, { status: 403 })
  }

  const url = new URL(request.url)
  const maaned = url.searchParams.get('maaned')
  const format = url.searchParams.get('format')

  try {
    const underlag = await hentFakturaunderlag(sb, m.organization_id, maaned)
    if (format === 'csv') {
      const slug = (underlag.organisasjon.navn || 'organisasjon').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      return new NextResponse(tilCsv(underlag), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="fakturaunderlag-${slug}-${underlag.maaned}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }
    return NextResponse.json(underlag)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
