/**
 * GET /api/images/[id]?size=<px>&fmt=<webp|jpeg>
 *
 * Watermark proxy: fetches from Drive CDN → embeds DWT-DCT-QIM watermark
 * → re-encodes to WebP (Q82, default) or JPEG (Q88) → streams to client.
 *
 * Cache-Control: public, immutable, max-age=86400
 */

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { embedWatermark } from '@/lib/watermark'

const MAX_SIZE = 3000
const DEFAULT_SIZE = 1200

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const fileId = params.id

  if (!/^[\w-]{10,60}$/.test(fileId)) {
    return new NextResponse('Invalid file ID', { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const rawSize = parseInt(searchParams.get('size') ?? String(DEFAULT_SIZE), 10)
  const size = Math.min(Math.max(rawSize || DEFAULT_SIZE, 64), MAX_SIZE)
  const fmt = searchParams.get('fmt') === 'jpeg' ? 'jpeg' : 'webp'

  const sourceUrl = `https://lh3.googleusercontent.com/d/${fileId}=s${size}`

  let sourceBuffer: ArrayBuffer
  try {
    const res = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FotografiaBot/1.0; watermark-proxy)' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error(`[proxy] Drive CDN returned ${res.status} for ${fileId}`)
      return new NextResponse('Source image unavailable', { status: 502 })
    }
    sourceBuffer = await res.arrayBuffer()
  } catch (err) {
    console.error(`[proxy] Fetch failed for ${fileId}:`, err)
    return new NextResponse('Failed to fetch source image', { status: 502 })
  }

  let rawPixels: Buffer
  let imgWidth: number
  let imgHeight: number
  try {
    const img = sharp(Buffer.from(sourceBuffer))
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
    rawPixels = data
    imgWidth = info.width
    imgHeight = info.height
  } catch (err) {
    console.error(`[proxy] Sharp decode failed for ${fileId}:`, err)
    return new NextResponse('Failed to decode image', { status: 500 })
  }

  let watermarked: Buffer
  try {
    watermarked = embedWatermark(rawPixels, imgWidth, imgHeight).buffer
  } catch (err) {
    console.error(`[proxy] Watermark embed failed for ${fileId}:`, err)
    watermarked = rawPixels
  }

  let outputBuffer: Buffer
  let contentType: string
  try {
    const reencoder = sharp(watermarked, {
      raw: { width: imgWidth, height: imgHeight, channels: 3 },
    })
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
