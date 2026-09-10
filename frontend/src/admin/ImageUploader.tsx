import { useState, useRef, type DragEvent } from 'react'
import { processImage } from '../utils/imageProcessor'
import { adminFetch } from './lib/adminFetch'
import IconButton from '../components/ui/IconButton'
import Icon from '../components/ui/Icon'

export interface UploadResult {
  url: string
  /** Natural width/height of the uploaded (already browser-resized) WebP —
   *  i.e. exactly what /img/<key> will serve. POD.md §6.1 requires these on
   *  product_sides (image_w/image_h) since the print-area math is defined
   *  in fractions of them, not of the original file's dimensions. */
  width: number
  height: number
}

interface Props {
  onUploadComplete: (result: UploadResult) => void
  existingUrl?: string
  /** R2 key prefix — validated server-side against an allow-list
   *  (worker/src/routes/admin/upload.ts). Product mockups always use
   *  'mockups'. */
  prefix: string
  /** POD-UI4.md §5 D.6 (A10) — the comp's uploaded-file row carries a
   *  delete action. Optional: a caller with nothing sensible to do on
   *  removal (there is none today) simply omits it and the row renders
   *  with no delete control, same as before this restyle. */
  onRemove?: () => void
}

type UploadStatus = 'idle' | 'processing' | 'uploading' | 'done' | 'error'

// Reads the natural pixel dimensions of an already-processed image blob by
// decoding it in an offscreen <img>. Since processImage() has already
// resized to maxWidth, these dimensions are exactly what gets stored in R2
// and served from /img/<key> — not the original file's dimensions.
function readImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image dimensions'))
    }
    img.src = url
  })
}

/** Label for the uploaded-file row when there's no in-session `File.name`
 *  (e.g. the page just loaded with an already-saved mockup) — the last
 *  path segment of the served URL, or a generic fallback if that fails. */
function labelForPreview(url: string, fileName: string): string {
  if (fileName) return fileName
  try {
    const last = new URL(url, window.location.origin).pathname.split('/').pop()
    return last || 'Uploaded image'
  } catch {
    return 'Uploaded image'
  }
}

export default function ImageUploader({ onUploadComplete, existingUrl, prefix, onRemove }: Props) {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [preview, setPreview] = useState<string>(existingUrl ?? '')
  const [fileName, setFileName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file')
      setStatus('error')
      return
    }
    setStatus('processing')
    setErrorMsg('')
    try {
      const webpBlob = await processImage(file)
      const { width, height } = await readImageDimensions(webpBlob)
      const previewUrl = URL.createObjectURL(webpBlob)
      setPreview(previewUrl)
      setFileName(file.name)

      setStatus('uploading')
      const presignRes = await adminFetch('/api/admin/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, prefix }),
      })
      if (!presignRes.ok) throw new Error('Failed to get upload key')
      const { key } = await presignRes.json() as { key: string }

      const uploadRes = await adminFetch(`/api/admin/upload/put?key=${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/webp' },
        body: webpBlob,
      })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const { url } = await uploadRes.json() as { url: string }
      onUploadComplete({ url, width, height })
      setStatus('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Upload failed')
      setStatus('error')
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleRemove() {
    setPreview('')
    setFileName('')
    setStatus('idle')
    setErrorMsg('')
    onRemove?.()
  }

  const statusText: Record<UploadStatus, string> = {
    idle: '',
    processing: 'Optimising to WebP…',
    uploading: 'Uploading…',
    done: 'Upload complete',
    error: errorMsg || 'Upload failed. Try again.',
  }
  const busy = status === 'processing' || status === 'uploading'

  return (
    <div className="space-y-3">
      {/* POD-UI4.md §5 D.6 (A10) — the comp's dashed dropzone. A real
          <button>, not a styled <div>, so the whole box stays a single
          keyboard- and screen-reader-reachable control while still
          accepting a drag-and-drop file exactly as before. */}
      <button
        type="button"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-busy={busy}
        className="group w-full rounded-lg border-2 border-dashed border-line p-8 text-center transition-colors duration-fast hover:border-ink-faint hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon name="cloud_upload" size={36} className="mx-auto mb-2 text-ink-faint transition-transform duration-fast group-hover:scale-110" />
        <p className="font-label text-label-md text-ink-soft">Drop PNG/WebP files here</p>
        <p className="mt-1 text-xs text-ink-faint">Recommended: at least 1000px on the longest side</p>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />

      {statusText[status] && (
        <p className={`text-sm ${status === 'error' ? 'text-danger' : status === 'done' ? 'text-success' : 'text-ink-soft'}`}>
          {statusText[status]}
        </p>
      )}

      {preview && (
        <div className="flex items-center justify-between gap-3 rounded-btn border border-line bg-surface-2 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={preview} alt="Uploaded mockup preview" className="h-12 w-12 shrink-0 rounded-btn object-cover" />
            <span className="truncate text-sm text-ink-soft">{labelForPreview(preview, fileName)}</span>
          </div>
          {onRemove && (
            <IconButton variant="ghost" size="sm" aria-label="Remove image" className="shrink-0 text-danger hover:bg-danger-soft" onClick={handleRemove}>
              <Icon name="delete" size={16} />
            </IconButton>
          )}
        </div>
      )}
    </div>
  )
}
