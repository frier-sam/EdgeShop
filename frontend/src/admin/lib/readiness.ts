// POD-UI4.md §4.6 — the admin readiness chips ("live status bar" in the
// comp). Pulled out as pure functions, separate from the presentational
// ReadinessChips component, for the same reason
// ProductPriceBreaksEditor.tsx pulls out sumPrintFees/isTierBelowPrintFees:
// derivation logic that must never silently drift from real product rows
// deserves direct unit tests, not only a rendered-DOM assertion.
//
// Every chip is DERIVED — never a stored flag — matching the same
// discipline POD-V2.md §11 Phase 1.3 already established for the
// capability checkboxes: the source of truth is the rows/columns
// themselves, so a chip can never disagree with the data it describes.
import type { ProductSide } from '../../lib/types'

/** Mockups chip — the product has at least one side, and every side row
 *  (front, and back if it exists) has a real, non-empty `image_url`.
 *
 *  The `length > 0` guard is load-bearing, not defensive noise: `every`
 *  over an empty array is vacuously TRUE, so without it a product with no
 *  sides at all — the least-ready state a product can be in, with no
 *  mockup, no print area and nothing for a shopper to look at — would
 *  light this chip green. `printAreasReady` below deliberately does NOT
 *  take the same guard, because "no customizable sides" is a legitimate
 *  finished state there: a plain mug genuinely needs no print rect. */
export function mockupsReady(sides: Pick<ProductSide, 'image_url'>[]): boolean {
  if (sides.length === 0) return false
  return sides.every((s) => !!s.image_url && s.image_url.trim() !== '')
}

/** Print areas chip — every side actually flagged customizable (the
 *  server-saved, already-effective flag — see ProductSideCard's
 *  `effectiveCustomizable`) has a real print rect. A mockup-only side that
 *  was never meant to carry a print area never counts against this. */
export function printAreasReady(sides: Pick<ProductSide, 'customizable' | 'print_w' | 'print_h'>[]): boolean {
  return sides.filter((s) => !!s.customizable).every((s) => s.print_w > 0 && s.print_h > 0)
}

/** Pricing chip — the one thing every product needs regardless of which
 *  capability blocks are on. */
export function pricingReady(basePrice: number): boolean {
  return Number.isFinite(basePrice) && basePrice > 0
}

/** The four capability blocks that make up the Options chip's "n/4" —
 *  axis 1, axis 2, bulk pricing and customization, in the same order they
 *  appear on the form. */
export interface OptionBlockFlags {
  axis1: boolean
  axis2: boolean
  bulk: boolean
  customization: boolean
}

/** Options chip — how many of the four capability blocks are switched on,
 *  0-4. Green (per the component) at >= 1, per §4.6. */
export function countConfiguredOptions(flags: OptionBlockFlags): number {
  return [flags.axis1, flags.axis2, flags.bulk, flags.customization].filter(Boolean).length
}
