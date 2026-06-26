import { NextResponse } from 'next/server'
import { buildFolderTree } from '@/lib/drive'
import { cache, CACHE_KEYS, TTL } from '@/lib/cache'
import type { ApiResponse, DriveFolder } from '@/types'

export const revalidate = 0

export async function GET() {
  try {
    const folderId = process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID
    if (!folderId) {
      return NextResponse.json<ApiResponse<null>>(
        { error: 'GOOGLE_DRIVE_MASTER_FOLDER_ID not configured' },
        { status: 503 }
      )
    }

    let tree = cache.get<DriveFolder>(CACHE_KEYS.FOLDER_TREE)
    if (!tree) {
      tree = await buildFolderTree(folderId)
      cache.set(CACHE_KEYS.FOLDER_TREE, tree, TTL.LONG)
    }

    return NextResponse.json<ApiResponse<DriveFolder>>({ data: tree })
  } catch (err) {
    console.error('Folders API error:', err)
    return NextResponse.json<ApiResponse<null>>(
      { error: 'Failed to fetch folders' },
      { status: 500 }
    )
  }
}
