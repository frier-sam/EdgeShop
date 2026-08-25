import { useState, useRef, type DragEvent } from 'react'
import { processImage } from '../utils/imageProcessor'
import { adminFetch } from './lib/adminFetch'
import Button from '../components/Button'

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

export default function ImageUploader({ onUploadComplete, existingUrl, prefix }: Props) {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [preview, setPreview] = useState<string>(existingUrl ?? '')
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

  const statusText: Record<UploadStatus, string> = {
    idle: 'Click or drag an image (PNG, JPG)',
    processing: 'Optimising to WebP…',
    uploading: 'Uploading…',
    done: 'Upload complete',
    error: errorMsg || 'Upload failed. Try again.',
  }
  const busy = status === 'processing' || status === 'uploading'

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="rounded-card border-2 border-dashed border-line p-6 text-center transition-colors duration-fast hover:border-ink-faint"
    >
      {preview && (
        <img src={preview} alt="Preview" className="mx-auto mb-4 max-h-40 rounded-btn object-contain" />
      )}
      <p className={`mb-3 text-sm ${status === 'error' ? 'text-danger' : status === 'done' ? 'text-success' : 'text-ink-soft'}`}>
        {statusText[status]}
      </p>
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
      <Button type="button" variant="primary" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Working…' : 'Choose image'}
      </Button>
    </div>
  )
}
