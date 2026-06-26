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
      orderBy: 'createdTime desc',
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

// ─── Folder Tree Builder ──────────────────────────────────────────────────────

export async function buildFolderTree(
  rootFolderId: string,
  depth = 0,
  maxDepth = 4
): Promise<DriveFolder> {
  const files = await listFilesInFolder(rootFolderId)

  const subFolders = files.filter((f) => f.mimeType === FOLDER_MIME)
  const images = files.filter((f) => IMAGE_MIMES.includes(f.mimeType))

  const children: DriveFolder[] = []

  if (depth < maxDepth) {
    for (const folder of subFolders) {
      const child = await buildFolderTree(folder.id, depth + 1, maxDepth)
      children.push(child)
    }
  }

  const rootInfo = await getFileMetadata(rootFolderId)

  return {
    id: rootFolderId,
    name: rootInfo.name,
    children,
    imageCount: images.length,
    createdTime: rootInfo.createdTime,
  }
}

// ─── Image Crawl ──────────────────────────────────────────────────────────────

export async function crawlAllImages(
  folderId: string,
  breadcrumb: string[] = []
): Promise<Photo[]> {
  const files = await listFilesInFolder(folderId)

  const subFolders = files.filter((f) => f.mimeType === FOLDER_MIME)
  const imageFiles = files.filter((f) => IMAGE_MIMES.includes(f.mimeType))

  const photos: Photo[] = imageFiles.map((f) =>
    driveFileToPhoto(f, folderId, breadcrumb)
  )

  for (const folder of subFolders) {
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

  // Parse stored metadata from appProperties
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

  // Build location (respects privacy toggle)
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

export function buildThumbnailUrl(fileId: string, size: number): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=s${size}`
}

export function buildDirectUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`
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
