'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight, Download, Link2, Check, MapPin, Camera } from 'lucide-react'
import { cn, buildMasonryColumns, generateAltText } from '@/lib/utils'
import { formatAperture, formatISO, formatFocalLength } from '@/lib/photoFormatting'
import type { Photo } from '@/types'

interface ShareGalleryProps {
  photos: Photo[]
  token: string
}

export default function ShareGallery({ photos, token }: ShareGalleryProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [colCount, setColCount] = useState(3)

  useEffect(() => {
    function update() { setColCount(window.innerWidth < 640 ? 2 : window.innerWidth < 1024 ? 3 : 4) }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const columns = buildMasonryColumns(photos, colCount)

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (lightboxIdx === null) return
    if (e.key === 'Escape')     setLightboxIdx(null)
    if (e.key === 'ArrowRight') setLightboxIdx(i => Math.min((i ?? 0) + 1, photos.length - 1))
    if (e.key === 'ArrowLeft')  setLightboxIdx(i => Math.max((i ?? 0) - 1, 0))
  }, [lightboxIdx, photos.length])

  useEffect(() => { window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey) }, [handleKey])
  useEffect(() => { document.body.style.overflow = lightboxIdx !== null ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [lightboxIdx])

  const activePhoto = lightboxIdx !== null ? photos[lightboxIdx] : null

  return (
    <>
      <div className="px-6 md:px-10 pb-6 max-w-screen-xl mx-auto">
        <button
          onClick={copyLink}
          className={cn('flex items-center gap-2 px-4 py-2 border text-sm transition-colors',
            copied ? 'border-green-300 bg-green-50 text-green-700' : 'border-border text-secondary hover:border-ink hover:text-ink')}
          aria-label="Copy share link"
        >
          {copied ? <Check size={14} /> : <Link2 size={14} />}
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      <div className="px-1 md:px-2 max-w-screen-xl mx-auto">
        <div className="masonry-grid">
          {columns.map((col) => (
            <div key={col.columnIndex} className="masonry-col">
              {col.photos.map((photo, idx) => {
                const absIdx = photos.indexOf(photo)
                const alt = generateAltText(photo)
                return (
                  <button key={photo.id} className="photo-card w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
                    onClick={() => setLightboxIdx(absIdx)} aria-label={`View: ${alt}`} style={{ aspectRatio: photo.aspectRatio }}>
                    <Image src={`/api/images/${photo.driveId}?size=800`} unoptimized alt={alt} width={photo.width} height={photo.height}
                      loading={idx < 4 && col.columnIndex < 2 ? 'eager' : 'lazy'} className="w-full h-full object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
                    <div className="meta-overlay" aria-hidden="true">
                      {photo.metadata.title && <p className="text-white text-sm font-light">{photo.metadata.title}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {activePhoto && lightboxIdx !== null && (
        <div className="lightbox-backdrop" onClick={() => setLightboxIdx(null)} role="dialog" aria-modal="true"
          aria-label={`Viewing photo ${lightboxIdx + 1} of ${photos.length}`}>
          {lightboxIdx > 0 && (
            <button className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 text-white/60 hover:text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1) }} aria-label="Previous photo">
              <ChevronLeft size={28} strokeWidth={1.5} />
            </button>
          )}
          {lightboxIdx < photos.length - 1 && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 text-white/60 hover:text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1) }} aria-label="Next photo">
              <ChevronRight size={28} strokeWidth={1.5} />
            </button>
          )}
          <button onClick={() => setLightboxIdx(null)} className="absolute top-5 right-5 z-10 text-white/60 hover:text-white transition-colors" aria-label="Close">
            <X size={20} strokeWidth={1.5} />
          </button>
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10">
            <span className="label text-white/50">{lightboxIdx + 1} / {photos.length}</span>
          </div>
          <div className="relative max-w-5xl max-h-full w-full flex items-center justify-center p-10" onClick={(e) => e.stopPropagation()}>
            <Image src={`/api/images/${activePhoto.driveId}?size=2048`} unoptimized alt={generateAltText(activePhoto)}
              width={activePhoto.width} height={activePhoto.height} className="max-h-[85vh] w-auto object-contain" priority sizes="100vw" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-12 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pointer-events-auto">
              <div>
                {activePhoto.metadata.title && (
                  <h2 className="text-white text-xl font-light" style={{ fontFamily: 'Cormorant Garant, serif' }}>{activePhoto.metadata.title}</h2>
                )}
                {activePhoto.metadata.location?.placeName && !activePhoto.metadata.locationPrivate && (
                  <p className="flex items-center gap-1.5 text-white/60 text-xs mt-1"><MapPin size={10} />{activePhoto.metadata.location.placeName}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {activePhoto.metadata.camera && <span className="flex items-center gap-1 text-white/60 text-2xs"><Camera size={10} />{activePhoto.metadata.camera}</span>}
                {activePhoto.metadata.aperture && <span className="text-white/60 text-2xs">{formatAperture(activePhoto.metadata.aperture)}</span>}
                {activePhoto.metadata.shutterSpeed && <span className="text-white/60 text-2xs">{activePhoto.metadata.shutterSpeed}</span>}
                {activePhoto.metadata.iso && <span className="text-white/60 text-2xs">{formatISO(activePhoto.metadata.iso)}</span>}
                {activePhoto.metadata.focalLength && <span className="text-white/60 text-2xs">{formatFocalLength(activePhoto.metadata.focalLength)}</span>}
                <a href={`/api/images/${activePhoto.driveId}?size=2048&fmt=jpeg`} download={activePhoto.name}
                  className="flex items-center gap-1.5 ml-2 px-3 py-1.5 border border-white/30 text-white/80 hover:border-white hover:text-white text-xs transition-colors"
                  onClick={(e) => e.stopPropagation()} aria-label="Download full-resolution watermarked image">
                  <Download size={12} />Download
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
