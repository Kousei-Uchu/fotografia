/**
 * POST /api/admin/shares
 * Body: { ids: string[], label?, note?, expiresInHours?: number }
 * Returns: { data: { token, url } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createShareToken } from '@/lib/shares'
import type { ApiResponse } from '@/types'

export interface CreateShareResponse {
  token: string
  url: string
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json<ApiResponse<null>>({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { ids?: unknown; label?: unknown; note?: unknown; expiresInHours?: unknown }
  try { body = await request.json() }
  catch { return NextResponse.json<ApiResponse<null>>({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json<ApiResponse<null>>(
      { error: 'ids must be a non-empty array of Drive file IDs' }, { status: 400 }
    )
  }
  if (body.ids.length > 200) {
    return NextResponse.json<ApiResponse<null>>(
      { error: 'Maximum 200 images per share link' }, { status: 400 }
    )
  }

  const ids     = body.ids as string[]
  const label   = typeof body.label === 'string'          ? body.label.slice(0, 120) : undefined
  const note    = typeof body.note  === 'string'          ? body.note.slice(0, 500)  : undefined
  const expHrs  = typeof body.expiresInHours === 'number' ? body.expiresInHours      : 0

  try {
    const token = createShareToken({ ids, label, note, expiresInHours: expHrs })
    const origin = new URL(request.url).origin
    const url = `${origin}/s/${token}`
    return NextResponse.json<ApiResponse<CreateShareResponse>>({
      data: { token, url },
      message: 'Share link created',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create share'
    return NextResponse.json<ApiResponse<null>>({ error: msg }, { status: 500 })
  }
}
