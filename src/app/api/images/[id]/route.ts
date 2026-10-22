/**
 * GET /api/images/[id]?size=<px>&fmt=<webp|jpeg>
 *
 * Watermark proxy: fetches the FULL-RESOLUTION master from Drive CDN once,
 * embeds the DWT-DCT-QIM watermark on that single master, then derives every
 * requested delivery size by downscaling the already-watermarked buffer
 * (instead of re-embedding fresh at each requested size).
 *
 * Why: embedding independently at every requested `size` meant the same
 * fixed-pixel-size DCT block grid landed at a different *relative* scale on
 * every output - on a small thumbnail, each 16×16px block covers a much
 * larger fraction of the visible image, making the embed's block structure
 * far more visible. Embedding once on the master and downscaling afterward
 * means delivery sizes get a Lanczos3 low-pass resample applied on top of
 * the watermark, which smooths block-edge discontinuities instead of
 * re-introducing them at a new, more visible scale.
 *
 * A best-effort in-memory cache also avoids re-running the DWT/DCT pass for
 * every size/format combination requested for the same file within a given
 * server instance's lifetime.
 *
 * Cache-Control: public, immutable, max-age=86400
 */
import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { embedWatermark } from '@/lib/watermark'
import { downloadFileBuffer } from '@/lib/drive'

const MAX_SIZE = 16383
// Longest edge of the watermarked master. The watermark pass allocates several
// Float64 planes per pixel, so full-res originals (24MP+) can exceed a
// serverless function's memory. 3072px is still comfortably above the largest
// delivery size the gallery requests (2048), so nothing gets upscaled.
const MASTER_MAX_DIM = 3072

async function fetchFromCdn(fileId: string): Promise<Buffer> {
  const res = await fetch(`https://lh3.googleusercontent.com/d/${fileId}=s${MASTER_MAX_DIM}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FotografiaBot/1.0; watermark-proxy)' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`CDN returned ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── In-memory watermarked-master cache ────────────────────────────────────
//
// Keyed by file ID, holds the raw (watermarked, unencoded) pixel buffer at
// full source resolution. NOT persisted across cold starts / separate
// serverless instances - it's a best-effort optimisation for repeated
// requests hitting the same warm instance, not a substitute for a real
// store. Swap in Redis/Vercel KV/blob storage if cross-instance hits matter.
interface CachedMaster {
  buffer: Buffer
  width: number
  height: number
  timestamp: number
}

const MASTER_CACHE = new Map<string, CachedMaster>()
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 // 24h
const CACHE_MAX_ENTRIES = 200

function getCachedMaster(fileId: string): CachedMaster | null {
  const entry = MASTER_CACHE.get(fileId)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    MASTER_CACHE.delete(fileId)
    return null
  }
  return entry
}

function setCachedMaster(fileId: string, entry: CachedMaster) {
  if (MASTER_CACHE.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = MASTER_CACHE.keys().next().value
    if (oldestKey) MASTER_CACHE.delete(oldestKey)
  }
  MASTER_CACHE.set(fileId, entry)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const fileId = params.id
  if (!/^[\w-]{10,60}$/.test(fileId)) {
    return new NextResponse('Invalid file ID', { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  // If size param exists, parse and clamp it. If not, default to 0 (Original)
  const hasSizeParam = searchParams.get('size') !== null
  const rawSize = parseInt(searchParams.get('size') || '0', 10)
  const requestedSize = (hasSizeParam && !isNaN(rawSize))
    ? Math.min(Math.max(rawSize, 800), MAX_SIZE)
    : 0
  const fmt = searchParams.get('fmt') === 'jpeg' ? 'jpeg' : 'webp'

  // ─── Step 1: get a watermarked master buffer at full source resolution ───
  let master = getCachedMaster(fileId)

  if (!master) {
    // Source order: Drive API (service account, works for private files and
    // isn't throttled like the public CDN), then the lh3 CDN as a fallback.
    // Either way the watermark is embedded exactly once per image, on a
    // master capped at MASTER_MAX_DIM so memory stays bounded.
    let rawPixels: Buffer | null = null
    let imgWidth = 0
    let imgHeight = 0

    const sources: Array<{ name: string; load: () => Promise<Buffer> }> = [
      { name: 'drive-api', load: () => downloadFileBuffer(fileId) },
      { name: 'lh3-cdn', load: fetchFromCdn.bind(null, fileId) },
    ]

    for (const source of sources) {
      try {
        const sourceBuffer = await source.load()
        // .rotate() bakes in EXIF orientation (the Drive API returns the
        // untouched original, unlike the CDN); the resize cap happens in the
        // decoder so a 24MP+ original is never fully expanded in memory.
        const { data, info } = await sharp(sourceBuffer, {
          limitInputPixels: 400_000_000,
          sequentialRead: true,
        })
          .rotate()
          .resize({
            width: MASTER_MAX_DIM,
            height: MASTER_MAX_DIM,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toColourspace('srgb')
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
        rawPixels = data
        imgWidth = info.width
        imgHeight = info.height
        break
      } catch (err) {
        console.error(`[proxy] ${source.name} failed for ${fileId}:`, err)
      }
    }

    if (!rawPixels) {
      return new NextResponse('Source image unavailable', { status: 502 })
    }

    let watermarkedPixels: Buffer
    try {
      watermarkedPixels = embedWatermark(rawPixels, imgWidth, imgHeight).buffer
    } catch (err) {
      console.error(`[proxy] Watermark embed failed for ${fileId}:`, err)
      watermarkedPixels = rawPixels
    }

    master = {
      buffer: watermarkedPixels,
      width: imgWidth,
      height: imgHeight,
      timestamp: Date.now(),
    }
    setCachedMaster(fileId, master)
  }

  // ─── Step 2: derive the requested delivery size from the watermarked master ───
  let outputBuffer: Buffer
  let contentType: string
  try {
    let reencoder = sharp(master.buffer, {
      raw: { width: master.width, height: master.height, channels: 3 },
    })

    if (requestedSize > 0 && requestedSize < Math.max(master.width, master.height)) {
      // Downscaling an already-watermarked buffer applies a Lanczos3
      // low-pass resample (Sharp's default) on top of the embed, which
      // smooths away residual block-edge discontinuities rather than
      // creating a fresh, more-visible block grid at the smaller scale.
      reencoder = reencoder.resize({
        width: requestedSize,
        height: requestedSize,
        fit: 'inside',
        withoutEnlargement: true,
      })
    }

    if (fmt === 'jpeg') {
      outputBuffer = await reencoder.jpeg({ quality: 88, mozjpeg: true }).toBuffer()
      contentType = 'image/jpeg'
    } else {
      outputBuffer = await reencoder.webp({ quality: 82, effort: 4 }).toBuffer()
      contentType = 'image/webp'
    }
  } catch (err) {
    console.error(`[proxy] Re-encode failed for ${fileId}:`, err)
    return new NextResponse('Failed to encode output image', { status: 500 })
  }

  return new NextResponse(new Uint8Array(outputBuffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(outputBuffer.byteLength),
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
      'X-Watermark': 'dwt-dct-qim',
      'X-Image-ID': fileId,
    },
  })
}