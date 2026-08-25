import { useState, useEffect } from 'react'
import ImageUploader from './ImageUploader'
import PrintAreaSelector, { DEFAULT_PRINT_RECT } from './PrintAreaSelector'
import { adminFetch } from './lib/adminFetch'
import { showToast } from './Toast'
import type { ProductSide } from '../lib/types'
import type { PrintRect } from './types'

interface Draft {
  imageUrl: string
  imageW: number
  imageH: number
  customizable: boolean
  rect: PrintRect
  printWidthIn: number
  printFee: number
}

function draftFromSide(side: ProductSide): Draft {
  return {
    imageUrl: side.image_url,
    imageW: side.image_w,
    imageH: side.image_h,
    customizable: !!side.customizable,
    rect: { print_x: side.print_x, print_y: side.print_y, print_w: side.print_w, print_h: side.print_h },
    printWidthIn: side.print_width_in,
    printFee: side.print_fee,
  }
}

function emptyDraft(defaultPrintFee: number): Draft {
  return {
    imageUrl: '',
    imageW: 0,
    imageH: 0,
    customizable: true,
    rect: { ...DEFAULT_PRINT_RECT },
    printWidthIn: 12,
    printFee: defaultPrintFee,
  }
}

interface ProductSideCardProps {
  productId: number
  side: 'front' | 'back'
  /** Currently-saved row for this side, or null if it hasn't been created yet. */
  data: ProductSide | null
  /** Pre-fills the fee input for a not-yet-saved side. */
  defaultPrintFee: number
  /** Product-level toggle (POD.md §4.4): when the product itself is not
   *  customizable, the Sides section still allows mockup upload but hides
   *  the print-area controls entirely, regardless of the per-side flag. */
  productIsCustomizable: boolean
  /** Saved front-side row, passed to the back card for "Copy from front". */
  frontSide?: ProductSide | null
  onSaved: (side: ProductSide) => void
  onRemoved: () => void
  /** Back card only: lets the parent collapse the card away after removal. */
  removable?: boolean
}

export default function ProductSideCard({
  productId, side, data, defaultPrintFee, productIsCustomizable, frontSide, onSaved, onRemoved, removable,
}: ProductSideCardProps) {
  const [draft, setDraft] = useState<Draft>(() => (data ? draftFromSide(data) : emptyDraft(defaultPrintFee)))
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')

  // Re-sync only when the underlying saved row identity changes (e.g. after
  // the very first successful save, or when switching products) — not on
  // every parent re-render, so in-progress edits aren't clobbered.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setDraft(data ? draftFromSide(data) : emptyDraft(defaultPrintFee))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id])

  const effectiveCustomizable = productIsCustomizable && draft.customizable

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function handleCopyFromFront() {
    if (!frontSide) return
    setDraft((d) => ({
      ...d,
      rect: { print_x: frontSide.print_x, print_y: frontSide.print_y, print_w: frontSide.print_w, print_h: frontSide.print_h },
      printWidthIn: frontSide.print_width_in,
      printFee: frontSide.print_fee,
    }))
  }

  function validate(): string | null {
    if (!draft.imageUrl) return 'Upload a mockup image first.'
    if (effectiveCustomizable) {
      if (draft.rect.print_w <= 0 || draft.rect.print_h <= 0) return 'Draw a print area before saving.'
      if (!Number.isFinite(draft.printWidthIn) || draft.printWidthIn <= 0) return 'Physical print width must be a positive number.'
      if (!Number.isFinite(draft.printFee) || draft.printFee < 0) return 'Print fee must be zero or more.'
    }
    return null
  }

  async function handleSave() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setSaving(true)
    try {
      const body = {
        image_url: draft.imageUrl,
        image_w: draft.imageW,
        image_h: draft.imageH,
        customizable: effectiveCustomizable ? 1 : 0,
        print_x: effectiveCustomizable ? draft.rect.print_x : 0,
        print_y: effectiveCustomizable ? draft.rect.print_y : 0,
        print_w: effectiveCustomizable ? draft.rect.print_w : 0,
        print_h: effectiveCustomizable ? draft.rect.print_h : 0,
        print_width_in: draft.printWidthIn,
        print_fee: effectiveCustomizable ? draft.printFee : 0,
        sort_order: side === 'front' ? 0 : 1,
      }
      const res = await adminFetch(`/api/admin/products/${productId}/sides/${side}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Save failed')
      }
      const saved = await res.json() as ProductSide
      onSaved(saved)
      showToast(`${side === 'front' ? 'Front' : 'Back'} side saved`, 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!data) {
      // Never saved — just tell the parent to drop the card locally.
      onRemoved()
      return
    }
    if (!window.confirm(`Remove the ${side} side? This deletes its mockup and print area.`)) return
    setRemoving(true)
    try {
      const res = await adminFetch(`/api/admin/products/${productId}/sides/${side}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Remove failed')
      onRemoved()
      showToast(`${side === 'front' ? 'Front' : 'Back'} side removed`, 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-800 capitalize">{side} side</h3>
        {removable && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {removing ? 'Removing…' : 'Remove back side'}
          </button>
        )}
      </div>

      <ImageUploader
        prefix="mockups"
        existingUrl={draft.imageUrl || undefined}
        onUploadComplete={({ url, width, height }) => {
          setDraft((d) => ({ ...d, imageUrl: url, imageW: width, imageH: height }))
        }}
      />

      {productIsCustomizable ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.customizable}
            onChange={(e) => update('customizable', e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">This side is customizable</span>
        </label>
      ) : (
        <p className="text-xs text-gray-400 italic">
          Product-level "Customizable" is off in Basics — print-area controls are hidden. This side will just show the mockup.
        </p>
      )}

      {effectiveCustomizable && (
        <div className="space-y-4 pt-1">
          {draft.imageUrl ? (
            <PrintAreaSelector
              imageUrl={draft.imageUrl}
              imageW={draft.imageW}
              imageH={draft.imageH}
              value={draft.rect}
              onChange={(rect) => update('rect', rect)}
              printWidthIn={draft.printWidthIn}
            />
          ) : (
            <p className="text-xs text-gray-400 italic">Upload a mockup to draw the print area.</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Physical print width (inches)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={draft.printWidthIn}
                onChange={(e) => update('printWidthIn', parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Print fee (₹)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={draft.printFee}
                onChange={(e) => update('printFee', parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>
          </div>

          {side === 'back' && frontSide && (
            <button
              type="button"
              onClick={handleCopyFromFront}
              className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:border-gray-500 text-gray-600 transition-colors"
            >
              Copy from front
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : `Save ${side} side`}
        </button>
      </div>
    </div>
  )
}
