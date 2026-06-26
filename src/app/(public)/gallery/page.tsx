import type { Metadata } from 'next'
import { crawlAllImages, buildFolderTree } from '@/lib/drive'
import { cache, CACHE_KEYS, TTL } from '@/lib/cache'
import { extractTags, extractCategories } from '@/lib/utils'
import GalleryClient from '@/components/gallery/GalleryClient'
import type { Photo, DriveFolder } from '@/types'

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Archive',
  description: 'The complete photographic archive. Searchable and browsable by subject, location, and date.',
}

async function getAllPhotos(): Promise<Photo[]> {
  const cached = cache.get<Photo[]>(CACHE_KEYS.ALL_PHOTOS)
  if (cached) return cached

  try {
    const folderId = process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID
    if (!folderId) return getDemoPhotos()

    const photos = await crawlAllImages(folderId)
    cache.set(CACHE_KEYS.ALL_PHOTOS, photos, TTL.MEDIUM)
    return photos
  } catch (err) {
    console.error('Failed to load photos:', err)
    return getDemoPhotos()
  }
}

async function getFolderTree(): Promise<DriveFolder | null> {
  const cached = cache.get<DriveFolder>(CACHE_KEYS.FOLDER_TREE)
  if (cached) return cached

  try {
    const folderId = process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID
    if (!folderId) return null

    const tree = await buildFolderTree(folderId)
    cache.set(CACHE_KEYS.FOLDER_TREE, tree, TTL.LONG)
    return tree
  } catch {
    return null
  }
}

function getDemoPhotos(): Photo[] {
  const categories = ['Landscape', 'Portrait', 'Street', 'Architecture', 'Nature']
  const tags = [
    ['landscape', 'golden-hour', 'mountains'],
    ['portrait', 'natural-light', 'studio'],
    ['street', 'urban', 'documentary'],
    ['architecture', 'geometry', 'light'],
    ['nature', 'macro', 'forest'],
  ]

  return Array.from({ length: 60 }, (_, i) => {
    const catIdx = i % 5
    return {
      id: `demo-${i}`,
      driveId: `demo-${i}`,
      name: `photo-${i + 1}.jpg`,
      width: [1200, 800, 1000, 1500, 900][i % 5],
      height: [800, 1200, 667, 1000, 600][i % 5],
      aspectRatio: [1.5, 0.667, 1.5, 1.5, 1.5][i % 5],
      thumbnailUrl: `https://picsum.photos/seed/${i + 200}/800/600`,
      fullUrl: `https://picsum.photos/seed/${i + 200}/1600/1200`,
      metadata: {
        tags: tags[catIdx],
        category: categories[catIdx],
        altText: `${categories[catIdx]} photograph number ${i + 1} captured in natural conditions`,
        iso: [100, 200, 400, 800, 1600][i % 5],
        aperture: [1.4, 2.8, 4, 5.6, 8][i % 5],
        shutterSpeed: ['1/1000s', '1/500s', '1/250s', '1/60s', '1/30s'][i % 5],
        camera: ['Sony A7R V', 'Canon R5', 'Nikon Z8'][i % 3],
        focalLength: [24, 35, 50, 85, 135][i % 5],
        folderId: `folder-${catIdx}`,
        folderPath: [categories[catIdx]],
        locationPrivate: i % 7 === 0,
        location: i % 7 !== 0 ? {
          latitude: -33.8688 + (i * 0.01),
          longitude: 151.2093 + (i * 0.01),
          placeName: ['Blue Mountains', 'Sydney', 'Bondi', 'Manly', 'Hunter Valley'][catIdx],
        } : undefined,
      },
      createdTime: new Date(Date.now() - i * 86400000 * 3).toISOString(),
      modifiedTime: new Date().toISOString(),
    }
  })
}

export default async function GalleryPage() {
  const [photos, folderTree] = await Promise.all([
    getAllPhotos(),
    getFolderTree(),
  ])

  const tags = extractTags(photos)
  const categories = extractCategories(photos)

  return (
    <>
      {/* Page header */}
      <section className="pt-32 pb-12 px-6 md:px-10 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="label mb-2">Complete Archive</p>
            <h1
              className="display text-4xl md:text-5xl text-ink"
              style={{ fontFamily: 'Cormorant Garant, serif' }}
            >
              All Work
            </h1>
          </div>
          <p className="text-sm text-muted">
            {photos.length} photographs across {categories.length} categories
          </p>
        </div>
      </section>

      {/* Client-side searchable gallery */}
      <GalleryClient
        photos={photos}
        tags={tags}
        categories={categories}
        folderTree={folderTree}
      />
    </>
  )
}
