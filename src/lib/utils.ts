import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Photo, MasonryColumn } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Masonry Layout ───────────────────────────────────────────────────────────
//
// Algorithm overview:
//
//   Phase 1 — Greedy O(n): For all photos except the last LOOKAHEAD_SIZE,
//   assign each image to whichever column is currently shortest. This is the
//   standard Pinterest/Unsplash approach and runs in O(n · C) where C is the
//   (small, fixed) column count.
//
//   Phase 2 — Look-ahead optimisation: For the final LOOKAHEAD_SIZE images,
//   enumerate every possible assignment permutation and pick the one that
//   minimises (maxHeight − minHeight) across all columns — i.e. the flattest
//   possible ending. Permutation count is C^k where k ≤ LOOKAHEAD_SIZE and
//   C ≤ ~5, so this is at most 5^5 = 3,125 iterations — effectively O(1).
//
//   Tie-breaking: When two permutations are equally balanced, prefer the one
//   that places the last image in the centre column (or whichever column is
//   deepest below the current maximum, producing the most gap-filling result).
//   This avoids the common anti-pattern of all tail images bunching left.

/** Number of tail images to optimise. C^k must stay tractable (≤ 5^5 = 3125). */
const LOOKAHEAD_SIZE = 5

/**
 * Returns a normalised height estimate for one photo in a column of width 1.
 * GAP approximates the CSS row-gap between images so tall portrait stacks
 * aren't underweighted relative to landscape stacks.
 */
const GAP = 0.04 // ~4% of column width — mirrors the 6px gap at ~150px col width

function imageHeight(photo: Photo): number {
  return 1 / photo.aspectRatio + GAP
}

/**
 * Greedy shortest-column insertion.
 * Mutates `heights` in place; returns the chosen column index.
 * On a tie between equal-height columns, the leftmost wins (stable ordering).
 */
function greedyInsert(heights: number[], photo: Photo): number {
  let best = 0
  for (let i = 1; i < heights.length; i++) {
    if (heights[i] < heights[best]) best = i
  }
  heights[best] += imageHeight(photo)
  return best
}

/**
 * Computes spread = max column height − min column height.
 * The objective of Phase 2 is to minimise this value.
 */
function spread(heights: number[]): number {
  let lo = heights[0], hi = heights[0]
  for (let i = 1; i < heights.length; i++) {
    if (heights[i] < lo) lo = heights[i]
    if (heights[i] > hi) hi = heights[i]
  }
  return hi - lo
}

/**
 * Tie-break score used when two permutations produce identical spread.
 *
 * We prefer whichever assignment places the *last* tail image into the column
 * that has the largest deficit relative to the post-assignment maximum.
 * Concretely: the last image should fill a gap rather than extend the tallest
 * column, and ideally land near the centre rather than the left edge.
 *
 * Returns a value where *lower is better*.
 */
function tiebreakScore(
  baseHeights: number[],
  assignment: number[],
  photos: Photo[]
): number {
  const k = assignment.length

  // Simulate the full assignment to find the post-assignment max height
  const sim = [...baseHeights]
  for (let i = 0; i < k; i++) {
    sim[assignment[i]] += imageHeight(photos[i])
  }
  const maxH = Math.max(...sim)

  // Height of the column that receives the last image, *before* that image
  const simBeforeLast = [...baseHeights]
  for (let i = 0; i < k - 1; i++) {
    simBeforeLast[assignment[i]] += imageHeight(photos[i])
  }
  const lastCol = assignment[k - 1]
  const deficitFilled = maxH - simBeforeLast[lastCol]

  // Secondary: weakly prefer columns nearer to the centre
  const centre = (baseHeights.length - 1) / 2
  const distFromCentre = Math.abs(lastCol - centre)

  // Combine: primary = deficit filled (more = better = lower score),
  // secondary = distance from centre (less = better = lower score).
  return -deficitFilled + distFromCentre * 1e-6
}

/**
 * Enumerate all columnCount^k assignment permutations for `tailPhotos`
 * and return the one that minimises column spread (with tie-breaking).
 *
 * `baseHeights` is the column-height snapshot after the greedy phase
 * and must not be mutated here.
 */
