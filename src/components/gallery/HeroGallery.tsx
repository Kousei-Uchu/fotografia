'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn, generateAltText, buildMasonryColumns } from '@/lib/utils'
import PhotoLightbox from './PhotoLightbox'
import type { Photo } from '@/types'

interface HeroGalleryProps {
  photos: Photo[]
}

const actMeta = {
  1: { label: 'Act I', title: 'Growth', description: 'New life. The world awakening.' },
  2: { label: 'Act II', title: 'Fall', description: "Approaching warm decay. The preparation of the world for it’s rest." },
  3: { label: 'Act III', title: 'Dormant', description: 'Returning quiet. What remains.' },
}

export default function HeroGallery({ photos }: HeroGalleryProps) {
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)

  // Group by act, then lay out per-act
  const acts = [1, 2, 3] as const
  const byAct = acts.reduce<Record<number, Photo[]>>((acc, act) => {
    acc[act] = photos.filter(
      (p) => (p.metadata.heroAct ?? 1) === act
    )
    return acc
  }, {})

  // If no act metadata, distribute evenly
  if (photos.every((p) => !p.metadata.heroAct)) {
    const third = Math.ceil(photos.length / 3)
    byAct[1] = photos.slice(0, third)
    byAct[2] = photos.slice(third, third * 2)
    byAct[3] = photos.slice(third * 2)
  }

  return (
    <>
      <div className="space-y-20 pb-24">
        {acts.map((act, actIdx) => {
          const actPhotos = byAct[act]
          if (!actPhotos?.length) return null

          const meta = actMeta[act]
          const columns = buildMasonryColumns(actPhotos, actIdx === 1 ? 2 : 3)

          return (
            <section key={act} aria-labelledby={`act-${act}-heading`}>
              {/* Act header */}
              <div className="flex items-end justify-between px-6 md:px-10 mb-6">
                <div>
                  <p className="label mb-2">{meta.label}</p>
                  <h2
                    id={`act-${act}-heading`}
                    className="display text-3xl md:text-4xl text-ink"
                    style={{ fontFamily: 'Cormorant Garant, serif' }}
                  >
                    {meta.title}
                  </h2>
                </div>
                <p className="hidden md:block text-sm text-muted max-w-xs text-right leading-relaxed">
                  {meta.description}
                </p>
              </div>

              {/* Asymmetric masonry */}
              <div
                className={cn(
                  'masonry-grid px-1 md:px-2',
                  actIdx === 1 && 'max-w-4xl mx-auto'
                )}
              >
                {columns.map((col) => (
                  <div key={col.columnIndex} className="masonry-col">
                    {col.photos.map((photo, photoIdx) => (
                      <PhotoTile
                        key={photo.id}
                        photo={photo}
                        priority={actIdx === 0 && photoIdx < 2}
                        onClick={() => setLightboxPhoto(photo)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <PhotoLightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
    </>
  )
}

// ─── Individual photo tile ─────────────────────────────────────────────────

interface PhotoTileProps {
  photo: Photo
  priority?: boolean
  onClick: () => void
}

function PhotoTile({ photo, priority = false, onClick }: PhotoTileProps) {
  const alt = generateAltText(photo)

  return (
    <button
      className="photo-card w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-2"
      onClick={onClick}
      aria-label={`View: ${alt}`}
    >
      <Image
        src={photo.thumbnailUrl}
        alt={alt}
        width={photo.width}
        height={photo.height}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        className="w-full h-full object-contain"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      />
      {/* Subtle hover overlay with exif hint */}
      <div className="meta-overlay" aria-hidden="true">
        {photo.metadata.title && (
          <p className="text-white text-sm font-light leading-tight">
            {photo.metadata.title}
          </p>
        )}
        {photo.metadata.location?.placeName && !photo.metadata.locationPrivate && (
          <p className="text-white/60 text-xs mt-0.5">
            {photo.metadata.location.placeName}
          </p>
        )}
      </div>
    </button>
  )
}
