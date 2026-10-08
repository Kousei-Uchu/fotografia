'use client'

import { useEffect, useCallback } from 'react'
import Image from 'next/image'
import { X, MapPin, Camera, Aperture } from 'lucide-react'
import { cn, generateAltText, formatDate } from '@/lib/utils'
import {
  formatAperture,
  formatISO,
  formatFocalLength,
} from '@/lib/photoFormatting'
import type { Photo } from '@/types'

interface PhotoLightboxProps {
  photo: Photo
  onClose: () => void
}

export default function PhotoLightbox({ photo, onClose }: PhotoLightboxProps) {
  const alt = generateAltText(photo)
  const meta = photo.metadata

  // Keyboard close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  const hasExif =
    meta.iso || meta.aperture || meta.shutterSpeed || meta.camera || meta.lens

  return (
    <div
      className="lightbox-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing: ${alt}`}
    >
      {/* Inner container - stop propagation so click on image doesn't close */}
      <div
        className="relative w-full h-full flex items-center justify-center p-4 md:p-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-white/60 hover:text-white transition-colors z-10"
          aria-label="Close lightbox"
        >
          <X size={20} strokeWidth={1.5} />
        </button>

        {/* Photo */}
        <div className="relative max-w-5xl max-h-full w-full">
          <Image
            src={photo.fullUrl}
            unoptimized={photo.fullUrl.startsWith('/api/')}
            alt={alt}
            width={photo.width}
            height={photo.height}
            className="max-h-[85vh] w-auto mx-auto object-contain"
            priority
            sizes="100vw"
          />
        </div>

        {/* EXIF strip at bottom */}
        {(hasExif || meta.title || meta.location) && (
          <div className="absolute bottom-0 left-0 right-0 px-6 md:px-10 pb-6 pt-10 bg-gradient-to-t from-black/80 to-transparent">
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
              {/* Title / description */}
              <div>
                {meta.title && (
                  <h2
                    className="text-white text-xl font-light"
                    style={{ fontFamily: 'Cormorant Garant, serif' }}
                  >
                    {meta.title}
                  </h2>
                )}
                {meta.location?.placeName && !meta.locationPrivate && (
                  <p className="flex items-center gap-1.5 text-white/60 text-xs mt-1">
                    <MapPin size={10} />
                    {meta.location.placeName}
                  </p>
                )}
                <p className="text-white/40 text-xs mt-1">
                  {formatDate(photo.createdTime)}
                </p>
              </div>

              {/* EXIF data */}
              {hasExif && (
                <div className="flex flex-wrap gap-4">
                  {meta.camera && (
                    <ExifPill
                      icon={<Camera size={10} />}
                      value={meta.camera}
                    />
                  )}
                  {meta.aperture && (
                    <ExifPill value={formatAperture(meta.aperture)} />
                  )}
                  {meta.shutterSpeed && (
                    <ExifPill value={meta.shutterSpeed} />
                  )}
                  {meta.iso && (
                    <ExifPill value={formatISO(meta.iso)} />
                  )}
                  {meta.focalLength && (
                    <ExifPill value={formatFocalLength(meta.focalLength)} />
                  )}
                  {meta.lens && (
                    <ExifPill value={meta.lens} />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ExifPill({
  icon,
  value,
}: {
  icon?: React.ReactNode
  value: string
}) {
  return (
    <span className="flex items-center gap-1 text-white/70 text-2xs tracking-wide font-light">
      {icon}
      {value}
    </span>
  )
}
