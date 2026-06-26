import { NextRequest, NextResponse } from 'next/server'
import { crawlAllImages } from '@/lib/drive'
import { cache, CACHE_KEYS, TTL } from '@/lib/cache'
import { filterPhotos } from '@/lib/utils'
import type { GalleryFilter, ApiResponse, PaginatedPhotos } from '@/types'

export const revalidate = 0 // Dynamic

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const filter: GalleryFilter = {
    search: searchParams.get('search') ?? undefined,
    tags: searchParams.get('tags')?.split(',').filter(Boolean) ?? [],
    category: searchParams.get('category') ?? undefined,
    folderId: searchParams.get('folderId') ?? undefined,
    page: parseInt(searchParams.get('page') ?? '1'),
    limit: parseInt(searchParams.get('limit') ?? '40'),
  }

  try {
    const folderId = process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID
    if (!folderId) {
      return NextResponse.json<ApiResponse<null>>(
        { error: 'GOOGLE_DRIVE_MASTER_FOLDER_ID not configured' },
        { status: 503 }
      )
    }

    let photos = cache.get(CACHE_KEYS.ALL_PHOTOS)
    if (!photos) {
      photos = await crawlAllImages(folderId)
      cache.set(CACHE_KEYS.ALL_PHOTOS, photos, TTL.MEDIUM)
    }

    const filtered = filterPhotos(
      photos as any[],
      filter.search ?? '',
      filter.tags ?? [],
      filter.category ?? null,
      filter.folderId ?? null
    )

    const page = filter.page ?? 1
    const limit = filter.limit ?? 40
    const start = (page - 1) * limit
    const paginated = filtered.slice(start, start + limit)

    const result: PaginatedPhotos = {
      photos: paginated,
      total: filtered.length,
      page,
      limit,
      hasMore: start + limit < filtered.length,
    }

    return NextResponse.json<ApiResponse<PaginatedPhotos>>({ data: result })
  } catch (err) {
    console.error('Photos API error:', err)
    return NextResponse.json<ApiResponse<null>>(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    )
  }
}
