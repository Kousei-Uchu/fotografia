import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cache } from '@/lib/cache'
import type { ApiResponse } from '@/types'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  cache.invalidateAll()

  return NextResponse.json<ApiResponse<{ cleared: boolean }>>({
    data: { cleared: true },
    message: 'All caches cleared',
  })
}
