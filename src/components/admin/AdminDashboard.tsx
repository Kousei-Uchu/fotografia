'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import {
  Search, Star, Eye, EyeOff, MapPin, MapPinOff,
  Tag, FolderOpen, ChevronRight, Save, X, Check,
  AlertCircle, BarChart3, Image as ImageIcon, Layers, Share2
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, filterPhotos } from '@/lib/utils'
import { formatAperture, formatISO, formatFocalLength } from '@/lib/drive'
import MetadataEditor from './MetadataEditor'
import ShareManager from './ShareManager'
import type { Photo, DriveFolder, AdminStats, ImageMetadata } from '@/types'

interface AdminDashboardProps {
  initialPhotos: Photo[]
  folderTree: DriveFolder | null
  stats: AdminStats
  allTags: string[]
  allCategories: string[]
}

type ViewMode = 'grid' | 'list'

export default function AdminDashboard({
  initialPhotos,
  folderTree,
  stats,
  allTags,
  allCategories,
}: AdminDashboardProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [selected, setSelected] = useState<string[]>([])
  const [activePhoto, setActivePhoto] = useState<Photo | null>(null)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterFolder, setFilterFolder] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [saving, setSaving] = useState<string | null>(null)
  const [showShareManager, setShowShareManager] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'metadata' | 'folders' | 'stats'>('metadata')

  const filtered = useMemo(
    () => filterPhotos(photos, search, [], filterCategory, filterFolder),
    [photos, search, filterCategory, filterFolder]
  )

  function updatePhoto(id: string, metadata: Partial<ImageMetadata>) {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, metadata: { ...p.metadata, ...metadata } } : p
      )
    )
    if (activePhoto?.id === id) {
      setActivePhoto((prev) =>
        prev ? { ...prev, metadata: { ...prev.metadata, ...metadata } } : null
      )
    }
  }

  async function saveMetadata(photo: Photo) {
    setSaving(photo.id)
    try {
      const res = await fetch('/api/admin/metadata', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId: photo.driveId, metadata: photo.metadata }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Metadata saved')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save — check console')
    } finally {
      setSaving(null)
    }
  }

  function toggleHero(photo: Photo) {
    updatePhoto(photo.id, { isHero: !photo.metadata.isHero })
  }

  function toggleLocationPrivacy(photo: Photo) {
    updatePhoto(photo.id, { locationPrivate: !photo.metadata.locationPrivate })
  }

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const heroCount = photos.filter((p) => p.metadata.isHero).length
  const untagged = photos.filter((p) => !p.metadata.tags?.length).length

  return (
<>
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* ── Left: Photo Grid Panel ──────────────── */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-border overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-white flex-shrink-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="search"
              placeholder="Search…"
              className="field-input pl-8 text-sm py-1.5"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilterCategory(null)}
              className={cn(
                'px-2.5 py-1 text-2xs border rounded-full whitespace-nowrap transition-colors flex-shrink-0',
                !filterCategory ? 'bg-ink text-parchment border-ink' : 'border-border text-muted hover:border-secondary'
              )}
            >
              All
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                className={cn(
                  'px-2.5 py-1 text-2xs border rounded-full whitespace-nowrap transition-colors flex-shrink-0',
                  filterCategory === cat ? 'bg-ink text-parchment border-ink' : 'border-border text-muted hover:border-secondary'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Share selected */}
          {selected.length > 0 && (
            <button
              onClick={() => setShowShareManager(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/20 border border-gold text-ink text-xs hover:bg-gold/30 transition-colors flex-shrink-0"
              aria-label={`Share ${selected.length} selected photos`}
            >
              <Share2 size={13} />
              Share {selected.length} photo{selected.length !== 1 ? 's' : ''}
            </button>
          )}

          {/* View toggle */}
          <div className="flex border border-border rounded ml-auto flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={cn('p-1.5 transition-colors', viewMode === 'grid' ? 'bg-ink text-parchment' : 'text-muted hover:text-secondary')}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <Layers size={13} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn('p-1.5 transition-colors', viewMode === 'list' ? 'bg-ink text-parchment' : 'text-muted hover:text-secondary')}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <BarChart3 size={13} />
            </button>
          </div>

          <span className="label flex-shrink-0">{filtered.length} photos</span>
        </div>

        {/* Status bar */}
        {(heroCount < 20 || untagged > 0) && (
          <div className="flex items-center gap-4 px-4 py-2 bg-amber-50 border-b border-amber-100 flex-shrink-0">
            <AlertCircle size={12} className="text-amber-600 flex-shrink-0" />
            <div className="flex gap-4 text-xs text-amber-700 overflow-x-auto no-scrollbar">
              {heroCount < 20 && (
                <span>{heroCount}/20–30 hero images selected</span>
              )}
              {untagged > 0 && (
                <span>{untagged} photos missing tags</span>
              )}
              {stats.missingAltText > 0 && (
                <span>{stats.missingAltText} missing alt text</span>
              )}
            </div>
          </div>
        )}

        {/* Photo grid / list */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 p-2">
              {filtered.map((photo) => (
                <AdminPhotoCard
                  key={photo.id}
                  photo={photo}
                  isSelected={selected.includes(photo.id)}
                  isActive={activePhoto?.id === photo.id}
                  onSelect={() => toggleSelect(photo.id)}
                  onClick={() => {
                    setActivePhoto(photo)
                    setSidebarTab('metadata')
                  }}
                  onToggleHero={() => toggleHero(photo)}
                  onToggleLocation={() => toggleLocationPrivacy(photo)}
                />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 label">Photo</th>
                  <th className="text-left px-4 py-2 label">Name</th>
                  <th className="text-left px-4 py-2 label">Category</th>
                  <th className="text-left px-4 py-2 label">Tags</th>
                  <th className="text-left px-4 py-2 label">Hero</th>
                  <th className="text-left px-4 py-2 label">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((photo) => (
                  <tr
                    key={photo.id}
                    className={cn(
                      'hover:bg-surface cursor-pointer transition-colors',
                      activePhoto?.id === photo.id && 'bg-gold/10'
                    )}
                    onClick={() => { setActivePhoto(photo); setSidebarTab('metadata') }}
                  >
                    <td className="px-4 py-2">
                      <div className="w-10 h-10 relative">
                        <Image
                          src={photo.thumbnailUrl}
                          alt=""
                          fill
                          className="object-cover rounded"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-secondary max-w-[180px] truncate">
                      {photo.name}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-2xs border border-border px-2 py-0.5 rounded-full text-muted">
                        {photo.metadata.category ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {photo.metadata.tags?.slice(0, 2).map((t) => (
                          <span key={t} className="text-2xs text-muted">{t}</span>
                        ))}
                        {(photo.metadata.tags?.length ?? 0) > 2 && (
                          <span className="text-2xs text-muted/60">+{(photo.metadata.tags?.length ?? 0) - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Star
                        size={13}
                        className={cn(photo.metadata.isHero ? 'fill-gold text-gold' : 'text-border')}
                      />
                    </td>
                    <td className="px-4 py-2">
                      {photo.metadata.location ? (
                        photo.metadata.locationPrivate ? (
                          <MapPinOff size={13} className="text-red-400" />
                        ) : (
                          <MapPin size={13} className="text-green-600" />
                        )
                      ) : (
                        <span className="text-border">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Right: Inspector Panel ──────────────── */}
      <aside className="w-80 xl:w-96 flex flex-col bg-white overflow-hidden flex-shrink-0">
        {/* Sidebar tab switcher */}
        <div className="flex border-b border-border flex-shrink-0">
          {([
            ['metadata', 'Metadata', ImageIcon],
            ['folders', 'Folders', FolderOpen],
            ['stats', 'Stats', BarChart3],
          ] as const).map(([tab, label, Icon]) => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-3 text-2xs tracking-wide transition-colors border-b-2',
                sidebarTab === tab
                  ? 'text-ink border-ink'
                  : 'text-muted border-transparent hover:text-secondary'
              )}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {sidebarTab === 'metadata' && (
            <>
              {activePhoto ? (
                <MetadataEditor
                  photo={activePhoto}
                  allTags={allTags}
                  allCategories={allCategories}
                  onUpdate={(meta) => updatePhoto(activePhoto.id, meta)}
                  onSave={() => saveMetadata(activePhoto)}
                  isSaving={saving === activePhoto.id}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-8 py-12">
                  <ImageIcon size={24} className="text-border mb-3" strokeWidth={1} />
                  <p className="text-sm text-muted">Select a photo to edit its metadata</p>
                </div>
              )}
            </>
          )}

          {sidebarTab === 'folders' && (
            <div className="p-5">
              <p className="label mb-4">Folder Navigation</p>
              {folderTree ? (
                <AdminFolderTree
                  folder={folderTree}
                  selectedId={filterFolder}
                  onSelect={(id) => setFilterFolder(filterFolder === id ? null : id)}
                />
              ) : (
                <p className="text-sm text-muted">
                  Configure GOOGLE_DRIVE_MASTER_FOLDER_ID to enable folder navigation.
                </p>
              )}
            </div>
          )}

          {sidebarTab === 'stats' && (
            <StatsPanel stats={stats} photos={photos} />
          )}
        </div>
      </aside>
    </div>

      {/* Share Manager modal */}
      {showShareManager && (
        <ShareManager
          selectedPhotos={photos.filter((p) => selected.includes(p.id))}
          onClose={() => setShowShareManager(false)}
          onClearSelection={() => {
            setSelected([])
            setShowShareManager(false)
          }}
        />
      )}
</>
  )
}

// ─── Admin Photo Card ──────────────────────────────────────────────────────

interface AdminPhotoCardProps {
  photo: Photo
  isSelected: boolean
  isActive: boolean
  onSelect: () => void
  onClick: () => void
  onToggleHero: () => void
  onToggleLocation: () => void
}

function AdminPhotoCard({
  photo,
  isSelected,
  isActive,
  onSelect,
  onClick,
  onToggleHero,
  onToggleLocation,
}: AdminPhotoCardProps) {
  return (
    <div
      className={cn(
        'relative group cursor-pointer rounded overflow-hidden',
        isActive && 'ring-2 ring-ink ring-offset-1',
        isSelected && 'ring-2 ring-gold ring-offset-1'
      )}
      style={{ aspectRatio: photo.aspectRatio }}
      onClick={onClick}
    >
      <Image
        src={photo.thumbnailUrl}
        alt={photo.name}
        fill
        className="object-cover"
        sizes="150px"
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Select checkbox */}
        <button
          className="absolute top-1.5 left-1.5 w-5 h-5 rounded border border-white/60 bg-black/30 flex items-center justify-center hover:bg-black/50"
          onClick={(e) => { e.stopPropagation(); onSelect() }}
          aria-label="Select photo"
        >
          {isSelected && <Check size={10} className="text-white" />}
        </button>

        {/* Hero toggle */}
        <button
          className="absolute top-1.5 right-1.5"
          onClick={(e) => { e.stopPropagation(); onToggleHero() }}
          aria-label={photo.metadata.isHero ? 'Remove from hero' : 'Mark as hero'}
          title={photo.metadata.isHero ? 'Remove from hero gallery' : 'Add to hero gallery'}
        >
          <Star
            size={14}
            className={cn(
              'transition-colors',
              photo.metadata.isHero ? 'fill-gold text-gold' : 'text-white/60 hover:text-gold'
            )}
          />
        </button>

        {/* Location privacy quick-toggle */}
        {photo.metadata.location && (
          <button
            className="absolute bottom-1.5 right-1.5"
            onClick={(e) => { e.stopPropagation(); onToggleLocation() }}
            aria-label={photo.metadata.locationPrivate ? 'Show location' : 'Hide location'}
            title={photo.metadata.locationPrivate ? 'Location hidden — click to reveal' : 'Location visible — click to hide'}
          >
            {photo.metadata.locationPrivate ? (
              <MapPinOff size={12} className="text-red-400" />
            ) : (
              <MapPin size={12} className="text-green-400" />
            )}
          </button>
        )}
      </div>

      {/* Missing data indicator */}
      {(!photo.metadata.tags?.length || !photo.metadata.altText) && (
        <div className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-amber-400" title="Missing metadata" />
      )}
    </div>
  )
}

// ─── Admin Folder Tree ─────────────────────────────────────────────────────

function AdminFolderTree({
  folder,
  selectedId,
  onSelect,
  depth = 0,
}: {
  folder: DriveFolder
  selectedId: string | null
  onSelect: (id: string) => void
  depth?: number
}) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = (folder.children?.length ?? 0) > 0

  if (depth === 0) {
    return (
      <ul className="space-y-0.5">
        {folder.children?.map((child) => (
          <AdminFolderTree
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
    <li>
      <div className="flex items-center gap-1">
        {hasChildren && (
          <button
            onClick={() => setOpen(!open)}
            className="text-muted hover:text-secondary p-0.5 flex-shrink-0"
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
            'flex-1 text-left text-sm py-1 px-2 rounded transition-colors truncate',
            !hasChildren && 'pl-5',
            selectedId === folder.id
              ? 'bg-ink/5 text-ink font-medium'
              : 'text-secondary hover:bg-surface'
          )}
        >
          {folder.name}
          {folder.imageCount !== undefined && (
            <span className="ml-1.5 text-2xs text-muted/60">({folder.imageCount})</span>
          )}
        </button>
      </div>
      {open && hasChildren && (
        <ul className="pl-3 mt-0.5 space-y-0.5">
          {folder.children?.map((child) => (
            <AdminFolderTree
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

// ─── Stats Panel ───────────────────────────────────────────────────────────

function StatsPanel({ stats, photos }: { stats: AdminStats; photos: Photo[] }) {
  const categoryCounts = photos.reduce<Record<string, number>>((acc, p) => {
    const cat = p.metadata.category ?? 'Uncategorized'
    acc[cat] = (acc[cat] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-5 space-y-6">
      <div>
        <p className="label mb-4">Overview</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Photos', value: stats.totalPhotos },
            { label: 'Hero Images', value: `${stats.heroPhotos} / 30` },
            { label: 'Folders', value: stats.totalFolders },
            { label: 'Private Locations', value: stats.privateLocations },
            { label: 'Missing Tags', value: stats.untaggedPhotos, warn: stats.untaggedPhotos > 0 },
            { label: 'Missing Alt Text', value: stats.missingAltText, warn: stats.missingAltText > 0 },
          ].map(({ label, value, warn }) => (
            <div key={label} className={cn('p-3 border rounded', warn ? 'border-amber-200 bg-amber-50' : 'border-border')}>
              <p className="label text-2xs">{label}</p>
              <p className={cn('text-xl font-light mt-1', { 'font-display': true }, warn && 'text-amber-600')}
                 style={{ fontFamily: 'Cormorant Garant, serif' }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="label mb-3">By Category</p>
        <div className="space-y-2">
          {Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-sm text-secondary w-28 truncate">{cat}</span>
                <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full"
                    style={{ width: `${(count / stats.totalPhotos) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted w-8 text-right">{count}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
