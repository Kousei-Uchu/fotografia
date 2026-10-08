import { google } from 'googleapis'
import type {
  DriveFile,
  DriveFolder,
  Photo,
  ImageMetadata,
} from '@/types'

// ─── Google Drive Auth ────────────────────────────────────────────────────────

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })

  return google.drive({ version: 'v3', auth })
}

// ─── File Field Selectors ─────────────────────────────────────────────────────

const FILE_FIELDS = [
  'id',
  'name',
  'mimeType',
  'size',
  'createdTime',
  'modifiedTime',
  'parents',
  'thumbnailLink',
  'webContentLink',
  'imageMediaMetadata',
  'description',
  'appProperties',
].join(',')

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

// ─── Date Taken Helpers ───────────────────────────────────────────────────────
// Drive's `orderBy` param does NOT support imageMediaMetadata.time, so all
// "date taken" sorting has to happen client-side after fetching.

/**
 * Resolves the best-known "date taken" for a file.
 * EXIF's imageMediaMetadata.time is formatted "YYYY:MM:DD HH:MM:SS" (colons in
 * the date part), which Date() can't parse directly, so we normalize it first.
 * Falls back to createdTime/modifiedTime if there's no EXIF date (e.g. screenshots,
 * edited exports with stripped metadata).
 */
export function getDateTaken(file: DriveFile): Date {
  const time = file.imageMediaMetadata?.time
  if (time) {
    const normalized = time.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
    const parsed = new Date(normalized)
    if (!isNaN(parsed.getTime())) return parsed
  }
  return new Date(file.createdTime ?? file.modifiedTime ?? 0)
}

function sortFilesByDateTakenDesc(files: DriveFile[]): DriveFile[] {
  return [...files].sort(
    (a, b) => getDateTaken(b).getTime() - getDateTaken(a).getTime()
  )
}

// ─── Fetch Helpers ────────────────────────────────────────────────────────────

