// POD-V2.md §5 — bulk pricing tiers. Modelled closely on
// ProductSizesEditor.tsx: same client-side row-keying (`key`, stripped
// before the PUT), same "validate locally before hitting the server"
// shape, same save/dirty handling (this component owns `rows` from mount
// and never re-derives it from a background refetch).
//
// Two differences from ProductSizesEditor that follow straight from the
// schema (§5): there is no `sort_order` column on `product_price_breaks`
// — order is *derived* from `min_qty`, not chosen by the admin — so there
// are no move-up/move-down controls here, only add/remove; and there is a
// second, non-blocking warning (§9.1) that ProductSizesEditor has no
// equivalent of, because axis-1 price deltas were never at risk of
// contradicting the print cost the way an all-in bulk tier can.
import { useState } from 'react'
import { adminFetch } from './lib/adminFetch'
import { showToast } from './Toast'
import Button from '../components/Button'
import IconButton from '../components/ui/IconButton'
import Icon from '../components/ui/Icon'
import type { ProductPriceBreak, ProductSide } from '../lib/types'
import type { PriceBreakDraftRow } from './types'

function rowsFromBreaks(breaks: ProductPriceBreak[]): PriceBreakDraftRow[] {
  return breaks.map((b) => ({ key: `b${b.id}`, min_qty: b.min_qty, unit_price: b.unit_price }))
}

