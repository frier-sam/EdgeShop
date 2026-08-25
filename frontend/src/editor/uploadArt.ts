// frontend/src/editor/uploadArt.ts
//
// POD.md §6.5 / §5.9 — customer art is uploaded at drop time, not at
// add-to-cart, so the editor always holds a stable same-origin URL and
// design_json never carries base64 image data.
//
// `POST /api/uploads/art` (POD.md §7.1) now exists for real. The Phase 6
// 404-fallback that returned a local `URL.createObjectURL` blob has been
// removed: design_json only ever references same-origin `/img/uploads/...`
// URLs from here on, since the merchant's print render (and the checkout
// price re-validation, which reads the design's stored art) depends on
// those URLs actually resolving.

export interface UploadArtResult {
  url: string
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
    throw new UploadArtError('Could not reach the server. Check your connection and try again.')
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new UploadArtError(data.error ?? `Upload failed (${res.status}).`)
  }

  const data = (await res.json()) as { url?: string }
  if (!data.url) {
    throw new UploadArtError('Upload response was missing a url.')
  }
  return { url: data.url }
}

export const ACCEPTED_ART_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const

export function isAcceptedArtFile(file: File): boolean {
  if (ACCEPTED_ART_MIME_TYPES.includes(file.type as (typeof ACCEPTED_ART_MIME_TYPES)[number])) return true
  // Some browsers/OSes don't set a MIME type for .svg dropped from disk.
  return /\.svg$/i.test(file.name) && (file.type === '' || file.type === 'text/xml' || file.type === 'application/xml')
}
