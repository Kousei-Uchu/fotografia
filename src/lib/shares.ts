/**
 * shares.ts - Stateless signed share-token system
 *
 * token = base64url( JSON payload ) + "." + base64url( HMAC-SHA256 signature )
 *
 * Payload: { v:1, ids:string[], label?, note?, exp?, iat }
 *
 * Env required: SHARE_SECRET (≥32 bytes) - generate with: openssl rand -hex 32
 */

import { createHmac, timingSafeEqual } from 'crypto'

export interface SharePayload {
  v: 1
  ids: string[]
  label?: string
  note?: string
  exp?: number
  iat: number
}

export interface ShareMeta {
  label?: string
  note?: string
  photoCount: number
  createdAt: Date
  expiresAt?: Date
  isExpired: boolean
}

export type ShareError =
  | 'INVALID_FORMAT'
  | 'INVALID_SIGNATURE'
  | 'EXPIRED'
  | 'MISSING_SECRET'
  | 'TOO_MANY_IDS'
  | 'EMPTY_IDS'

export type ShareResult =
  | { ok: true; payload: SharePayload }
  | { ok: false; error: ShareError }

const ALGO = 'sha256'
const MAX_IDS = 200
const SEPARATOR = '.'

function getSecret(): string {
  const s = process.env.SHARE_SECRET
  if (!s) throw new Error('SHARE_SECRET environment variable is not set')
  return s
}

function b64Encode(str: string): string {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64Decode(str: string): string {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function sign(payload: string, secret: string): string {
  return createHmac(ALGO, secret).update(payload).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

export interface CreateShareOptions {
  ids: string[]
  label?: string
  note?: string
  expiresInHours?: number
}

export function createShareToken(options: CreateShareOptions): string {
  const { ids, label, note, expiresInHours } = options
  if (ids.length === 0) throw new Error('ids must not be empty')
  if (ids.length > MAX_IDS) throw new Error(`Maximum ${MAX_IDS} images per share link`)

  const payload: SharePayload = {
    v: 1,
    ids,
    label: label?.trim() || undefined,
    note: note?.trim() || undefined,
    iat: nowSeconds(),
    exp: expiresInHours && expiresInHours > 0
      ? nowSeconds() + expiresInHours * 3600
      : undefined,
  }

  const secret = getSecret()
  const encoded = b64Encode(JSON.stringify(payload))
  return `${encoded}${SEPARATOR}${sign(encoded, secret)}`
}

export function verifyShareToken(token: string): ShareResult {
  let secret: string
  try { secret = getSecret() }
  catch { return { ok: false, error: 'MISSING_SECRET' } }

  const lastDot = token.lastIndexOf(SEPARATOR)
  if (lastDot === -1) return { ok: false, error: 'INVALID_FORMAT' }

  const encodedPayload = token.slice(0, lastDot)
  const providedSig = token.slice(lastDot + 1)
  const expectedSig = sign(encodedPayload, secret)

  let sigMatch: boolean
  try {
    sigMatch = timingSafeEqual(
      Buffer.from(providedSig, 'utf8'),
      Buffer.from(expectedSig, 'utf8')
    )
  } catch { sigMatch = false }
  if (!sigMatch) return { ok: false, error: 'INVALID_SIGNATURE' }

  let payload: SharePayload
  try { payload = JSON.parse(b64Decode(encodedPayload)) as SharePayload }
  catch { return { ok: false, error: 'INVALID_FORMAT' } }

  if (payload.v !== 1) return { ok: false, error: 'INVALID_FORMAT' }
  if (!Array.isArray(payload.ids) || payload.ids.length === 0) return { ok: false, error: 'EMPTY_IDS' }
  if (payload.ids.length > MAX_IDS) return { ok: false, error: 'TOO_MANY_IDS' }
  if (payload.exp && nowSeconds() > payload.exp) return { ok: false, error: 'EXPIRED' }

  return { ok: true, payload }
}

export function shareMetaFromPayload(payload: SharePayload): ShareMeta {
  return {
    label: payload.label,
    note: payload.note,
    photoCount: payload.ids.length,
    createdAt: new Date(payload.iat * 1000),
    expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
    isExpired: payload.exp ? nowSeconds() > payload.exp : false,
  }
}

export function shareErrorMessage(error: ShareError): string {
  switch (error) {
    case 'INVALID_FORMAT':    return 'This share link is malformed or incomplete.'
    case 'INVALID_SIGNATURE': return 'This share link has been tampered with and cannot be trusted.'
    case 'EXPIRED':           return 'This share link has expired.'
    case 'MISSING_SECRET':    return 'Server configuration error. Please contact the site owner.'
    case 'TOO_MANY_IDS':      return 'This share link references too many images.'
    case 'EMPTY_IDS':         return 'This share link contains no images.'
  }
}
