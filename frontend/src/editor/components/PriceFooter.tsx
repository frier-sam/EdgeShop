import type { EditorMode, EditorSideName, SidesRuntimeState } from '../types'
import Button from '../../components/Button'

export interface FooterSideFee {
  side: EditorSideName
  label: string
  fee: number
}

export interface PriceFooterProps {
  currency: string
  basePrice: number
  sizeLabel: string | null
  sizeDelta: number
  sides: FooterSideFee[]
  sidesState: SidesRuntimeState
  mode: EditorMode
  onPreview: () => void
  onBackToEdit: () => void
  onAddToCart: () => void
  /** Any designed side has an image below the hard DPI floor (POD.md §5.1 — blocks add-to-cart, warn-only doesn't). */
  blockingDpiIssue: boolean
  /** POD.md §7.2 — true while the add-to-cart sequence (save design, render + upload previews) is in flight. */
  addingToCart?: boolean
  /** Short status text shown next to the total while `addingToCart` is true, e.g. "Uploading previews…". */
  addingToCartStatus?: string
}

/**
 * POD.md §6.7 — live price footer: base + size delta + one print fee per
 * side that currently has >=1 object. Also doubles as the mode's primary
 * action bar: "Preview" while editing, "Back to editing" / "Add to cart"
 * once in preview (POD.md §6.8).
 */
export default function PriceFooter({
  currency,
  basePrice,
  sizeLabel,
  sizeDelta,
  sides,
  sidesState,
  mode,
  onPreview,
  onBackToEdit,
  onAddToCart,
  blockingDpiIssue,
  addingToCart = false,
  addingToCartStatus,
}: PriceFooterProps) {
  const activeFees = sides.filter((s) => (sidesState[s.side]?.objectCount ?? 0) > 0)
  const total = basePrice + sizeDelta + activeFees.reduce((sum, s) => sum + s.fee, 0)
  const fmt = (n: number) => `${currency}${n.toFixed(2)}`

  return (
    <div className="flex flex-col gap-3 border-t border-line bg-paper px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-lg font-semibold text-ink">{fmt(total)}</span>
          {sizeLabel && <span className="text-xs text-ink-soft">Size {sizeLabel}</span>}
        </div>
        <p className="truncate text-xs text-ink-soft">
          {fmt(basePrice)} base
          {sizeDelta !== 0 && ` + ${fmt(sizeDelta)} size`}
          {activeFees.map((s) => ` + ${fmt(s.fee)} ${s.label.toLowerCase()} print`).join('')}
        </p>
        {blockingDpiIssue && mode === 'preview' && (
          <p className="mt-0.5 text-xs font-medium text-danger">Fix the low-resolution image before adding to cart.</p>
        )}
        {addingToCart && addingToCartStatus && (
          <p className="mt-0.5 text-xs font-medium text-ink-soft">{addingToCartStatus}</p>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        {mode === 'edit' ? (
          <Button variant="accent" size="lg" onClick={onPreview}>
            Preview
          </Button>
        ) : (
          <>
            <Button variant="outline" size="lg" onClick={onBackToEdit} disabled={addingToCart}>
              Back to editing
            </Button>
            <Button variant="accent" size="lg" onClick={onAddToCart} disabled={blockingDpiIssue || addingToCart}>
              {addingToCart ? 'Adding…' : 'Add to cart'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
