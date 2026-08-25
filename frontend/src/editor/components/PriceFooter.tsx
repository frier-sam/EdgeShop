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
 *
 * POD-UI.md §3 Workstream C5 — migrated to the new `Button` API (variants
 * primary/secondary/ghost/danger), the total re-plays a pop animation
 * whenever it changes value (i.e. a side gains/loses its first/last
 * object and its print fee drops in or out), and the fee breakdown wraps
 * onto multiple lines instead of truncating so every line item stays
 * legible down to 360px.
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
    <div className="flex flex-col gap-3 border-t border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {/* Remounting on `total` replays the `badge-pop` keyframe each time
              the price actually changes value (e.g. the back side gains its
              first object and its print fee joins the total) — a cheap,
              robust way to animate a value change without a tween library. */}
          <span key={total} className="animate-badge-pop text-lg font-semibold text-ink">
            {fmt(total)}
          </span>
          {sizeLabel && <span className="text-xs text-ink-soft">Size {sizeLabel}</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-ink-soft">
          <span>{fmt(basePrice)} base</span>
          {sizeDelta !== 0 && <span>+ {fmt(sizeDelta)} size</span>}
          {activeFees.map((s) => (
            <span key={s.side}>
              + {fmt(s.fee)} {s.label.toLowerCase()} print
            </span>
          ))}
        </div>
        {blockingDpiIssue && mode === 'preview' && (
          <p className="mt-0.5 text-xs font-medium text-danger">Fix the low-resolution image before adding to cart.</p>
        )}
        {addingToCart && addingToCartStatus && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-ink-soft">
            <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-ink-faint border-t-ink-soft" aria-hidden="true" />
            {addingToCartStatus}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {mode === 'edit' ? (
          <Button variant="primary" size="lg" fullWidth onClick={onPreview} className="sm:w-auto">
            Preview
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="md" onClick={onBackToEdit} disabled={addingToCart}>
              Back to editing
            </Button>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="sm:w-auto"
              loading={addingToCart}
              disabled={blockingDpiIssue}
              onClick={onAddToCart}
            >
              Add to cart
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
