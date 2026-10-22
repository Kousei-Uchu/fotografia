'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, ExternalLink, Check, Loader2, Clock, AlertCircle, Copy, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Photo } from '@/types'

interface ShareManagerProps {
  selectedPhotos: Photo[]
  onClose: () => void
  onClearSelection: () => void
}

type ExpiryOption = 'never' | '24h' | '7d' | '30d' | 'custom'

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string; hours: number }[] = [
  { value: 'never',  label: 'Never expires', hours: 0   },
  { value: '24h',    label: '24 hours',       hours: 24  },
  { value: '7d',     label: '7 days',         hours: 168 },
  { value: '30d',    label: '30 days',        hours: 720 },
  { value: 'custom', label: 'Custom…',        hours: 0   },
]

interface CreatedShare { url: string; label: string; photoCount: number; expiresLabel: string }

export default function ShareManager({ selectedPhotos, onClose, onClearSelection }: ShareManagerProps) {
  const [label, setLabel] = useState('')
  const [note, setNote] = useState('')
  const [expiry, setExpiry] = useState<ExpiryOption>('never')
  const [customHours, setCustomHours] = useState(48)
  const [creating, setCreating] = useState(false)
  const [createdShare, setCreatedShare] = useState<CreatedShare | null>(null)
  const [copied, setCopied] = useState(false)

  function resolveHours(): number {
    if (expiry === 'custom') return customHours
    return EXPIRY_OPTIONS.find(o => o.value === expiry)?.hours ?? 0
  }

  async function createShare() {
    if (!selectedPhotos.length) return
    setCreating(true)
    try {
      const res = await fetch('/api/admin/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedPhotos.map(p => p.driveId), label: label.trim() || undefined, note: note.trim() || undefined, expiresInHours: resolveHours() }),
      })
      const json = await res.json()
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Failed to create share link')
      const hours = resolveHours()
      setCreatedShare({
        url: json.data.url,
        label: label.trim() || 'Untitled selection',
        photoCount: selectedPhotos.length,
        expiresLabel: hours === 0 ? 'No expiry' : hours < 48 ? `Expires in ${hours}h` : `Expires in ${Math.round(hours / 24)} days`,
      })
      toast.success('Share link created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create share link')
    } finally { setCreating(false) }
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(true); toast.success('Link copied to clipboard'); setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true" aria-label="Create share link">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative w-full sm:max-w-lg bg-white sm:rounded shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-sm font-medium text-ink">Create share link</h2>
            <p className="text-xs text-muted mt-0.5">{selectedPhotos.length} photo{selectedPhotos.length !== 1 ? 's' : ''} selected</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink transition-colors" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!createdShare ? (
            <div className="p-5 space-y-5">
              <div>
                <p className="field-label mb-2">Selected photos</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {selectedPhotos.map(photo => (
                    <div key={photo.id} className="relative flex-shrink-0 w-14 h-14 bg-surface rounded overflow-hidden">
                      <Image src={photo.thumbnailUrl} unoptimized={photo.thumbnailUrl.startsWith('/api/')} alt={photo.metadata.title ?? photo.name} fill className="object-cover" sizes="56px" />
                    </div>
                  ))}
                </div>
                <button onClick={onClearSelection} className="flex items-center gap-1 mt-2 text-2xs text-muted hover:text-ink transition-colors">
                  <Trash2 size={10} />Clear selection
                </button>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="share-label">Gallery title <span className="normal-case font-normal text-muted/70">(shown to recipient)</span></label>
                <input id="share-label" type="text" className="field-input" placeholder="e.g. Wedding Preview - Smith & Jones" maxLength={120} value={label} onChange={e => setLabel(e.target.value)} />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="share-note">Message <span className="normal-case font-normal text-muted/70">(optional)</span></label>
                <textarea id="share-note" className="field-input resize-none text-sm" rows={3} placeholder="Hi Sarah, here are the selects from your session…" maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
                <p className="text-2xs text-muted text-right">{note.length}/500</p>
              </div>

              <div className="field-group">
                <p className="field-label mb-2 flex items-center gap-1.5"><Clock size={11} />Link expiry</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                  {EXPIRY_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setExpiry(opt.value)}
                      className={cn('px-2 py-2 text-2xs border rounded transition-colors text-center',
                        expiry === opt.value ? 'bg-ink text-parchment border-ink' : 'border-border text-muted hover:border-secondary hover:text-secondary')}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {expiry === 'custom' && (
                  <div className="flex items-center gap-2 mt-2">
                    <input type="number" min={1} max={8760} className="field-input w-24 text-sm" value={customHours} onChange={e => setCustomHours(Math.max(1, parseInt(e.target.value) || 1))} />
                    <span className="text-sm text-secondary">hours</span>
                    <span className="text-xs text-muted">({Math.round(customHours / 24 * 10) / 10} days)</span>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 p-3 bg-surface border border-border rounded text-xs text-secondary">
                <AlertCircle size={12} className="text-muted mt-0.5 flex-shrink-0" />
                <span>Share links are read-only and not indexed by search engines. All images are delivered with an invisible watermark.{' '}
                  {resolveHours() > 0 ? `This link will stop working after ${resolveHours()} hours.` : 'This link has no expiry date.'}</span>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded">
                <Check size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">Share link created</p>
                  <p className="text-xs text-green-700 mt-0.5">{createdShare.photoCount} photo{createdShare.photoCount !== 1 ? 's' : ''} · {createdShare.expiresLabel}</p>
                </div>
              </div>
              <div>
                <p className="field-label mb-1.5">Share URL</p>
                <div className="flex items-center gap-2 p-3 bg-surface border border-border rounded font-mono text-xs text-ink break-all">
                  <span className="flex-1">{createdShare.url}</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => copyUrl(createdShare.url)}
                  className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 border text-sm transition-colors',
                    copied ? 'border-green-300 bg-green-50 text-green-700' : 'border-border text-secondary hover:border-ink hover:text-ink')}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied!' : 'Copy link'}
                </button>
                <a href={createdShare.url} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-ink text-parchment text-sm hover:bg-secondary transition-colors">
                  <ExternalLink size={14} />Preview
                </a>
              </div>
              <button onClick={() => { setCreatedShare(null); setLabel(''); setNote(''); setExpiry('never') }}
                className="w-full text-xs text-muted hover:text-secondary transition-colors py-1">
                Create another link with different settings
              </button>
            </div>
          )}
        </div>

        {!createdShare && (
          <div className="px-5 py-4 border-t border-border flex-shrink-0">
            <button onClick={createShare} disabled={creating || !selectedPhotos.length}
              className="w-full flex items-center justify-center gap-2 py-3 bg-ink text-parchment text-sm tracking-wide hover:bg-secondary transition-colors disabled:opacity-40">
              {creating && <Loader2 size={14} className="animate-spin" />}
              {creating ? 'Creating…' : `Create link for ${selectedPhotos.length} photo${selectedPhotos.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
