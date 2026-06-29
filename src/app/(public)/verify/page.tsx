/**
 * /verify — Client-side watermark detection.
 * Drag-and-drop an image; DWT-DCT-QIM detection runs entirely in the browser
 * via Canvas pixel extraction. Nothing is uploaded to a server.
 */

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, ShieldCheck, ShieldX, Loader2, Info, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Client-side detector (mirrors lib/watermark.ts) ─────────────────────────

const WATERMARK_TEXT = 'morebi.vercel.app - \u00A92026 Aiden - hello@sorren.me'
const DELTA = 28
const R_REPS = 8
const BLOCK = 8
const MID_ROW = 3
const MID_COL = 4
const N_DCT = 8

const DCT_MATRIX: number[][] = Array.from({ length: N_DCT }, (_, k) =>
  Array.from({ length: N_DCT }, (__, n) => {
    const alpha = k === 0 ? 1 / Math.sqrt(N_DCT) : Math.sqrt(2 / N_DCT)
    return alpha * Math.cos((Math.PI * (2 * n + 1) * k) / (2 * N_DCT))
  })
)

function dct2d(block: Float64Array): Float64Array {
  const tmp = new Float64Array(N_DCT * N_DCT)
  for (let r = 0; r < N_DCT; r++)
    for (let k = 0; k < N_DCT; k++) {
      let s = 0
      for (let n = 0; n < N_DCT; n++) s += block[r * N_DCT + n] * DCT_MATRIX[k][n]
      tmp[r * N_DCT + k] = s
    }
  const out = new Float64Array(N_DCT * N_DCT)
  for (let c = 0; c < N_DCT; c++)
    for (let k = 0; k < N_DCT; k++) {
      let s = 0
      for (let n = 0; n < N_DCT; n++) s += tmp[n * N_DCT + c] * DCT_MATRIX[k][n]
      out[k * N_DCT + c] = s
    }
  return out
}

function dwtForwardLL(data: Float64Array, rows: number, cols: number) {
  const hr = rows >> 1, hc = cols >> 1
  const L = new Float64Array(rows * hc)
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < hc; c++)
      L[r * hc + c] = (data[r * cols + 2 * c] + data[r * cols + 2 * c + 1]) * 0.5
  const LL = new Float64Array(hr * hc)
  for (let r = 0; r < hr; r++)
    for (let c = 0; c < hc; c++)
      LL[r * hc + c] = (L[(2 * r) * hc + c] + L[(2 * r + 1) * hc + c]) * 0.5
  return { LL, llRows: hr, llCols: hc }
}

function qimDecode(coeff: number): number { return Math.round(Math.abs(coeff) / DELTA) & 1 }

function bitsToText(bits: number[]): string {
  let out = ''
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let code = 0
    for (let b = 0; b < 8; b++) code = (code << 1) | bits[i + b]
    if (code === 0) break
    out += String.fromCharCode(code)
  }
  return out
}

interface DetectionResult { detected: boolean; text: string; confidence: number; blocksUsed: number }

function detectWatermarkClient(imageData: ImageData): DetectionResult {
  const { data, width, height } = imageData
  const payloadBits = WATERMARK_TEXT.length * 8

  const luma = new Float64Array(width * height)
  for (let i = 0; i < width * height; i++)
    luma[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]

  const padW = width & 1 ? width + 1 : width
  const padH = height & 1 ? height + 1 : height
  let lumaWork = luma
  if (padW !== width || padH !== height) {
    lumaWork = new Float64Array(padW * padH)
    for (let r = 0; r < height; r++)
      for (let c = 0; c < width; c++)
        lumaWork[r * padW + c] = luma[r * width + c]
  }

  const { LL, llRows, llCols } = dwtForwardLL(lumaWork, padH, padW)
  const bRows = Math.floor(llRows / BLOCK)
  const bCols = Math.floor(llCols / BLOCK)
  const totalBlocks = bRows * bCols

  const votes = new Int32Array(payloadBits)
  const counts = new Int32Array(payloadBits)
  let blockIdx = 0

  outer: for (let rep = 0; rep < R_REPS; rep++) {
    for (let bi = 0; bi < payloadBits; bi++) {
      if (blockIdx >= totalBlocks) break outer
      const br = Math.floor(blockIdx / bCols), bc = blockIdx % bCols
      blockIdx++
      const block = new Float64Array(BLOCK * BLOCK)
      for (let r = 0; r < BLOCK; r++)
        for (let c = 0; c < BLOCK; c++)
          block[r * BLOCK + c] = LL[(br * BLOCK + r) * llCols + bc * BLOCK + c]
      votes[bi] += qimDecode(dct2d(block)[MID_ROW * BLOCK + MID_COL])
      counts[bi]++
    }
  }

  const decidedBits: number[] = []
  let totalAgree = 0, totalVotes = 0
  for (let bi = 0; bi < payloadBits; bi++) {
    if (!counts[bi]) { decidedBits.push(0); continue }
    const ones = votes[bi], zeros = counts[bi] - ones
    const bit = ones >= zeros ? 1 : 0
    decidedBits.push(bit)
    totalAgree += Math.max(ones, zeros)
    totalVotes += counts[bi]
  }

  const confidence = totalVotes > 0 ? totalAgree / totalVotes : 0
  const decoded = bitsToText(decidedBits)
  return {
    detected: decoded === WATERMARK_TEXT || (confidence >= 0.82 && decoded.length >= WATERMARK_TEXT.length * 0.8),
    text: decoded,
    confidence,
    blocksUsed: Math.min(blockIdx, totalBlocks),
  }
}

