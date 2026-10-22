'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Save, Star, MapPin, MapPinOff, Loader2, Plus, X, Camera,
  Aperture, Clock, Zap, Crosshair, Tag
} from 'lucide-react'
import { cn, generateAltText } from '@/lib/utils'
import type { Photo, ImageMetadata } from '@/types'

interface MetadataEditorProps {
  photo: Photo
  allTags: string[]
  allCategories: string[]
  onUpdate: (meta: Partial<ImageMetadata>) => void
  onSave: () => void
  isSaving: boolean
}

export default function MetadataEditor({
  photo,
  allTags,
  allCategories,
  onUpdate,
  onSave,
  isSaving,
}: MetadataEditorProps) {
  const meta = photo.metadata
  const [tagInput, setTagInput] = useState('')
  const [newCategory, setNewCategory] = useState('')

  function handleField(key: keyof ImageMetadata, value: string | number | boolean | undefined) {
    onUpdate({ [key]: value })
  }

  function addTag(tag: string) {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed) return
    const existing = meta.tags ?? []
    if (!existing.includes(trimmed)) {
      onUpdate({ tags: [...existing, trimmed] })
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    onUpdate({ tags: (meta.tags ?? []).filter((t) => t !== tag) })
  }

  const suggestedAlt = generateAltText(photo)

  return (
    <div className="flex flex-col h-full">
      {/* Photo preview */}
      <div className="relative bg-ink aspect-video flex-shrink-0">
        <Image
          src={photo.thumbnailUrl}
          unoptimized={photo.thumbnailUrl.startsWith('/api/')}
          alt={photo.name}
          fill
          className="object-contain"
        />
        {/* Hero badge */}
        {meta.isHero && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-gold/90 px-2 py-0.5 rounded-full">
            <Star size={9} className="fill-white text-white" />
            <span className="text-2xs text-white font-medium">Hero</span>
          </div>
        )}
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* File name */}
        <div>
          <p className="label mb-1">Filename</p>
          <p className="text-xs text-muted font-mono truncate">{photo.name}</p>
        </div>

        {/* Title */}
        <div className="field-group">
          <label className="field-label" htmlFor={`title-${photo.id}`}>
            Title
          </label>
          <input
            id={`title-${photo.id}`}
            type="text"
            className="field-input"
            placeholder="Untitled"
            value={meta.title ?? ''}
            onChange={(e) => handleField('title', e.target.value || undefined)}
          />
        </div>

        {/* Alt text */}
        <div className="field-group">
          <label className="field-label" htmlFor={`alt-${photo.id}`}>
            Alt Text
            <span className="ml-1 text-muted/60 normal-case font-normal">
              (60–90 chars)
            </span>
          </label>
          <textarea
            id={`alt-${photo.id}`}
            className="field-input resize-none text-sm"
            rows={2}
            placeholder={suggestedAlt}
            value={meta.altText ?? ''}
            onChange={(e) => handleField('altText', e.target.value || undefined)}
          />
          <p className={cn(
            'text-2xs mt-1',
            (meta.altText?.length ?? 0) > 90 ? 'text-red-500' :
            (meta.altText?.length ?? 0) >= 60 ? 'text-green-600' : 'text-muted'
          )}>
            {meta.altText?.length ?? 0} characters
          </p>
        </div>

        {/* Category */}
        <div className="field-group">
          <label className="field-label" htmlFor={`cat-${photo.id}`}>
            Category
          </label>
          <select
            id={`cat-${photo.id}`}
            className="field-input"
            value={meta.category ?? ''}
            onChange={(e) => handleField('category', e.target.value || undefined)}
          >
            <option value="">- None -</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value="__new__">+ Add new…</option>
          </select>
          {meta.category === '__new__' && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                className="field-input flex-1"
                placeholder="Category name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <button
                onClick={() => {
                  if (newCategory.trim()) {
                    handleField('category', newCategory.trim())
                    setNewCategory('')
                  }
                }}
                className="px-3 py-1.5 bg-ink text-parchment text-xs rounded"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="field-group">
          <p className="field-label">Tags</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(meta.tags ?? []).map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-2 py-0.5 bg-surface border border-border rounded-full text-2xs text-secondary"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="text-muted hover:text-ink ml-0.5"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              className="field-input flex-1 text-xs"
              placeholder="Add tag…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag(tagInput)
                }
              }}
              list={`tag-suggestions-${photo.id}`}
            />
            <button
              onClick={() => addTag(tagInput)}
              className="px-2 py-1.5 border border-border text-muted hover:text-ink hover:border-ink transition-colors rounded"
              aria-label="Add tag"
            >
              <Plus size={13} />
            </button>
          </div>
          <datalist id={`tag-suggestions-${photo.id}`}>
            {allTags.filter((t) => !(meta.tags ?? []).includes(t)).map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        {/* ── Hero Controls ─────────────────────── */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="label">Hero Gallery</p>
            <button
              onClick={() => onUpdate({ isHero: !meta.isHero })}
              className={cn('toggle-track', meta.isHero && 'active')}
              aria-pressed={meta.isHero ?? false}
              aria-label="Mark as hero image"
            >
              <span className="toggle-thumb" />
            </button>
          </div>

          {meta.isHero && (
            <div className="grid grid-cols-2 gap-3">
              <div className="field-group">
                <label className="field-label" htmlFor={`act-${photo.id}`}>Act</label>
                <select
                  id={`act-${photo.id}`}
                  className="field-input text-sm"
                  value={meta.heroAct ?? 1}
                  onChange={(e) => onUpdate({ heroAct: parseInt(e.target.value) as 1 | 2 | 3 })}
                >
                  <option value={1}>Act I - Growth</option>
                  <option value={2}>Act II - Fall</option>
                  <option value={3}>Act III - Remnants</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor={`order-${photo.id}`}>Order</label>
                <input
                  id={`order-${photo.id}`}
                  type="number"
                  min={0}
                  max={99}
                  className="field-input text-sm"
                  value={meta.heroOrder ?? 0}
                  onChange={(e) => onUpdate({ heroOrder: parseInt(e.target.value) })}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── EXIF / Camera Data ─────────────────── */}
        <div className="border-t border-border pt-4">
          <p className="label mb-3">Technical / EXIF</p>
          <div className="grid grid-cols-2 gap-3">
            <ExifField
              id={`camera-${photo.id}`}
              label="Camera"
              icon={<Camera size={11} />}
              value={meta.camera ?? ''}
              onChange={(v) => handleField('camera', v || undefined)}
            />
            <ExifField
              id={`lens-${photo.id}`}
              label="Lens"
              value={meta.lens ?? ''}
              onChange={(v) => handleField('lens', v || undefined)}
            />
            <ExifField
              id={`iso-${photo.id}`}
              label="ISO"
              icon={<Zap size={11} />}
              type="number"
              value={meta.iso ?? ''}
              onChange={(v) => handleField('iso', v ? parseInt(v) : undefined)}
            />
            <ExifField
              id={`aperture-${photo.id}`}
              label="Aperture"
              icon={<Aperture size={11} />}
              placeholder="e.g. 2.8"
              type="number"
              value={meta.aperture ?? ''}
              onChange={(v) => handleField('aperture', v ? parseFloat(v) : undefined)}
            />
            <ExifField
              id={`shutter-${photo.id}`}
              label="Shutter Speed"
              icon={<Clock size={11} />}
              placeholder="1/500s"
              value={meta.shutterSpeed ?? ''}
              onChange={(v) => handleField('shutterSpeed', v || undefined)}
            />
            <ExifField
              id={`focal-${photo.id}`}
              label="Focal Length"
              icon={<Crosshair size={11} />}
              type="number"
              placeholder="50"
              value={meta.focalLength ?? ''}
              onChange={(v) => handleField('focalLength', v ? parseFloat(v) : undefined)}
            />
          </div>
        </div>

        {/* ── Location Privacy ───────────────────── */}
        <div className="border-t border-border pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label mb-1 flex items-center gap-1.5">
                {meta.locationPrivate ? (
                  <MapPinOff size={11} className="text-red-500" />
                ) : (
                  <MapPin size={11} className="text-green-600" />
                )}
                Location Privacy
              </p>
              <p className="text-2xs text-muted leading-relaxed">
                {meta.locationPrivate
                  ? 'GPS data is hidden from the public gallery.'
                  : meta.location?.placeName
                    ? `Visible: ${meta.location.placeName}`
                    : 'No location data found.'}
              </p>
            </div>
            {meta.location && (
              <button
                onClick={() => onUpdate({ locationPrivate: !meta.locationPrivate })}
                className={cn('toggle-track flex-shrink-0', meta.locationPrivate && 'active')}
                aria-pressed={meta.locationPrivate ?? false}
                aria-label="Hide location from public"
              >
                <span className="toggle-thumb" />
              </button>
            )}
          </div>

          {meta.location && !meta.locationPrivate && (
            <div className="mt-3 field-group">
              <label className="field-label" htmlFor={`place-${photo.id}`}>
                Place Name (shown publicly)
              </label>
              <input
                id={`place-${photo.id}`}
                type="text"
                className="field-input text-sm"
                placeholder="e.g. Blue Mountains, NSW"
                value={meta.location?.placeName ?? ''}
                onChange={(e) =>
                  onUpdate({
                    location: { ...meta.location!, placeName: e.target.value },
                  })
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Save button */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-ink text-parchment text-sm tracking-wide hover:bg-secondary transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {isSaving ? 'Saving…' : 'Save to Drive'}
        </button>
        <p className="text-2xs text-muted text-center mt-2">
          Metadata is stored in Google Drive file properties
        </p>
      </div>
    </div>
  )
}

// ─── Reusable EXIF field ───────────────────────────────────────────────────

interface ExifFieldProps {
  id: string
  label: string
  value: string | number
  onChange: (val: string) => void
  icon?: React.ReactNode
  type?: 'text' | 'number'
  placeholder?: string
}

function ExifField({ id, label, value, onChange, icon, type = 'text', placeholder }: ExifFieldProps) {
  return (
    <div className="field-group">
      <label className="field-label flex items-center gap-1" htmlFor={id}>
        {icon}
        {label}
      </label>
      <input
        id={id}
        type={type}
        className="field-input text-xs"
        value={value}
        placeholder={placeholder ?? '-'}
        onChange={(e) => onChange(e.target.value)}
        step={type === 'number' ? 'any' : undefined}
        min={type === 'number' ? 0 : undefined}
      />
    </div>
  )
}
