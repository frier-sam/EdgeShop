// worker/src/lib/pricing.ts
//
// POD.md §7.3 — the security-critical piece of the whole conversion. Every
// field that ends up on an order's total is recomputed HERE, from rows the
// worker itself re-reads from D1, never from anything the client posts.
// `routes/checkout.ts` is a thin orchestrator: fetch rows, call these pure
// functions, compare against the client's claimed total, insert.
//
// Kept dependency-free (no D1 types, no Hono) on purpose so it can be unit
// tested with plain fixtures — see pricing.test.ts — without spinning up a
// database or a worker runtime.

export interface PricingProduct {
  id: number
  name: string
  base_price: number
  status: string
  is_customizable: number
}

export interface PricingSize {
  label: string
  price_delta: number
  stock_count: number
}

export interface PricingSide {
  side: 'front' | 'back'
  customizable: number
  print_fee: number
}

export interface PricingDesign {
  id: string
  product_id: number
  design_json: string
  sides_used: string
}

export interface LineInput {
  product_id: number
  quantity: number
  size?: string | null
  design_id?: string | null
}

export interface PrintFee {
  side: 'front' | 'back'
  fee: number
}

/** One entry of the §7.4 `items_json` shape. `price` / `image_url` are kept
 * as aliases of `unit_price` / `previews.front` so the pre-Phase-7 admin
 * order detail and account order history pages (which read those field
 * names) keep working without a Phase-8 rewrite — see POD.md decisions log. */
export interface ResolvedLineItem {
  product_id: number
  name: string
  size: string | null
  quantity: number
  base_price: number
  size_delta: number
  print_fees: PrintFee[]
  unit_price: number
  line_total: number
  design_id: string | null
  previews: Record<string, string>
  price: number
  image_url: string
}

export type LineResult = { ok: true; item: ResolvedLineItem } | { ok: false; error: string }

export interface ComputeLineArgs {
  input: LineInput
  product: PricingProduct | null
  /** The matching product_sizes row for `input.size`, or null if no size was requested or none matched. */
  size: PricingSize | null
  /** Every product_sides row for the product (needed to validate a design's claimed sides and look up their fees). */
  sides: PricingSide[]
  /** The designs row for `input.design_id`, or null if none was requested or none matched. */
  design: PricingDesign | null
  /** Parsed preview_json for the design, so §7.4's `previews` can be echoed into the stored order line. */
  previewJson: Record<string, string>
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Re-derives one order line entirely from server-fetched rows. Returns
 * `{ ok: false, error }` for anything a tampered client could have lied
 * about: a product that doesn't exist/isn't active, a size that doesn't
 * exist, a design that belongs to a different product, or a design that
 * claims a side which has no actual artwork in its stored `design_json`
 * (POD.md §7.3 — "a customer could claim a front-only design and be
 * charged one fee while submitting art for both, or vice versa").
 */
export function computeLine({ input, product, size, sides, design, previewJson }: ComputeLineArgs): LineResult {
  if (!Number.isFinite(input.product_id) || input.product_id <= 0) {
    return { ok: false, error: 'invalid_line' }
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1 || !Number.isInteger(input.quantity)) {
    return { ok: false, error: 'invalid_quantity' }
  }
  if (!product || product.status !== 'active') {
    return { ok: false, error: 'product_not_found' }
  }
  if (input.size && !size) {
    return { ok: false, error: 'invalid_size' }
  }

  let designId: string | null = null
  const printFees: PrintFee[] = []
  const previews: Record<string, string> = {}

  if (input.design_id) {
    if (!design) return { ok: false, error: 'invalid_design' }
    if (design.product_id !== product.id) return { ok: false, error: 'design_product_mismatch' }
    if (!product.is_customizable) return { ok: false, error: 'product_not_customizable' }

    let parsedDesign: Record<string, { objects?: unknown[] } | undefined>
    try {
      parsedDesign = JSON.parse(design.design_json)
    } catch {
      return { ok: false, error: 'invalid_design_json' }
    }

    const claimedSides = design.sides_used
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (claimedSides.length === 0) {
      return { ok: false, error: 'design_side_empty' }
    }

    for (const sideName of claimedSides) {
      const sideRow = sides.find((s) => s.side === sideName)
      if (!sideRow || !sideRow.customizable) {
        return { ok: false, error: 'invalid_design_side' }
      }
      // The heart of §7.3: re-check the STORED design_json, not whatever
      // the client claims sides_used to be — a claimed side with zero
      // objects means either the customer never actually drew on it, or
      // the request is trying to dodge that side's print fee.
      const objs = parsedDesign[sideName]?.objects
      if (!Array.isArray(objs) || objs.length === 0) {
        return { ok: false, error: 'design_side_empty' }
      }
      printFees.push({ side: sideName as 'front' | 'back', fee: sideRow.print_fee })
      if (previewJson[sideName]) previews[sideName] = previewJson[sideName]
    }
    designId = design.id
  }

  const sizeDelta = size?.price_delta ?? 0
  const printFeeTotal = printFees.reduce((sum, f) => sum + f.fee, 0)
  const unitPrice = round2(product.base_price + sizeDelta + printFeeTotal)
  const lineTotal = round2(unitPrice * input.quantity)
  const frontOrFirstPreview = previews.front ?? Object.values(previews)[0] ?? ''

  return {
    ok: true,
    item: {
      product_id: product.id,
      name: product.name,
      size: input.size ?? null,
      quantity: input.quantity,
      base_price: product.base_price,
      size_delta: sizeDelta,
      print_fees: printFees,
      unit_price: unitPrice,
      line_total: lineTotal,
      design_id: designId,
      previews,
      price: unitPrice,
      image_url: frontOrFirstPreview,
    },
  }
}

export interface ShippingSettings {
  flat_shipping_amount: number
  free_shipping_over: number
}

/** POD.md §6.3 — flat rate, free above a threshold (`0` = never free). */
export function computeShipping(subtotal: number, settings: ShippingSettings): number {
  if (settings.free_shipping_over > 0 && subtotal >= settings.free_shipping_over) return 0
  return Math.max(0, settings.flat_shipping_amount)
}

export interface OrderQuote {
  items: ResolvedLineItem[]
  subtotal: number
  print_total: number
  shipping_amount: number
  total_amount: number
}

export function computeOrderQuote(items: ResolvedLineItem[], shippingSettings: ShippingSettings): OrderQuote {
  const subtotal = round2(items.reduce((sum, i) => sum + i.line_total, 0))
  const print_total = round2(
    items.reduce((sum, i) => sum + i.print_fees.reduce((s, f) => s + f.fee, 0) * i.quantity, 0)
  )
  const shipping_amount = computeShipping(subtotal, shippingSettings)
  const total_amount = round2(subtotal + shipping_amount)
  return { items, subtotal, print_total, shipping_amount, total_amount }
}

/** Float-safe comparison — client and server both round to paise/cents, but floating point still needs a small epsilon. */
export function pricesMatch(clientTotal: number, serverTotal: number, epsilon = 0.01): boolean {
  return Number.isFinite(clientTotal) && Math.abs(clientTotal - serverTotal) <= epsilon
}