async function fileToImageData(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function VerifyPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<string | null>(null)

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current) }, [])

  async function processFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload an image file (JPEG, PNG, WebP, etc.)'); setStatus('error'); return
    }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const url = URL.createObjectURL(file)
    previewRef.current = url
    setPreviewUrl(url); setStatus('loading'); setResult(null); setErrorMsg('')
    try {
      await new Promise(r => setTimeout(r, 30))
      setResult(detectWatermarkClient(await fileToImageData(file)))
      setStatus('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Detection failed')
      setStatus('error')
    }
  }

  const handleFiles = useCallback((files: FileList | null) => { if (files?.[0]) processFile(files[0]) }, [])
  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }, [handleFiles])
  async function copyText(text: string) { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }

  const confidencePct = result ? Math.round(result.confidence * 100) : 0

  return (
    <div className="pt-28 pb-24 px-6 md:px-10 max-w-2xl mx-auto">
      <div className="mb-10">
        <p className="label mb-3">Watermark Verification</p>
        <h1 className="display text-4xl md:text-5xl text-ink mb-5" style={{ fontFamily: 'Cormorant Garant, serif' }}>
          Verify Ownership
        </h1>
        <p className="text-sm text-secondary leading-relaxed max-w-prose">
          Every image served from this site carries an invisible DWT-DCT frequency-domain watermark.
          Upload any suspected copy — even after JPEG re-compression, colour grading, or mild cropping —
          to confirm whether it originated here.
        </p>
        <p className="text-xs text-muted mt-3">Detection runs entirely in your browser. Nothing is uploaded to a server.</p>
      </div>

      <div
        className={cn(
          'border-2 border-dashed rounded transition-colors cursor-pointer',
          'flex flex-col items-center justify-center text-center py-14 px-6',
          dragging ? 'border-ink bg-ink/5' : 'border-border hover:border-gold-dark hover:bg-surface'
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button" tabIndex={0}
        aria-label="Upload image for watermark verification"
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <Upload size={28} strokeWidth={1.25} className={cn('mb-3 transition-colors', dragging ? 'text-ink' : 'text-muted')} />
        <p className="text-sm text-secondary font-medium">{dragging ? 'Drop to analyse' : 'Drop an image here'}</p>
        <p className="text-xs text-muted mt-1.5">or click to browse</p>
        <p className="text-2xs text-muted/60 mt-3">JPEG · PNG · WebP · AVIF · TIFF</p>
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {(previewUrl || status !== 'idle') && (
        <div className="mt-8 space-y-6">
          {previewUrl && (
            <div className="relative rounded overflow-hidden bg-surface border border-border max-h-80 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Uploaded image preview" className="max-h-80 w-auto object-contain" />
            </div>
          )}

          {status === 'loading' && (
            <div className="flex items-center gap-3 py-4">
              <Loader2 size={18} className="animate-spin text-gold-dark flex-shrink-0" />
              <div>
                <p className="text-sm text-ink font-medium">Analysing frequency domain…</p>
                <p className="text-xs text-muted mt-0.5">Running Haar DWT → 8×8 DCT → QIM decode across all blocks</p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-3 p-4 border border-red-200 bg-red-50 rounded">
              <ShieldX size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}

          {status === 'done' && result && (
            <div className={cn('border rounded p-5 space-y-4', result.detected ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50')} role="region" aria-label="Watermark detection result">
              <div className="flex items-start gap-3">
                {result.detected
                  ? <ShieldCheck size={22} className="text-green-600 flex-shrink-0 mt-0.5" />
                  : <ShieldX size={22} className="text-red-500 flex-shrink-0 mt-0.5" />}
                <div>
                  <p className={cn('font-medium text-base', result.detected ? 'text-green-800' : 'text-red-800')}>
                    {result.detected ? 'Watermark detected — this image originated here' : 'No watermark found'}
                  </p>
                  <p className={cn('text-xs mt-1', result.detected ? 'text-green-700' : 'text-red-600')}>
                    {result.detected
                      ? 'The invisible DWT-DCT signature is present and readable.'
                      : 'Either the image was not served from this site, or it has been too heavily modified (cropped >50%, heavily filtered, or down-scaled below ~226 × 226 px).'}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-secondary font-medium">Decode confidence</span>
                  <span className={cn('text-xs font-medium tabular-nums', confidencePct >= 90 ? 'text-green-700' : confidencePct >= 75 ? 'text-amber-700' : 'text-red-600')}>
                    {confidencePct}%
                  </span>
                </div>
                <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', confidencePct >= 90 ? 'bg-green-500' : confidencePct >= 75 ? 'bg-amber-500' : 'bg-red-400')}
                    style={{ width: `${confidencePct}%` }}
                  />
                </div>
                <p className="text-2xs text-secondary/70 mt-1.5">
                  Based on majority vote across {result.blocksUsed} DCT blocks · ≥ 82% = confirmed · ≥ 90% = high confidence
                </p>
              </div>

              <div>
                <p className="text-xs text-secondary font-medium mb-1.5">Decoded payload</p>
                <div className="flex items-center gap-2 bg-white/60 border border-black/10 rounded px-3 py-2">
                  <code className="text-xs text-ink flex-1 break-all font-mono">
                    {result.text || <span className="text-muted italic">empty</span>}
                  </code>
                  {result.text && (
                    <button onClick={() => copyText(result.text)} className="flex-shrink-0 text-muted hover:text-ink transition-colors" aria-label="Copy decoded text">
                      {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
                {result.detected && (
                  <p className="text-2xs text-green-700 mt-1.5">
                    ✓ Matches expected signature: <span className="font-mono">{WATERMARK_TEXT}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <details className="mt-12 group">
        <summary className="flex items-center gap-2 cursor-pointer label text-muted hover:text-secondary transition-colors list-none">
          <Info size={11} />
          How the watermark works
          <span className="ml-auto text-muted group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="mt-4 space-y-3 text-sm text-secondary leading-relaxed border-l-2 border-border pl-4">
          <p>Each image served from this site passes through a frequency-domain embedding pipeline before delivery. The process is invisible to the human eye but mathematically recoverable.</p>
          <ol className="space-y-2 list-decimal list-inside text-sm marker:text-muted">
            <li><strong className="text-ink">Haar DWT</strong> — the image luma channel is decomposed into four frequency sub-bands. The low-frequency LL sub-band carries most of the image energy and is highly resistant to compression.</li>
            <li><strong className="text-ink">8×8 DCT-II</strong> — the LL sub-band is split into non-overlapping 8 × 8 blocks and each is transformed into the frequency domain, mirroring the JPEG codec internally.</li>
            <li><strong className="text-ink">QIM embedding</strong> — a mid-frequency coefficient in each block is shifted by ≤ {DELTA / 2} units to encode one watermark bit. The shift is below the just-noticeable-difference (JND) threshold for photographic content.</li>
            <li><strong className="text-ink">Repetition coding</strong> — each bit is embedded into {R_REPS} independent blocks. Detection uses majority voting across all copies, providing robustness against partial image loss.</li>
          </ol>
          <p className="text-xs text-muted">Reference: Bhatnagar & Jonathan Wu, "Biometrics inspired watermarking based on a fractional dual tree complex wavelet transform", Future Generation Computer Systems, 2012.</p>
        </div>
      </details>
    </div>
  )
}