function optimiseTail(
  tailPhotos: Photo[],
  baseHeights: number[],
  columnCount: number
): number[] {
  const k = tailPhotos.length
  if (k === 0) return []

  // Total permutations to evaluate: columnCount ^ k
  const total = Math.pow(columnCount, k)

  let bestAssignment: number[] = []
  let bestSpread = Infinity
  let bestTiebreak = Infinity

  for (let perm = 0; perm < total; perm++) {
    // Decode permutation index from base-columnCount representation.
    // digit 0 (least significant) = column for tailPhotos[0], etc.
    const assignment: number[] = new Array(k)
    let tmp = perm
    for (let i = 0; i < k; i++) {
      assignment[i] = tmp % columnCount
      tmp = Math.floor(tmp / columnCount)
    }

    // Simulate this assignment on a scratch copy of the heights
    const sim = [...baseHeights]
    for (let i = 0; i < k; i++) {
      sim[assignment[i]] += imageHeight(tailPhotos[i])
    }

    const s = spread(sim)

    if (s < bestSpread - 1e-9) {
      // Strictly better balance — adopt unconditionally
      bestSpread = s
      bestAssignment = assignment
      bestTiebreak = tiebreakScore(baseHeights, assignment, tailPhotos)
    } else if (s < bestSpread + 1e-9) {
      // Tied on spread — apply visual tie-break
      const tb = tiebreakScore(baseHeights, assignment, tailPhotos)
      if (tb < bestTiebreak - 1e-12) {
        bestTiebreak = tb
        bestAssignment = assignment
      }
    }
  }

  return bestAssignment
}

/**
 * Builds a masonry column layout for `photos` with `columnCount` columns.
 *
 * Uses a two-phase algorithm:
 *   1. Greedy O(n) insertion for all but the last LOOKAHEAD_SIZE images.
 *   2. Exhaustive look-ahead over the tail to minimise uneven column endings.
 *
 * The public API is identical to the previous implementation:
 *   buildMasonryColumns(photos, columnCount) → MasonryColumn[]
 */
export function buildMasonryColumns(
  photos: Photo[],
  columnCount: number
): MasonryColumn[] {
  // Guard: degenerate inputs
  if (photos.length === 0 || columnCount < 1) {
    return Array.from({ length: Math.max(columnCount, 0) }, (_, i) => ({
      photos: [],
      columnIndex: i,
    }))
  }

  // ── Initialise column buckets and height accumulators ──────────────────────
  const columns: MasonryColumn[] = Array.from({ length: columnCount }, (_, i) => ({
    photos: [],
    columnIndex: i,
  }))
  const heights = new Array<number>(columnCount).fill(0)

  // ── Phase 1: Greedy insertion for photos[0 .. cutoff) ─────────────────────
  //
  // When there are fewer photos than LOOKAHEAD_SIZE (tiny galleries),
  // cutoff = 0 so Phase 2 handles everything — still fast because
  // total permutations remain tiny (≤ columnCount^LOOKAHEAD_SIZE).
  const lookahead = Math.min(LOOKAHEAD_SIZE, photos.length)
  const cutoff = photos.length - lookahead

  for (let i = 0; i < cutoff; i++) {
    const col = greedyInsert(heights, photos[i])
    columns[col].photos.push(photos[i])
  }

  // ── Phase 2: Look-ahead optimisation for photos[cutoff .. end) ────────────
  //
  // Snapshot heights *after* Phase 1 so the search explores all tail orderings
  // without touching the already-finalised column assignments.
  const tailPhotos = photos.slice(cutoff)
  const heightsSnapshot = [...heights] // read-only reference for the search

  const bestAssignment = optimiseTail(tailPhotos, heightsSnapshot, columnCount)

  // Apply the winning tail assignment
  for (let i = 0; i < tailPhotos.length; i++) {
    const col = bestAssignment[i]
    columns[col].photos.push(tailPhotos[i])
    heights[col] += imageHeight(tailPhotos[i])
  }

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