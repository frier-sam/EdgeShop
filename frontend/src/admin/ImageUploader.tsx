import { useState, useRef, type DragEvent } from 'react'
import { processImage } from '../utils/imageProcessor'

interface Props {
  onUploadComplete: (url: string) => void
  existingUrl?: string
}

type UploadStatus = 'idle' | 'processing' | 'uploading' | 'done' | 'error'

export default function ImageUploader({ onUploadComplete, existingUrl }: Props) {
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
      const previewUrl = URL.createObjectURL(webpBlob)
      setPreview(previewUrl)

      setStatus('uploading')
      const presignRes = await fetch('/api/admin/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name }),
      })
      if (!presignRes.ok) throw new Error('Failed to get upload key')
      const { key } = await presignRes.json() as { key: string }

      const uploadRes = await fetch(`/api/admin/upload/put?key=${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/webp' },
        body: webpBlob,
      })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const { url } = await uploadRes.json() as { url: string }
      onUploadComplete(url)
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
