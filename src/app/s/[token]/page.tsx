/**
 * /s/[token] — Public share gallery page.
 * Verifies the HMAC token server-side, fetches Drive metadata for each photo,
 * renders ShareGallery. Dynamic (force-dynamic) so expiry is checked on every request.
 */

import type { Metadata } from 'next'
import { verifyShareToken, shareMetaFromPayload, shareErrorMessage } from '@/lib/shares'
import { getFileMetadata, driveFileToPhoto } from '@/lib/drive'
import ShareGallery from '@/components/gallery/ShareGallery'
import type { Photo } from '@/types'

export const dynamic = 'force-dynamic'

interface Props { params: { token: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = verifyShareToken(decodeURIComponent(params.token))
  if (!result.ok) return { title: 'Invalid Share Link' }
  const meta = shareMetaFromPayload(result.payload)
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'Photography'
  return {
    title: meta.label ?? `Shared Gallery — ${siteName}`,
    description: meta.note ?? `${meta.photoCount} photographs shared privately via ${siteName}.`,
    robots: { index: false, follow: false },
  }
}

async function loadPhotos(ids: string[]): Promise<Photo[]> {
  const CONCURRENCY = 20
  const photos: Photo[] = []
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(
      ids.slice(i, i + CONCURRENCY).map(async (id) => {
        if (id.startsWith('demo-')) {
          return {
            id, driveId: id, name: `${id}.jpg`,
            width: 1200, height: 800, aspectRatio: 1.5,
            thumbnailUrl: `https://picsum.photos/seed/${id}/800/600`,
            fullUrl: `https://picsum.photos/seed/${id}/1600/1200`,
            metadata: {},
            createdTime: new Date().toISOString(),
            modifiedTime: new Date().toISOString(),
          } satisfies Photo
        }
        return driveFileToPhoto(await getFileMetadata(id), '', [])
      })
    )
    for (const r of results) {
      if (r.status === 'fulfilled') photos.push(r.value)
    }
  }
  return photos
}

export default async function SharePage({ params }: Props) {
  const rawToken = decodeURIComponent(params.token)
  const result = verifyShareToken(rawToken)

  if (!result.ok) return <ShareErrorPage error={shareErrorMessage(result.error)} />

  const { payload } = result
  const meta = shareMetaFromPayload(payload)
  let photos: Photo[] = []
  try { photos = await loadPhotos(payload.ids) }
  catch (err) { console.error('[share] Photo load failed:', err) }

  if (photos.length === 0) {
    return <ShareErrorPage error="None of the shared images could be loaded. They may have been removed." />
  }

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? 'Photography'

  return (
    <div className="min-h-screen bg-parchment">
      <header className="px-6 md:px-10 pt-8 pb-6 border-b border-border">
        <div className="flex items-center justify-between max-w-screen-xl mx-auto">
          <span className="display-italic text-ink text-lg" style={{ fontFamily: 'Cormorant Garant, serif' }}>
            {siteName}
          </span>
          <span className="label">Private Selection</span>
        </div>
      </header>

      <div className="px-6 md:px-10 pt-10 pb-8 max-w-screen-xl mx-auto">
        <h1 className="display text-4xl md:text-5xl text-ink mb-4" style={{ fontFamily: 'Cormorant Garant, serif' }}>
          {meta.label ?? 'Curated Selection'}
        </h1>
        {meta.note && (
          <p className="text-secondary text-sm leading-relaxed max-w-xl mb-4">{meta.note}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="label">{photos.length} photograph{photos.length !== 1 ? 's' : ''}</span>
          {meta.expiresAt && (
            <span className="label text-gold-dark">
              Expires {meta.expiresAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      <ShareGallery photos={photos} token={rawToken} />

      <footer className="border-t border-border mt-16 px-6 md:px-10 py-8 max-w-screen-xl mx-auto">
        <p className="text-xs text-muted text-center">
          This is a private selection shared by {siteName}. Please do not redistribute.
        </p>
      </footer>
    </div>
  )
}

function ShareErrorPage({ error }: { error: string }) {
  return (
    <div className="min-h-screen bg-parchment flex flex-col items-center justify-center text-center px-6">
      <p className="display text-[6rem] leading-none text-border" style={{ fontFamily: 'Cormorant Garant, serif' }} aria-hidden="true">×</p>
      <h1 className="display-italic text-3xl text-ink mt-2" style={{ fontFamily: 'Cormorant Garant, serif' }}>Link unavailable</h1>
      <p className="text-sm text-muted mt-4 max-w-sm leading-relaxed">{error}</p>
    </div>
  )
}
