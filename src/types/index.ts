// ─── Google Drive Types ───────────────────────────────────────────────────────

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  createdTime?: string
  modifiedTime?: string
  parents?: string[]
  thumbnailLink?: string
  webContentLink?: string
  imageMediaMetadata?: DriveImageMetadata
  description?: string
  appProperties?: Record<string, string>
}

export interface DriveImageMetadata {
  width?: number
  height?: number
  rotation?: number
  location?: {
    latitude: number
    longitude: number
    altitude: number
  }
  time?: string
  cameraMake?: string
  cameraModel?: string
  exposureTime?: number
  aperture?: number
  flashUsed?: boolean
  focalLength?: number
  isoSpeed?: number
  meteringMode?: string
  sensor?: string
  exposureMode?: number
  colorSpace?: number
  whiteBalance?: number
  exposureBias?: number
  maxApertureValue?: number
  subjectDistance?: number
  lens?: string
}

export interface DriveFolder {
  id: string
  name: string
  children?: DriveFolder[]
  imageCount?: number
  createdTime?: string
}

// ─── Image & Metadata Types ───────────────────────────────────────────────────

export interface ExifData {
  iso?: number
  aperture?: number
  shutterSpeed?: string
  lens?: string
  camera?: string
  focalLength?: number
  location?: LocationData
}

export interface LocationData {
  latitude: number
  longitude: number
  altitude?: number
  placeName?: string
}

export interface ImageMetadata extends ExifData {
  title?: string
  altText?: string
  tags?: string[]
  category?: string
  folderId?: string
  folderPath?: string[]
  isHero?: boolean
  heroAct?: 1 | 2 | 3
  heroOrder?: number
  locationPrivate?: boolean
  publishedAt?: string
}

export interface Photo {
  id: string
  driveId: string
  name: string
  width: number
  height: number
  aspectRatio: number
  thumbnailUrl: string
  fullUrl: string
  metadata: ImageMetadata
  createdTime: string
  modifiedTime: string
}

export interface PhotoWithFolder extends Photo {
  folder?: DriveFolder
  breadcrumb?: string[]
}

// ─── Gallery Types ────────────────────────────────────────────────────────────

export interface GalleryAct {
  act: 1 | 2 | 3
  title: string
  description: string
  photos: Photo[]
}

export interface CuratedGallery {
  acts: GalleryAct[]
  totalPhotos: number
  lastUpdated: string
}

export interface GalleryFilter {
  search?: string
  tags?: string[]
  category?: string
  folderId?: string
  hasLocation?: boolean
  sortBy?: 'date' | 'name' | 'custom'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface PaginatedPhotos {
  photos: Photo[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// ─── Admin / Management Types ─────────────────────────────────────────────────

export interface MetadataUpdate {
  photoId: string
  metadata: Partial<ImageMetadata>
}

export interface FolderAssignment {
  photoId: string
  folderId: string
}

export interface BulkOperation {
  photoIds: string[]
  operation: 'tag' | 'categorize' | 'hero' | 'delete-metadata'
  value?: string | boolean
}

export interface AdminStats {
  totalPhotos: number
  totalFolders: number
  heroPhotos: number
  untaggedPhotos: number
  missingAltText: number
  privateLocations: number
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface DriveApiResponse {
  files: DriveFile[]
  nextPageToken?: string
}

// ─── UI Component Types ───────────────────────────────────────────────────────

export interface MasonryColumn {
  photos: Photo[]
  columnIndex: number
}

export interface PhotoCardProps {
  photo: Photo
  priority?: boolean
  showMeta?: boolean
  onClick?: (photo: Photo) => void
  className?: string
}

export interface MetadataOverlayProps {
  photo: Photo
  isOpen: boolean
  onClose: () => void
}

export interface FilterState {
  search: string
  tags: string[]
  category: string | null
  folderId: string | null
  page: number
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface AdminSession {
  user: {
    email: string
    name: string
    role: 'admin'
  }
  expires: string
}
