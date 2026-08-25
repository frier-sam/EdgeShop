import { useState, useRef, type DragEvent } from 'react'
import { processImage } from '../utils/imageProcessor'
import { adminFetch } from './lib/adminFetch'

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
    uploading: 'Uploading to R2…',
    done: 'Upload complete!',
    error: errorMsg || 'Upload failed. Try again.',
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
    >
      {preview && (
        <img src={preview} alt="Preview" className="mx-auto mb-4 max-h-40 object-contain rounded" />
      )}
      <p className={`text-sm mb-3 ${status === 'error' ? 'text-red-500' : status === 'done' ? 'text-green-600' : 'text-gray-500'}`}>
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
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === 'processing' || status === 'uploading'}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        {status === 'processing' || status === 'uploading' ? 'Working...' : 'Choose Image'}
      </button>
    </div>
  )
}
