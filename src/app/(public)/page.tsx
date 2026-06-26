import type { Metadata } from 'next'
import { crawlAllImages } from '@/lib/drive'
import { getHeroPhotos } from '@/lib/utils'
import { cache, CACHE_KEYS, TTL } from '@/lib/cache'
import HeroGallery from '@/components/gallery/HeroGallery'
import type { Photo } from '@/types'

export const revalidate = 3600 // ISR: rebuild every hour

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_SITE_NAME ?? 'Photography',
  description: `Curated fine art photography by ${process.env.NEXT_PUBLIC_SITE_NAME}. Landscape, portrait, and documentary work in three acts.`,
}

async function getHeroImages(): Promise<Photo[]> {
  const cached = cache.get<Photo[]>(CACHE_KEYS.HERO_PHOTOS)
  if (cached) return cached

  try {
    const folderId = process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID
    if (!folderId) return getDemoPhotos()

    const allPhotos = await crawlAllImages(folderId)
    const heroPhotos = getHeroPhotos(allPhotos)

    if (heroPhotos.length === 0) {
      // If no photos are marked as hero, show first 24 as demo
      const demo = allPhotos.slice(0, 24)
      cache.set(CACHE_KEYS.HERO_PHOTOS, demo, TTL.LONG)
      return demo
    }

    cache.set(CACHE_KEYS.HERO_PHOTOS, heroPhotos, TTL.LONG)
    return heroPhotos
  } catch (err) {
    console.error('Failed to load hero photos:', err)
    return getDemoPhotos()
  }
}

// Demo photos for when Drive isn't configured
function getDemoPhotos(): Photo[] {
  return Array.from({ length: 18 }, (_, i) => ({
    id: `demo-${i}`,
    driveId: `demo-${i}`,
    name: `photo-${i + 1}.jpg`,
    width: i % 3 === 0 ? 1200 : i % 3 === 1 ? 800 : 1000,
    height: i % 3 === 0 ? 800 : i % 3 === 1 ? 1200 : 667,
    aspectRatio: i % 3 === 0 ? 1.5 : i % 3 === 1 ? 0.667 : 1.5,
    thumbnailUrl: `https://picsum.photos/seed/${i + 100}/800/600`,
    fullUrl: `https://picsum.photos/seed/${i + 100}/1600/1200`,
    metadata: {
      isHero: true,
      heroAct: ((Math.floor(i / 6) + 1) as 1 | 2 | 3),
      heroOrder: i % 6,
      tags: ['landscape', 'nature'],
      category: 'Landscape',
      altText: `Fine art landscape photograph number ${i + 1}, capturing natural light and texture`,
    },
    createdTime: new Date(Date.now() - i * 86400000).toISOString(),
    modifiedTime: new Date().toISOString(),
  }))
}

export default async function HomePage() {
  const heroPhotos = await getHeroImages()

  return (
    <div>
      {/* Hero intro */}
      <section
        className="pt-32 pb-16 px-6 md:px-10"
        aria-labelledby="hero-heading"
      >
        <h1
          id="hero-heading"
          className="display text-5xl md:text-7xl lg:text-8xl text-ink max-w-3xl"
          style={{ fontFamily: 'Cormorant Garant, serif' }}
        >
          Light &amp;
          <br />
          <em className="display-italic">Stillness</em>
        </h1>
        <p className="mt-6 text-sm text-secondary max-w-sm leading-relaxed">
          A curated sequence of twenty-four photographs arranged in three acts
          — each a moment suspended between intention and accident.
        </p>
      </section>

      {/* Gallery */}
      <HeroGallery photos={heroPhotos} />
    </div>
  )
}