function newKey(): string {
  return `n${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

// Mirrors the server-side validation the worker agent is adding to PUT
// /:id/price_breaks (min_qty >= 1, unique tiers) — see the API contract
// in this phase's task brief.
export function validatePriceBreakRows(rows: PriceBreakDraftRow[]): string | null {
  const seen = new Set<number>()
  for (const r of rows) {
    if (!Number.isFinite(r.min_qty) || !Number.isInteger(r.min_qty) || r.min_qty < 1) {
      return 'Minimum quantity must be a whole number of 1 or more.'
    }
    if (seen.has(r.min_qty)) return `Duplicate tier: two rows start at ${r.min_qty}.`
    seen.add(r.min_qty)
    if (!Number.isFinite(r.unit_price) || r.unit_price < 0) {
      return `Unit price for the ${r.min_qty}+ tier must be zero or more.`
    }
  }
  return null
}

// POD-V2.md §9.1 — the print fees this product would charge a customer
// per unit if every side were used, summed. Only sides the merchant has
// actually marked customizable accrue a fee (an uncustomizable mockup-only
// side costs nothing to print). This is the product's worst-case
// per-unit printing cost: a front+back design pays both fees, a
// front-only one pays less — the warning below deliberately compares
// against this ceiling rather than trying to guess which sides a given
// order will use, because the tier price is set once for every design.
export function sumPrintFees(sides: Pick<ProductSide, 'customizable' | 'print_fee'>[]): number {
  return sides.filter((s) => !!s.customizable).reduce((sum, s) => sum + (Number.isFinite(s.print_fee) ? s.print_fee : 0), 0)
}

/** POD-V2.md §9.1 — true when a tier's absolute all-in price would not
 *  even cover the product's summed per-side print fees, before base cost
 *  is considered at all. Non-blocking: the decision log explicitly
 *  reaffirms this is allowed, the admin just needs to see it. */
export function isTierBelowPrintFees(unitPrice: number, feeSum: number): boolean {
  return feeSum > 0 && Number.isFinite(unitPrice) && unitPrice < feeSum
}

/** POD-UI4.md §5 D.6 (A8) — the comp's "₹640.00" line-total figure: what
 *  buying exactly `minQty` units at this tier's all-in unit price comes
 *  to. Returns null (never NaN/Infinity) for a row that isn't a valid
 *  number yet — e.g. mid-edit with an empty quantity field. */
export function computeLineTotal(minQty: number, unitPrice: number): number | null {
  if (!Number.isFinite(minQty) || !Number.isFinite(unitPrice) || minQty < 0 || unitPrice < 0) return null
  return minQty * unitPrice
}

/** POD-UI4.md §5 D.6 (A8) — savings percentage against the FIRST
 *  (lowest-`min_qty`) tier, the comp's "3% savings" pattern. Guarded so a
 *  zero, missing, or non-finite first-tier price can never produce
 *  `NaN`/`Infinity`/a negative-looking badge: returns null (render
 *  nothing) whenever there's nothing meaningful to compare against, or
 *  when this tier is at or above the first tier's price (the first tier
 *  itself included — it has nothing to save against its own price). */
export function computeSavingsPercent(unitPrice: number, firstTierUnitPrice: number): number | null {
  if (!Number.isFinite(unitPrice) || !Number.isFinite(firstTierUnitPrice) || firstTierUnitPrice <= 0) return null
  const percent = ((firstTierUnitPrice - unitPrice) / firstTierUnitPrice) * 100
  if (!Number.isFinite(percent) || percent <= 0) return null
  return percent
}

const ROW_INPUT_CLASSES =
  'h-11 w-full rounded-btn border border-line bg-surface px-3 text-sm text-ink transition-colors duration-fast ' +
  'focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/30'

interface ProductPriceBreaksEditorProps {
  productId: number
  initialPriceBreaks: ProductPriceBreak[]
  /** The product's own sides (already loaded by AdminProductEdit for the
   *  Sides section) — passed straight through so the §9.1 warning can be
   *  computed with no extra fetch. */
  sides: ProductSide[]
  onSaved: (priceBreaks: ProductPriceBreak[]) => void
}

export default function ProductPriceBreaksEditor({ productId, initialPriceBreaks, sides, onSaved }: ProductPriceBreaksEditorProps) {
  const [rows, setRows] = useState<PriceBreakDraftRow[]>(() => rowsFromBreaks(initialPriceBreaks))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const feeSum = sumPrintFees(sides)

  function updateRow(key: string, patch: Partial<PriceBreakDraftRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    // Seed a new tier one step past the current highest min_qty rather
    // than at 0 — 0 would immediately collide with "no tiers apply yet"
    // semantics and is never a valid opaque quantity anyway.
    const highest = rows.reduce((max, r) => Math.max(max, r.min_qty), 0)
    setRows((rs) => [...rs, { key: newKey(), min_qty: highest > 0 ? highest * 2 : 100, unit_price: 0 }])
  }

  // Rows are only ever removed here, from an explicit click — never as a
  // side effect of the capability checkbox in AdminProductEdit.tsx being
  // unticked. See the identical note in ProductVariantsEditor.tsx.
  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r.key !== key))
  }

  async function handleSave() {
    const validationError = validatePriceBreakRows(rows)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setSaving(true)
    try {
      // Sorted by min_qty on the wire even though the table has no
      // sort_order — there's nothing else to order by, and it keeps the
      // saved rows readable if ever inspected directly.
      const sorted = [...rows].sort((a, b) => a.min_qty - b.min_qty)
      const res = await adminFetch(`/api/admin/products/${productId}/price_breaks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_breaks: sorted.map((r) => ({ min_qty: r.min_qty, unit_price: r.unit_price })),
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? 'Save failed')
      }
      const data = (await res.json()) as { price_breaks: ProductPriceBreak[] }
      setRows(rowsFromBreaks(data.price_breaks))
      onSaved(data.price_breaks)
      showToast('Bulk pricing saved', 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // Display order follows min_qty (§5: "the tiers effectively become the
  // quantity picker") even though the underlying `rows` array keeps
  // insertion order while editing — resorting on every keystroke would
  // make a row jump around mid-edit as its min_qty changes.
  const displayRows = [...rows].sort((a, b) => a.min_qty - b.min_qty)
  const firstTierUnitPrice = displayRows[0]?.unit_price ?? NaN

  return (
    <div className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-ink">Bulk pricing</h2>
        <Button type="button" variant="secondary" size="sm" onClick={addRow}>
          + Add tier
        </Button>
      </div>
      <p className="-mt-2 text-xs text-ink-soft">
        Unit price is <strong className="font-semibold text-ink">absolute and all-in</strong> — it replaces base price + printing
        entirely at that quantity, it does not add on top. Any per-option price difference (say an XL surcharge) still applies on
        top of the tier price.
      </p>

      {rows.length === 0 ? (
        <p className="text-xs italic text-ink-faint">No bulk tiers — this product is priced at the flat base price regardless of quantity.</p>
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1fr_auto] gap-2 px-1 text-[11px] uppercase tracking-wide text-ink-faint sm:grid">
            <span>Min qty</span>
            <span>Unit price (₹) — all-in, incl. printing</span>
            <span></span>
          </div>
          {displayRows.map((row) => {
            const belowFees = isTierBelowPrintFees(row.unit_price, feeSum)
            const lineTotal = computeLineTotal(row.min_qty, row.unit_price)
            const savings = computeSavingsPercent(row.unit_price, firstTierUnitPrice)
            return (
              <div key={row.key} className="rounded-btn border border-line p-3">
                <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={row.min_qty}
                    onChange={(e) => updateRow(row.key, { min_qty: parseInt(e.target.value, 10) || 0 })}
                    aria-label="Minimum quantity"
                    className={ROW_INPUT_CLASSES}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.unit_price}
                    onChange={(e) => updateRow(row.key, { unit_price: parseFloat(e.target.value) || 0 })}
                    aria-label="Unit price, all-in including printing"
                    className={ROW_INPUT_CLASSES}
                  />
                  <div className="col-span-2 flex justify-end sm:col-span-1">
                    <IconButton variant="ghost" size="sm" onClick={() => removeRow(row.key)} aria-label="Remove tier" className="text-danger hover:bg-danger-soft">
                      <Icon name="delete" size={16} />
                    </IconButton>
                  </div>
                </div>

                {/* POD-UI4.md §5 D.6 (A8) — the comp's "₹640.00 / ₹320.00 per
                    unit / 3% savings" line, computed live from the two
                    inputs above rather than re-typed anywhere. */}
                <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-base font-semibold text-ink">
                    {lineTotal != null ? `₹${lineTotal.toFixed(2)}` : '—'}
                  </span>
                  <span className="text-xs text-ink-faint">₹{row.unit_price.toFixed(2)} per unit</span>
                  {savings != null && (
                    <span className="font-label text-label-sm text-accent">{Math.round(savings)}% savings</span>
                  )}
                </p>

                {belowFees && (
                  <p className="mt-1 text-xs text-warning">
                    At {row.min_qty}+, this tier's price (₹{row.unit_price.toFixed(2)}) is below the ₹{feeSum.toFixed(2)} combined
                    print fee for this product's sides — printing alone would exceed the tier revenue, before base cost. Allowed,
                    but check it's intentional.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button type="button" variant="primary" loading={saving} onClick={handleSave}>
        Save bulk pricing
      </Button>
    </div>
  )
}
