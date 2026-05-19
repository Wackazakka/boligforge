import { NextRequest, NextResponse } from 'next/server'

const FAL_KEY = process.env.FAL_KEY!

async function handler(req: NextRequest) {
  const url = new URL(req.url)
  // Strip /api/fal/proxy prefix and forward to fal queue
  const falPath = url.pathname.replace(/^\/api\/fal\/proxy/, '')
  const falUrl = `https://queue.fal.run${falPath}${url.search}`

  const body = req.method !== 'GET' ? await req.text() : undefined

  const res = await fetch(falUrl, {
    method: req.method,
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body,
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export const GET = handler
export const POST = handler
export const PUT = handler