export async function listFilesInFolder(
  folderId: string,
  mimeTypeFilter?: string
): Promise<DriveFile[]> {
  const drive = getDriveClient()
  const files: DriveFile[] = []
  let pageToken: string | undefined

  const mimeQuery = mimeTypeFilter
    ? ` and mimeType = '${mimeTypeFilter}'`
    : ` and (${IMAGE_MIMES.map((m) => `mimeType = '${m}'`).join(' or ')} or mimeType = '${FOLDER_MIME}')`

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false${mimeQuery}`,
      fields: `nextPageToken, files(${FILE_FIELDS})`,
      pageSize: 100,
      pageToken,
      // Not orderBy: 'createdTime desc' anymore — Drive can't sort by EXIF
      // date taken, so we fetch unsorted and sort client-side below.
    })

    const batch = (res.data.files ?? []) as DriveFile[]
    files.push(...batch)
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return files
}

export async function getFileMetadata(fileId: string): Promise<DriveFile> {
  const drive = getDriveClient()
  const res = await drive.files.get({
    fileId,
    fields: FILE_FIELDS,
  })
  return res.data as DriveFile
}

/**
 * Downloads the original file bytes through the Drive API using the service
 * account. Unlike lh3.googleusercontent.com/d/<id>, this works for private
 * files and isn't subject to the CDN's anti-hotlink / datacenter-IP limits.
 */
export async function downloadFileBuffer(
  fileId: string,
  timeoutMs = 20_000
): Promise<Buffer> {
  const drive = getDriveClient()
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer', timeout: timeoutMs }
  )
  return Buffer.from(res.data as ArrayBuffer)
}

// ─── Folder Tree Builder ──────────────────────────────────────────────────────

export async function buildFolderTree(
  rootFolderId: string,
  depth = 0,
  maxDepth = 4
): Promise<DriveFolder> {
  const files = await listFilesInFolder(rootFolderId)

  const subFolders = files.filter((f) => f.mimeType === FOLDER_MIME)
  const images = sortFilesByDateTakenDesc(
    files.filter((f) => IMAGE_MIMES.includes(f.mimeType))
  )

  const children: DriveFolder[] = []

  if (depth < maxDepth) {
    for (const folder of subFolders) {
      const child = await buildFolderTree(folder.id, depth + 1, maxDepth)
      children.push(child)
    }
  }

  const rootInfo = await getFileMetadata(rootFolderId)

  // The folder's "most recent" is whichever is newer: its own newest direct
  // image, or the newest image found anywhere in a descendant subfolder.
  const candidateDates: number[] = []
  if (images.length > 0) {
    candidateDates.push(getDateTaken(images[0]).getTime())
  }
  for (const child of children) {
    if (child.mostRecentDateTaken) {
      candidateDates.push(new Date(child.mostRecentDateTaken).getTime())
    }
  }
  const mostRecentDateTaken =
    candidateDates.length > 0
      ? new Date(Math.max(...candidateDates)).toISOString()
      : undefined

  // Sort subfolders by their most recent image's date taken (recursive), newest first
  children.sort((a, b) => {
    const aTime = a.mostRecentDateTaken
      ? new Date(a.mostRecentDateTaken).getTime()
      : 0
    const bTime = b.mostRecentDateTaken
      ? new Date(b.mostRecentDateTaken).getTime()
      : 0
    return bTime - aTime
  })

  return {
    id: rootFolderId,
    name: rootInfo.name,
    children,
    imageCount: images.length,
    createdTime: rootInfo.createdTime,
    mostRecentDateTaken,
  }
}

// ─── Image Crawl ──────────────────────────────────────────────────────────────

export async function crawlAllImages(
  folderId: string,
  breadcrumb: string[] = []
): Promise<Photo[]> {
  const files = await listFilesInFolder(folderId)

  const subFolders = files.filter((f) => f.mimeType === FOLDER_MIME)
  const imageFiles = sortFilesByDateTakenDesc(
    files.filter((f) => IMAGE_MIMES.includes(f.mimeType))
  )

  const photos: Photo[] = imageFiles.map((f) =>
    driveFileToPhoto(f, folderId, breadcrumb)
  )

  // Sort subfolders by their most recent image (date taken) before recursing,
  // so the flattened result reads newest-folder-first too.
  const foldersWithRecency = await Promise.all(
    subFolders.map(async (folder) => {
      const tree = await buildFolderTree(folder.id, 0, 0) // shallow: just need mostRecentDateTaken
      return { folder, mostRecentDateTaken: tree.mostRecentDateTaken }
    })
  )
  foldersWithRecency.sort((a, b) => {
    const aTime = a.mostRecentDateTaken
      ? new Date(a.mostRecentDateTaken).getTime()
      : 0
    const bTime = b.mostRecentDateTaken
      ? new Date(b.mostRecentDateTaken).getTime()
      : 0
    return bTime - aTime
  })

  for (const { folder } of foldersWithRecency) {
    const subPhotos = await crawlAllImages(folder.id, [
      ...breadcrumb,
      folder.name,
    ])
    photos.push(...subPhotos)
  }

  return photos
}

// ─── Converters ───────────────────────────────────────────────────────────────

export function driveFileToPhoto(
  file: DriveFile,
  folderId: string,
  breadcrumb: string[] = []
): Photo {
  const meta = file.imageMediaMetadata
  const appProps = file.appProperties ?? {}

  const storedMeta: Partial<ImageMetadata> = {}
  if (appProps.tags) storedMeta.tags = JSON.parse(appProps.tags)
  if (appProps.category) storedMeta.category = appProps.category
  if (appProps.altText) storedMeta.altText = appProps.altText
  if (appProps.title) storedMeta.title = appProps.title
  if (appProps.isHero) storedMeta.isHero = appProps.isHero === 'true'
  if (appProps.heroAct)
    storedMeta.heroAct = parseInt(appProps.heroAct) as 1 | 2 | 3
  if (appProps.heroOrder) storedMeta.heroOrder = parseInt(appProps.heroOrder)
  if (appProps.locationPrivate)
    storedMeta.locationPrivate = appProps.locationPrivate === 'true'
  if (appProps.lens) storedMeta.lens = appProps.lens
  if (appProps.camera) storedMeta.camera = appProps.camera

  const width = meta?.width ?? 1920
  const height = meta?.height ?? 1280
  const aspectRatio = width / height

  let location = undefined
  if (meta?.location && storedMeta.locationPrivate !== true) {
    location = {
      latitude: meta.location.latitude,
      longitude: meta.location.longitude,
      altitude: meta.location.altitude,
      placeName: appProps.placeName,
    }
  }

  const imageMetadata: ImageMetadata = {
    iso: meta?.isoSpeed ?? undefined,
    aperture: meta?.aperture ?? undefined,
    shutterSpeed: meta?.exposureTime
      ? formatShutterSpeed(meta.exposureTime)
      : appProps.shutterSpeed,
    lens: appProps.lens ?? meta?.lens ?? undefined,
    camera: appProps.camera
      ? appProps.camera
      : meta?.cameraMake && meta?.cameraModel
        ? `${meta.cameraMake} ${meta.cameraModel}`
        : undefined,
    focalLength: meta?.focalLength ?? undefined,
    location,
    ...storedMeta,
    folderId,
    folderPath: breadcrumb,
    locationPrivate: storedMeta.locationPrivate ?? false,
  }

  return {
    id: file.id,
    driveId: file.id,
    name: file.name,
    width,
    height,
    aspectRatio,
    thumbnailUrl: buildThumbnailUrl(file.id, 800),
    fullUrl: buildThumbnailUrl(file.id, 2048),
    metadata: imageMetadata,
    createdTime: file.createdTime ?? new Date().toISOString(),
    modifiedTime: file.modifiedTime ?? new Date().toISOString(),
  }
}

// ─── URL Builders ─────────────────────────────────────────────────────────────

export function buildThumbnailUrl(fileId: string, size: number) {
  return `/api/images/${fileId}?size=${size}`
}

export function buildDirectUrl(fileId: string) {
  return `/api/images/${fileId}`
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatShutterSpeed(exposureTime: number): string {
  if (exposureTime >= 1) return `${exposureTime}s`
  const denominator = Math.round(1 / exposureTime)
  return `1/${denominator}s`
}

export function formatAperture(aperture?: number): string {
  if (!aperture) return '-'
  return `f/${aperture.toFixed(1)}`
}

export function formatISO(iso?: number): string {
  if (!iso) return '-'
  return `ISO ${iso}`
}

export function formatFocalLength(fl?: number): string {
  if (!fl) return '-'
  return `${fl}mm`
}
