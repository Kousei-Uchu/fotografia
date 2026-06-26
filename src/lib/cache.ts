import type { Photo, DriveFolder } from '@/types'

// Simple in-memory cache for Vercel serverless (resets per cold start)
// For production, consider Redis or KV store

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>()

  set<T>(key: string, data: T, ttlSeconds = 300): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
    })
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key)
      return null
    }

    return entry.data as T
  }

  invalidate(key: string): void {
    this.store.delete(key)
  }

  invalidateAll(): void {
    this.store.clear()
  }
}

export const cache = new MemoryCache()

// Cache keys
export const CACHE_KEYS = {
  ALL_PHOTOS: 'all_photos',
  FOLDER_TREE: 'folder_tree',
  HERO_PHOTOS: 'hero_photos',
  ADMIN_STATS: 'admin_stats',
  PHOTOS_IN_FOLDER: (folderId: string) => `photos_folder_${folderId}`,
}

// TTL constants (seconds)
export const TTL = {
  SHORT: 60,        // 1 minute
  MEDIUM: 300,      // 5 minutes
  LONG: 1800,       // 30 minutes
  VERY_LONG: 3600,  // 1 hour
}
