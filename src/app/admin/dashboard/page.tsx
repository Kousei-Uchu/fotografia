import type { Metadata } from 'next'
import { crawlAllImages, buildFolderTree } from '@/lib/drive'
import { cache, CACHE_KEYS, TTL } from '@/lib/cache'
import { extractTags, extractCategories } from '@/lib/utils'
import AdminDashboard from '@/components/admin/AdminDashboard'
import type { Photo, DriveFolder, AdminStats } from '@/types'

export const metadata: Metadata = { title: 'Dashboard — Admin' }

async function loadAdminData(): Promise<{
  photos: Photo[]
  folderTree: DriveFolder | null
  stats: AdminStats
}> {
  try {
    const folderId = process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID
    if (!folderId) {
      const photos = getDemoPhotos()
      return { photos, folderTree: null, stats: computeStats(photos) }
    }

    const [photos, folderTree] = await Promise.all([
      crawlAllImages(folderId),
      buildFolderTree(folderId),
    ])

    return { photos, folderTree, stats: computeStats(photos) }
  } catch (err) {
    console.error('Admin data load failed:', err)
    const photos = getDemoPhotos()
    return { photos, folderTree: null, stats: computeStats(photos) }
  }
}

function computeStats(photos: Photo[]): AdminStats {
  return {
    totalPhotos: photos.length,
    totalFolders: new Set(photos.map((p) => p.metadata.folderId).filter(Boolean)).size,
    heroPhotos: photos.filter((p) => p.metadata.isHero).length,
    untaggedPhotos: photos.filter((p) => !p.metadata.tags?.length).length,
    missingAltText: photos.filter((p) => !p.metadata.altText).length,
    privateLocations: photos.filter((p) => p.metadata.locationPrivate).length,
  }
}

function getDemoPhotos(): Photo[] {
  const categories = ['Landscape', 'Portrait', 'Street', 'Architecture']
  return Array.from({ length: 40 }, (_, i) => ({
    id: `demo-${i}`,
    driveId: `demo-${i}`,
    name: `DSC${String(i + 1000).padStart(5, '0')}.jpg`,
    width: [1200, 800, 1000, 1500][i % 4],
    height: [800, 1200, 667, 1000][i % 4],
    aspectRatio: [1.5, 0.667, 1.5, 1.5][i % 4],
    thumbnailUrl: `https://picsum.photos/seed/${i + 300}/400/300`,
    fullUrl: `https://picsum.photos/seed/${i + 300}/1600/1200`,
    metadata: {
      tags: i % 3 === 0 ? [] : ['landscape', 'nature'],
      category: categories[i % 4],
      altText: i % 4 === 0 ? undefined : `Photo ${i + 1} alt text`,
      iso: 100 * (1 + (i % 5)),
      aperture: [1.4, 2.8, 4, 5.6][i % 4],
      shutterSpeed: '1/500s',
      camera: 'Sony A7R V',
      focalLength: [24, 35, 50, 85][i % 4],
      folderId: `folder-${i % 4}`,
      isHero: i < 12,
      heroAct: (Math.floor(i / 4) + 1) as 1 | 2 | 3,
      heroOrder: i % 4,
      locationPrivate: i % 8 === 0,
      location: i % 8 !== 0 ? {
        latitude: -33.86 + i * 0.01,
        longitude: 151.20 + i * 0.01,
        placeName: 'Blue Mountains, NSW',
      } : undefined,
    },
    createdTime: new Date(Date.now() - i * 86400000).toISOString(),
    modifiedTime: new Date().toISOString(),
  }))
}

export default async function AdminDashboardPage() {
  const { photos, folderTree, stats } = await loadAdminData()
  const tags = extractTags(photos)
  const categories = extractCategories(photos)

  return (
    <AdminDashboard
      initialPhotos={photos}
      folderTree={folderTree}
      stats={stats}
      allTags={tags}
      allCategories={categories}
    />
  )
}
