import { NextRequest, NextResponse } from 'next/server'

const FAL_KEY = process.env.FAL_KEY!
const TARGET_URL_HEADER = 'x-fal-target-url'

async function handler(req: NextRequest) {
  // fal client sends the real target URL in x-fal-target-url header
  const targetUrl = req.headers.get(TARGET_URL_HEADER)
  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing x-fal-target-url header' }, { status: 400 })
  }

  const body = req.method !== 'GET' ? await req.text() : undefined

  const res = await fetch(targetUrl, {
    method: req.method,
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body,
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export const GET = handler
export const POST = handler
export const PUT = handler
