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

export function formatShutterSpeed(exposureTime: number): string {
  if (exposureTime >= 1) return `${exposureTime}s`
  return `1/${Math.round(1 / exposureTime)}s`
}

export function buildThumbnailUrl(fileId: string, size: number) {
  return `/api/images/${fileId}?size${size}`
}

export function buildDirectUrl(fileId: string) {
  return `/api/images/${fileId}`
}