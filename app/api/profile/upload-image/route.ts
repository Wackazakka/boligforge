import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient, getUser } from '../../../../lib/supabase/server'
import { orgAdminOf } from '../../../../lib/org-branding'

function getR2() {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

export async function POST(request: Request) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file || !type) {
      return NextResponse.json({ error: 'Missing file or type' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || 'jpg'
    // Tidsstemplet nøkkel: fast nøkkel (agent/{id}/logo.png) gjorde at ny opplasting
    // beholdt samme URL — nettleser/CDN-cache viste den gamle fila «for alltid».
    // Fersk URL per opplasting = umiddelbar oppdatering overalt.
    const key = `boligforge/agent/${user.id}/${type}_${Date.now()}.${ext}`
    const bucket = process.env.R2_BUCKET_NAME || 'contentforge-assets'

    await getR2().send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: file.type })
    )

    const url = `${process.env.R2_PUBLIC_URL}/${key}`
    const updateField = type === 'logo' ? { logo_url: url } : { portrait_url: url }

    const supabase = await createSupabaseServerClient()
    await supabase.from('agent_profiles').upsert(
      { user_id: user.id, ...updateField },
      { onConflict: 'user_id' }
    )

    // Logo lastet opp av en byråsjef/kjedeadmin blir organisasjonens OFFISIELLE
    // logo — meglerne under arver den og kan ikke overstyre. Meglere i en kjede
    // skal ha et uniformt uttrykk (Lars 8/8).
    let orgLogoSet = false
    if (type === 'logo') {
      const orgId = await orgAdminOf(user.id)
      if (orgId) {
        const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } })
        const { error } = await svc.from('organizations').update({ logo_url: url }).eq('id', orgId)
        if (error) console.error('[upload-image] kunne ikke sette org-logo:', error)
        else orgLogoSet = true
      }
    }

    return NextResponse.json({ url, orgLogoSet })
  } catch (err: unknown) {
    console.error('[upload-image]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
