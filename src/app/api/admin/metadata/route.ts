import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { google } from 'googleapis'
import { authOptions } from '@/lib/auth'
import { cache, CACHE_KEYS } from '@/lib/cache'
import type { ApiResponse, MetadataUpdate } from '@/types'

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json<ApiResponse<null>>(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = (await request.json()) as MetadataUpdate
    const { photoId, metadata } = body

    if (!photoId) {
      return NextResponse.json<ApiResponse<null>>(
        { error: 'photoId required' },
        { status: 400 }
      )
    }

    // Skip Drive update for demo photos
    if (photoId.startsWith('demo-')) {
      return NextResponse.json<ApiResponse<{ updated: boolean }>>({
        data: { updated: true },
        message: 'Demo mode, no Drive update performed',
      })
    }

    // Build appProperties from metadata
    const appProperties: Record<string, string> = {}

    if (metadata.tags !== undefined)
      appProperties.tags = JSON.stringify(metadata.tags)
    if (metadata.category !== undefined)
      appProperties.category = metadata.category
    if (metadata.altText !== undefined)
      appProperties.altText = metadata.altText
    if (metadata.title !== undefined)
      appProperties.title = metadata.title
    if (metadata.isHero !== undefined)
      appProperties.isHero = String(metadata.isHero)
    if (metadata.heroAct !== undefined)
      appProperties.heroAct = String(metadata.heroAct)
    if (metadata.heroOrder !== undefined)
      appProperties.heroOrder = String(metadata.heroOrder)
    if (metadata.locationPrivate !== undefined)
      appProperties.locationPrivate = String(metadata.locationPrivate)
    if (metadata.location?.placeName !== undefined)
      appProperties.placeName = metadata.location.placeName
    if (metadata.lens !== undefined)
      appProperties.lens = metadata.lens
    if (metadata.camera !== undefined)
      appProperties.camera = metadata.camera
    if (metadata.shutterSpeed !== undefined)
      appProperties.shutterSpeed = metadata.shutterSpeed

    // Update via Drive API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    })

    const drive = google.drive({ version: 'v3', auth })

    await drive.files.update({
      fileId: photoId,
      requestBody: { appProperties },
    })

    // Invalidate cache
    cache.invalidate(CACHE_KEYS.ALL_PHOTOS)
    cache.invalidate(CACHE_KEYS.HERO_PHOTOS)

    return NextResponse.json<ApiResponse<{ updated: boolean }>>({
      data: { updated: true },
      message: 'Metadata saved',
    })
  } catch (err) {
    console.error('Metadata update error:', err)
    return NextResponse.json<ApiResponse<null>>(
      { error: 'Failed to save metadata' },
      { status: 500 }
    )
  }
}
