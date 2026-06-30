'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { Search, X, ChevronDown, ChevronRight, Filter, Eye, EyeOff } from 'lucide-react'
import { cn, filterPhotos, buildMasonryColumns, generateAltText, debounce } from '@/lib/utils'
import {
  formatAperture,
  formatISO,
  formatFocalLength,
} from '@/lib/photoFormatting'
import PhotoLightbox from './PhotoLightbox'
import type { Photo, DriveFolder, FilterState } from '@/types'
import { useInView } from 'react-intersection-observer';

interface GalleryClientProps {
  photos: Photo[]
  tags: string[]
  categories: string[]
  folderTree: DriveFolder | null
}

const PHOTOS_PER_PAGE = 40

export default function GalleryClient({
  photos,
  tags,
  categories,
  folderTree,
}: GalleryClientProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    tags: [],
    category: null,
    folderId: null,
    page: 1,
  })
  const [showExif, setShowExif] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Debounced search
  const debouncedSetSearch = useCallback(
    debounce((val: unknown) => {
      setFilters((f) => ({ ...f, search: String(val), page: 1 }))
    }, 300) as (val: string) => void,
    []
  )


  const filtered = useMemo(
    () =>
      filterPhotos(
        photos,
        filters.search,
        filters.tags,
        filters.category,
        filters.folderId
      ),
    [photos, filters.search, filters.tags, filters.category, filters.folderId]
  )

  const paginated = useMemo(
    () => filtered.slice(0, filters.page * PHOTOS_PER_PAGE),
    [filtered, filters.page]
  )

  const columns = useMemo(
    () => buildMasonryColumns(paginated, 3),
    [paginated]
  )

  const activeFilterCount =
    (filters.tags.length) +
    (filters.category ? 1 : 0) +
    (filters.folderId ? 1 : 0)

  function toggleTag(tag: string) {
    setFilters((f) => ({
      ...f,
      page: 1,
      tags: f.tags.includes(tag)
        ? f.tags.filter((t) => t !== tag)
        : [...f.tags, tag],
    }))
  }

  function clearFilters() {
    setFilters({ search: '', tags: [], category: null, folderId: null, page: 1 })
  }

  // 'ref' attaches to the element, 'inView' is a boolean tracking visibility
  const { ref, inView } = useInView({
    threshold: 0.2,      // Triggers when 20% of the element is visible
    triggerOnce: true,   // Set to true if you only want to trigger it once
  });

  useEffect(() => {
    if (inView) {
      console.log('Loading more photos due to infinite scroll trigger');
      setFilters((f) => ({ ...f, page: f.page + 1 }));
    }
  }, [inView]);

  return (
    <div className="flex flex-col md:flex-row">
      {/* ── Sidebar ─────────────────────────────── */}
      <aside
        className={cn(
          'md:w-56 lg:w-64 md:shrink-0 border-b md:border-b-0 md:border-r border-border',
          'md:min-h-screen md:sticky md:top-0 md:max-h-screen md:overflow-y-auto'
        )}
      >
        {/* Mobile filter toggle */}
        <button
          className="flex md:hidden items-center justify-between w-full px-6 py-4 text-left"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
        >
          <span className="flex items-center gap-2 label">
            <Filter size={12} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-ink text-parchment text-2xs rounded-full px-1.5 py-0.5">
                {activeFilterCount}
              </span>
            )}
          </span>
          <ChevronDown
            size={14}
            className={cn('text-muted transition-transform', showFilters && 'rotate-180')}
          />
        </button>

        <div className={cn('md:block', !showFilters && 'hidden md:block')}>
          <div className="px-5 py-6 space-y-8">
            {/* Search */}
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <input
                type="search"
                placeholder="Search photographs…"
                className="field-input pl-8 text-sm"
                onChange={(e) => debouncedSetSearch(e.target.value)}
                aria-label="Search photographs"
              />
            </div>

            {/* EXIF toggle */}
            <div className="flex items-center justify-between">
              <span className="label">Show EXIF</span>
              <button
                onClick={() => setShowExif(!showExif)}
                className={cn('toggle-track', showExif && 'active')}
                aria-pressed={showExif}
                aria-label="Toggle EXIF metadata overlay"
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            {/* Categories */}
            {categories.length > 0 && (
              <div>
                <p className="label mb-3">Category</p>
                <ul className="space-y-1" role="list">
                  {categories.map((cat) => (
                    <li key={cat}>
                      <button
                        onClick={() =>
                          setFilters((f) => ({
                            ...f,
                            page: 1,
                            category: f.category === cat ? null : cat,
                          }))
                        }
                        className={cn(
                          'w-full text-left text-sm py-1 transition-colors',
                          filters.category === cat
                            ? 'text-ink font-medium'
                            : 'text-muted hover:text-secondary'
                        )}
                      >
                        {cat}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div>
                <p className="label mb-3">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        'px-2.5 py-1 text-2xs border rounded-full transition-colors',
                        filters.tags.includes(tag)
                          ? 'bg-ink text-parchment border-ink'
                          : 'border-border text-muted hover:border-gold-dark hover:text-secondary'
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Folder tree */}
            {folderTree && (
              <div>
                <p className="label mb-3">Folders</p>
                <FolderTree
                  folder={folderTree}
                  selectedId={filters.folderId}
                  onSelect={(id) =>
                    setFilters((f) => ({
                      ...f,
                      page: 1,
                      folderId: f.folderId === id ? null : id,
                    }))
                  }
                  depth={0}
                />
              </div>
            )}

            {/* Clear */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 label text-gold-dark hover:text-ink transition-colors"
              >
                <X size={10} />
                Clear filters
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main Grid ───────────────────────────── */}
      <main className="flex-1 min-w-0">
        {/* Result count */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border">
          <p className="label">
            {filtered.length === photos.length
              ? `${photos.length} photographs`
              : `${filtered.length} of ${photos.length} photographs`}
          </p>
          {showExif && (
            <span className="flex items-center gap-1 text-2xs text-gold-dark">
              <Eye size={10} />
              EXIF visible
            </span>
          )}
        </div>

        {/* Grid */}
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <p className="display text-4xl text-border mb-3" style={{ fontFamily: 'Cormorant Garant, serif' }}>
              Nothing found
            </p>
            <p className="text-sm text-muted">Try different keywords or clear the filters.</p>
            <button
              onClick={clearFilters}
              className="mt-6 text-sm text-ink underline underline-offset-4 hover:text-gold-dark transition-colors"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            <div className="masonry-grid p-1 md:p-2">
              {columns.map((col) => (
                <div key={col.columnIndex} className="masonry-col">
                  {col.photos.map((photo, idx) => (
                    <GalleryCard
                      key={photo.id}
                      photo={photo}
                      showExif={showExif}
                      priority={idx < 3 && col.columnIndex < 2}
                      onClick={() => setLightboxPhoto(photo)}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Load more */}
            {paginated.length < filtered.length && (
              <div className="flex justify-center py-10">
                <button
                  ref={ref}  // Attach the ref for intersection observer
                  onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                  className="px-8 py-3 border border-border text-sm text-secondary hover:border-ink hover:text-ink transition-colors"
                >
                  Load {Math.min(PHOTOS_PER_PAGE, filtered.length - paginated.length)} more
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Lightbox */}
      {lightboxPhoto && (
        <PhotoLightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
    </div>
  )
}

// ─── Gallery Card ──────────────────────────────────────────────────────────

interface GalleryCardProps {
  photo: Photo
  showExif: boolean
  priority: boolean
  onClick: () => void
}

function GalleryCard({ photo, showExif, priority, onClick }: GalleryCardProps) {
  const alt = generateAltText(photo)

  return (
    <button
      className="photo-card w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
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
      {showExif && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2.5 py-2">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {photo.metadata.camera && (
              <span className="text-white/70 text-2xs">{photo.metadata.camera}</span>
            )}
            {photo.metadata.aperture && (
              <span className="text-white/70 text-2xs">{formatAperture(photo.metadata.aperture)}</span>
            )}
            {photo.metadata.shutterSpeed && (
              <span className="text-white/70 text-2xs">{photo.metadata.shutterSpeed}</span>
            )}
            {photo.metadata.iso && (
              <span className="text-white/70 text-2xs">{formatISO(photo.metadata.iso)}</span>
            )}
          </div>
        </div>
      )}
    </button>
  )
}

// ─── Folder Tree ───────────────────────────────────────────────────────────

interface FolderTreeProps {
  folder: DriveFolder
  selectedId: string | null
  onSelect: (id: string) => void
  depth: number
}

function FolderTree({ folder, selectedId, onSelect, depth }: FolderTreeProps) {
  const [open, setOpen] = useState(depth === 0)
  const hasChildren = (folder.children?.length ?? 0) > 0

  if (depth === 0) {
    // Root - render children directly
    return (
      <ul className="space-y-0.5" role="tree">
        {folder.children?.map((child) => (
          <FolderTree
            key={child.id}
            folder={child}
            selectedId={selectedId}
            onSelect={onSelect}
            depth={1}
          />
        ))}
      </ul>
    )
  }

  return (
    <li role="treeitem" aria-expanded={open}>
      <div className="flex items-center gap-1">
        {hasChildren && (
          <button
            onClick={() => setOpen(!open)}
            className="text-muted hover:text-secondary p-0.5"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            <ChevronRight
              size={10}
              className={cn('transition-transform', open && 'rotate-90')}
            />
          </button>
        )}
        <button
          onClick={() => onSelect(folder.id)}
          className={cn(
            'flex-1 text-left text-sm py-0.5 transition-colors',
            !hasChildren && 'pl-4',
            selectedId === folder.id
              ? 'text-ink font-medium'
              : 'text-muted hover:text-secondary'
          )}
        >
          {folder.name}
          {folder.imageCount !== undefined && folder.imageCount > 0 && (
            <span className="ml-1.5 text-2xs text-muted/60">
              ({folder.imageCount})
            </span>
          )}
        </button>
      </div>
      {open && hasChildren && (
        <ul className="pl-3 mt-0.5 space-y-0.5" role="group">
          {folder.children?.map((child) => (
            <FolderTree
              key={child.id}
              folder={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
