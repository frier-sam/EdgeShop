import { useState, useEffect } from 'react'
import ImageUploader from './ImageUploader'
import PrintAreaSelector, { DEFAULT_PRINT_RECT } from './PrintAreaSelector'
import { adminFetch } from './lib/adminFetch'
import { showToast } from './Toast'
import Field from '../components/Field'
import Button from '../components/Button'
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
    <div className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold capitalize text-ink">{side} side</h3>
        {removable && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="text-xs font-medium text-danger transition-colors duration-fast hover:text-danger/80 disabled:opacity-50"
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
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={draft.customizable}
            onChange={(e) => update('customizable', e.target.checked)}
            className="h-4 w-4 rounded border-line text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          />
          <span className="text-sm text-ink">This side is customizable</span>
        </label>
      ) : (
        <p className="text-xs italic text-ink-faint">
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
            <p className="text-xs italic text-ink-faint">Upload a mockup to draw the print area.</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Physical print width (inches)"
              type="number"
              min="0.1"
              step="0.1"
              value={draft.printWidthIn}
              onChange={(e) => update('printWidthIn', parseFloat(e.target.value) || 0)}
            />
            <Field
              label="Print fee (₹)"
              type="number"
              min="0"
              step="1"
              value={draft.printFee}
              onChange={(e) => update('printFee', parseFloat(e.target.value) || 0)}
            />
          </div>

          {side === 'back' && frontSide && (
            <Button type="button" variant="secondary" size="sm" onClick={handleCopyFromFront}>
              Copy from front
            </Button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="primary" loading={saving} onClick={handleSave}>
          Save {side} side
        </Button>
      </div>
    </div>
  )
}
