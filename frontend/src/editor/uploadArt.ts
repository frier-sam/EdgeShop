// frontend/src/editor/uploadArt.ts
//
// POD.md §6.5 / §5.9 — customer art is uploaded at drop time, not at
// add-to-cart, so the editor always holds a stable same-origin URL and
// design_json never carries base64 image data.
//
// `POST /api/uploads/art` is a Phase 7 endpoint (POD.md §8, Phase 7.1) —
// it does not exist yet. Until it ships, a 404 (or the route being
// entirely absent in dev) falls back to a local `URL.createObjectURL`
// blob so the editor is fully usable and testable today.
//
// >>> PHASE 7 TODO: once POST /api/uploads/art exists, delete the
// >>> `usedFallback` branch below (and the object-URL revocation dance in
// >>> the image tool) — every upload should then always return a real
// >>> same-origin /img/uploads/<uuid>.<ext> URL.

export interface UploadArtResult {
  url: string
  usedFallback: boolean
}

export class UploadArtError extends Error {}

/**
 * @param blob The file contents to upload (a raw File for raster images, or
 *   a freshly-built Blob of *sanitized* SVG text — never the raw uploaded
 *   SVG file, see sanitizeSvg.ts).
 * @param filename Original filename, used for the multipart field and to
 *   preserve the extension server-side.
 * @param maxSizeMb From the `max_art_upload_mb` setting (POD.md §6.3).
 */
export async function uploadArt(blob: Blob, filename: string, maxSizeMb: number): Promise<UploadArtResult> {
  if (blob.size > maxSizeMb * 1024 * 1024) {
    throw new UploadArtError(`File is larger than ${maxSizeMb}MB.`)
  }

  const formData = new FormData()
  formData.append('file', blob, filename)

  let res: Response
  try {
    res = await fetch('/api/uploads/art', { method: 'POST', body: formData })
  } catch {
    // Network-level failure (route not mounted at all in this dev worker, etc).
    return { url: URL.createObjectURL(blob), usedFallback: true }
  }

  if (res.status === 404) {
    return { url: URL.createObjectURL(blob), usedFallback: true }
  }
  if (!res.ok) {
    throw new UploadArtError(`Upload failed (${res.status}).`)
  }

  const data = (await res.json()) as { url?: string }
  if (!data.url) {
    throw new UploadArtError('Upload response was missing a url.')
  }
  return { url: data.url, usedFallback: false }
}

export const ACCEPTED_ART_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const

export function isAcceptedArtFile(file: File): boolean {
  if (ACCEPTED_ART_MIME_TYPES.includes(file.type as (typeof ACCEPTED_ART_MIME_TYPES)[number])) return true
  // Some browsers/OSes don't set a MIME type for .svg dropped from disk.
  return /\.svg$/i.test(file.name) && (file.type === '' || file.type === 'text/xml' || file.type === 'application/xml')
}
