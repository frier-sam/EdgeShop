import { useState } from 'react'
import { adminFetch } from './lib/adminFetch'
import ImageUploader from './ImageUploader'
import IconButton from '../components/ui/IconButton'
import Icon from '../components/ui/Icon'
import type { ProductImage } from '../lib/types'

const MAX_IMAGES = 8

/**
 * Storefront photos for a product — what shoppers see in the product page
 * gallery and on listing cards. Deliberately separate from the front/back
 * MOCKUPS in the Customization section, which only the customizer draws on.
 * With no photos here the storefront falls back to those mockups.
 *
 * Every change (add, remove, reorder) saves immediately: the whole ordered
 * list is PUT, so there is no unsaved state to lose.
 */
export default function ProductImagesEditor({
  productId,
  images,
  onSaved,
}: {
  productId: number
  images: ProductImage[]
  onSaved: (images: ProductImage[]) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploaderKey, setUploaderKey] = useState(0)

  async function persist(next: Array<Pick<ProductImage, 'image_url' | 'image_w' | 'image_h'>>) {
    setSaving(true)
    setError('')
    try {
      const res = await adminFetch(`/api/admin/products/${productId}/images`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: next }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Save failed')
      onSaved(((await res.json()) as { images: ProductImage[] }).images)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const move = (i: number, dir: -1 | 1) => {
    const next = [...images]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    persist(next)
  }

  return (
    <div className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <p className="text-xs text-ink-soft">
        These are the photos customers see on the website. The first one is the cover. If you add none, the
        customization mockups below are shown instead.
      </p>

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="space-y-1.5">
              <div className="relative aspect-square overflow-hidden rounded-btn border border-line bg-surface-2">
                <img src={img.image_url} alt={`Product photo ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1 top-1 rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase text-surface">
                    Cover
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <IconButton variant="ghost" size="sm" aria-label="Move earlier" disabled={saving || i === 0} onClick={() => move(i, -1)}>
                    <Icon name="arrow_back" size={16} />
                  </IconButton>
                  <IconButton variant="ghost" size="sm" aria-label="Move later" disabled={saving || i === images.length - 1} onClick={() => move(i, 1)}>
                    <Icon name="arrow_forward" size={16} />
                  </IconButton>
                </div>
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label="Remove photo"
                  className="text-danger hover:bg-danger-soft"
                  disabled={saving}
                  onClick={() => persist(images.filter((_, k) => k !== i))}
                >
                  <Icon name="delete" size={16} />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {images.length < MAX_IMAGES ? (
        <ImageUploader
          key={uploaderKey}
          prefix="mockups"
          onUploadComplete={({ url, width, height }) => {
            setUploaderKey((k) => k + 1)
            persist([...images, { image_url: url, image_w: width, image_h: height }])
          }}
        />
      ) : (
        <p className="text-xs text-ink-soft">Maximum of {MAX_IMAGES} photos reached.</p>
      )}
      {saving && <p className="text-xs text-ink-soft">Saving…</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
