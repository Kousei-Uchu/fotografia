import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Photo, MasonryColumn } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Masonry Layout ───────────────────────────────────────────────────────────

export function buildMasonryColumns(
  photos: Photo[],
  columnCount: number
): MasonryColumn[] {
  const columns: MasonryColumn[] = Array.from({ length: columnCount }, (_, i) => ({
    photos: [],
    columnIndex: i,
  }))

  // Track total height per column for balanced distribution
  const columnHeights = new Array(columnCount).fill(0)

  photos.forEach((photo) => {
    // Find shortest column
    const shortestIndex = columnHeights.indexOf(Math.min(...columnHeights))
    columns[shortestIndex].photos.push(photo)
    columnHeights[shortestIndex] += 1 / photo.aspectRatio
  })

  return columns
}

// ─── Alt Text Generation ──────────────────────────────────────────────────────

export function generateAltText(photo: Photo): string {
  if (photo.metadata.altText) return photo.metadata.altText

  const parts: string[] = []

  if (photo.metadata.title) {
    parts.push(photo.metadata.title)
  } else {
    // Generate from available metadata
    const camera = photo.metadata.camera ? `captured on ${photo.metadata.camera}` : ''
    const location = photo.metadata.location?.placeName
      ? `in ${photo.metadata.location.placeName}`
      : ''
    const category = photo.metadata.category ? `${photo.metadata.category} photograph` : 'photograph'

    parts.push([category, camera, location].filter(Boolean).join(' '))
  }

  // Aim for 60–90 characters
  const text = parts.join('. ')
  if (text.length < 60) {
    return `${text} — fine art photography`
  }
  return text.slice(0, 90)
}

// ─── Format Helpers ───────────────────────────────────────────────────────────

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateShort(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
  })
}

// ─── Search / Filter ──────────────────────────────────────────────────────────

export function filterPhotos(
  photos: Photo[],
  search: string,
  tags: string[],
  category: string | null,
  folderId: string | null
): Photo[] {
  return photos.filter((photo) => {
    const searchLower = search.toLowerCase()

    if (search) {
      const searchable = [
        photo.name,
        photo.metadata.title ?? '',
        photo.metadata.altText ?? '',
        photo.metadata.category ?? '',
        ...(photo.metadata.tags ?? []),
        photo.metadata.location?.placeName ?? '',
      ]
        .join(' ')
        .toLowerCase()

      if (!searchable.includes(searchLower)) return false
    }

    if (tags.length > 0) {
      const photoTags = photo.metadata.tags ?? []
      if (!tags.some((t) => photoTags.includes(t))) return false
    }

    if (category && photo.metadata.category !== category) return false

    if (folderId && photo.metadata.folderId !== folderId) return false

    return true
  })
}

// ─── Collect unique tags/categories ──────────────────────────────────────────

export function extractTags(photos: Photo[]): string[] {
  const tagSet = new Set<string>()
  photos.forEach((p) => p.metadata.tags?.forEach((t) => tagSet.add(t)))
  return Array.from(tagSet).sort()
}

export function extractCategories(photos: Photo[]): string[] {
  const catSet = new Set<string>()
  photos.forEach((p) => {
    if (p.metadata.category) catSet.add(p.metadata.category)
  })
  return Array.from(catSet).sort()
}

// ─── Hero Gallery ─────────────────────────────────────────────────────────────

export function getHeroPhotos(photos: Photo[]): Photo[] {
  return photos
    .filter((p) => p.metadata.isHero)
    .sort((a, b) => {
      const actDiff = (a.metadata.heroAct ?? 1) - (b.metadata.heroAct ?? 1)
      if (actDiff !== 0) return actDiff
      return (a.metadata.heroOrder ?? 0) - (b.metadata.heroOrder ?? 0)
    })
    .slice(0, 30)
}

// ─── Debounce ─────────────────────────────────────────────────────────────────

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
