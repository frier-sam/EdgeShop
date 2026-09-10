import { describe, it, expect } from 'vitest'
import {
  computeLine,
  computeOrderQuote,
  computeShipping,
  pricesMatch,
  type PricingProduct,
  type PricingSize,
  type PricingVariant,
  type PricingSide,
  type PricingDesign,
} from './pricing'

const TEE: PricingProduct = { id: 1, name: 'Classic Tee', base_price: 499, status: 'active', is_customizable: 1, min_order_qty: 1 }
const SIZE_M: PricingSize = { label: 'M', price_delta: 0, stock_count: 10 }
const SIZE_XL: PricingSize = { label: 'XL', price_delta: 50, stock_count: 5 }
const FRONT_SIDE: PricingSide = { side: 'front', customizable: 1, print_fee: 99 }
const BACK_SIDE: PricingSide = { side: 'back', customizable: 1, print_fee: 79 }
const SIDES = [FRONT_SIDE, BACK_SIDE]

function designWith(sidesUsed: string, sides: Record<string, { objects: unknown[] }>): PricingDesign {
  return {
    id: 'dsn_test',
    product_id: TEE.id,
    design_json: JSON.stringify({ version: 1, ...sides }),
    sides_used: sidesUsed,
  }
}

describe('computeLine', () => {
  it('computes a plain (no design) line correctly', () => {
    const result = computeLine({
      input: { product_id: TEE.id, quantity: 2, size: 'M' },
      product: TEE,
      size: SIZE_M,
      sides: SIDES,
      design: null,
      previewJson: {},
      variant: null,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.item.unit_price).toBe(499)
    expect(result.item.line_total).toBe(998)
    expect(result.item.print_fees).toEqual([])
  })

  it('adds size delta and a single print fee for a front-only design', () => {
    const design = designWith('front', { front: { objects: [{ type: 'IText' }] } })
    const result = computeLine({
      input: { product_id: TEE.id, quantity: 1, size: 'XL', design_id: design.id },
      product: TEE,
      size: SIZE_XL,
      sides: SIDES,
      design,
      previewJson: { front: '/img/designs/dsn_test/front.webp' },
      variant: null,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // 499 base + 50 XL delta + 99 front fee
    expect(result.item.unit_price).toBe(648)
    expect(result.item.print_fees).toEqual([{ side: 'front', fee: 99 }])
    expect(result.item.previews.front).toBe('/img/designs/dsn_test/front.webp')
  })

  it('charges both fees for a front+back design with art on both sides', () => {
    const design = designWith('front,back', {
      front: { objects: [{ type: 'IText' }] },
      back: { objects: [{ type: 'Rect' }] },
    })
    const result = computeLine({
      input: { product_id: TEE.id, quantity: 1, size: 'M', design_id: design.id },
      product: TEE,
      size: SIZE_M,
      sides: SIDES,
      design,
      previewJson: {},
      variant: null,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.item.unit_price).toBe(499 + 99 + 79)
  })

  // POD.md §7.3 — the specific tampering scenario called out by the spec:
  // a design claims a side in sides_used but the stored design_json has
  // zero objects for it (customer dodging that side's fee, or a stale
  // claim from a design that was edited down to nothing).
  it('rejects a design that claims a side with no art', () => {
    const design = designWith('front,back', {
      front: { objects: [{ type: 'IText' }] },
      back: { objects: [] }, // claimed but empty
    })
    const result = computeLine({
      input: { product_id: TEE.id, quantity: 1, size: 'M', design_id: design.id },
      product: TEE,
      size: SIZE_M,
      sides: SIDES,
      design,
      previewJson: {},
      variant: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('design_side_empty')
  })

  it('rejects a design whose product_id does not match the line', () => {
    const design = designWith('front', { front: { objects: [{ type: 'IText' }] } })
    const otherProduct: PricingProduct = { ...TEE, id: 999 }
    const result = computeLine({
      input: { product_id: otherProduct.id, quantity: 1, design_id: design.id },
      product: otherProduct,
      size: null,
      sides: SIDES,
      design,
      previewJson: {},
      variant: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('design_product_mismatch')
  })

  it('rejects a design that claims a side the product does not have (or is not customizable)', () => {
    const design = designWith('front,sleeve', { front: { objects: [{ type: 'IText' }] } })
    const result = computeLine({
      input: { product_id: TEE.id, quantity: 1, design_id: design.id },
      product: TEE,
      size: null,
      sides: SIDES,
      design,
      previewJson: {},
      variant: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('invalid_design_side')
  })

  it('rejects an unknown product', () => {
    const result = computeLine({
      input: { product_id: 42, quantity: 1 },
      product: null,
      size: null,
      sides: [],
      design: null,
      previewJson: {},
      variant: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('product_not_found')
  })

  it('rejects a size label that does not exist on the product', () => {
    const result = computeLine({
      input: { product_id: TEE.id, quantity: 1, size: 'XXXL' },
      product: TEE,
      size: null,
      sides: SIDES,
      design: null,
      previewJson: {},
      variant: null,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('invalid_size')
  })
})

describe('computeShipping', () => {
  it('charges the flat rate below the free-shipping threshold', () => {
    expect(computeShipping(500, { flat_shipping_amount: 49, free_shipping_over: 999 })).toBe(49)
  })

  it('is free at or above the free-shipping threshold', () => {
    expect(computeShipping(999, { flat_shipping_amount: 49, free_shipping_over: 999 })).toBe(0)
    expect(computeShipping(1500, { flat_shipping_amount: 49, free_shipping_over: 999 })).toBe(0)
  })

  it('never waives shipping when free_shipping_over is 0 (disabled)', () => {
    expect(computeShipping(100000, { flat_shipping_amount: 49, free_shipping_over: 0 })).toBe(49)
  })
})

describe('computeOrderQuote + pricesMatch — the checkout tamper check', () => {
  it('accepts a client total that matches the server-computed total', () => {
    const design = designWith('front', { front: { objects: [{ type: 'IText' }] } })
    const line = computeLine({
      input: { product_id: TEE.id, quantity: 2, size: 'M', design_id: design.id },
      product: TEE,
      size: SIZE_M,
      sides: SIDES,
      design,
      previewJson: {},
      variant: null,
    })
    if (!line.ok) throw new Error('fixture line should resolve')
    const quote = computeOrderQuote([line.item], { flat_shipping_amount: 49, free_shipping_over: 999 })
    // (499 + 99) * 2 = 1196 subtotal, which is already over the 999 free-shipping threshold
    expect(quote.subtotal).toBe(1196)
    expect(quote.shipping_amount).toBe(0)
    expect(quote.total_amount).toBe(1196)
    expect(pricesMatch(1196, quote.total_amount)).toBe(true)
  })

  it('rejects a tampered client total_amount (the core §7.3 exploit: total_amount: 1)', () => {
    const line = computeLine({
      input: { product_id: TEE.id, quantity: 1, size: 'M' },
      product: TEE,
      size: SIZE_M,
      sides: SIDES,
      design: null,
      previewJson: {},
      variant: null,
    })
    if (!line.ok) throw new Error('fixture line should resolve')
    const quote = computeOrderQuote([line.item], { flat_shipping_amount: 49, free_shipping_over: 999 })
    expect(pricesMatch(1, quote.total_amount)).toBe(false)
  })

  it('applies the free-shipping threshold across the whole order subtotal', () => {
    const line = computeLine({
      input: { product_id: TEE.id, quantity: 3, size: 'M' },
      product: TEE,
      size: SIZE_M,
      sides: SIDES,
      design: null,
      previewJson: {},
      variant: null,
    })
    if (!line.ok) throw new Error('fixture line should resolve')
    // 499 * 3 = 1497 >= 999 free-shipping threshold
    const quote = computeOrderQuote([line.item], { flat_shipping_amount: 49, free_shipping_over: 999 })
    expect(quote.subtotal).toBe(1497)
    expect(quote.shipping_amount).toBe(0)
    expect(quote.total_amount).toBe(1497)
  })
})

// POD-V2.md §3.1, POD-UI4.md §4.1 — axis 2 (colour/finish/material). The
// validation rule exactly mirrors invalid_size; the load-bearing property
// is the second test below, which pins that a variant can NEVER change a
// single monetary field.
describe('computeLine — variant (axis 2)', () => {
  const NAVY: PricingVariant = { label: 'Navy' }

  it('resolves a matching variant and echoes its label onto the line, with no size requested', () => {
    const result = computeLine({
      input: { product_id: TEE.id, quantity: 1, variant: 'Navy' },
      product: TEE,
      size: null,
      variant: NAVY,
      sides: SIDES,
      design: null,
      previewJson: {},
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.item.variant).toBe('Navy')
  })

  it('a line with no variant requested carries a null variant', () => {
    const result = computeLine({
      input: { product_id: TEE.id, quantity: 1, size: 'M' },
      product: TEE,
      size: SIZE_M,
      variant: null,
      sides: SIDES,
      design: null,
      previewJson: {},
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.item.variant).toBeNull()
  })

  it('rejects a claimed variant that did not resolve to a real product_variants row (mirrors invalid_size)', () => {
    const result = computeLine({
      input: { product_id: TEE.id, quantity: 1, variant: 'Fluorescent Pink' },
      product: TEE,
      size: null,
      variant: null, // no matching row found
      sides: SIDES,
      design: null,
      previewJson: {},
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('invalid_variant')
  })

  // The whole point of POD-V2.md §3.1: axis 2 was designed to carry no
  // price difference specifically so it could stay out of computeLine's
  // money path entirely. This pins that promise — the exact same line,
  // priced with and without a variant, must be byte-identical on every
  // monetary field.
  it('never touches base_price, size_delta, print_fees, unit_price, or line_total', () => {
    const design = designWith('front', { front: { objects: [{ type: 'IText' }] } })
    const withoutVariant = computeLine({
      input: { product_id: TEE.id, quantity: 2, size: 'XL', design_id: design.id },
      product: TEE,
      size: SIZE_XL,
      variant: null,
      sides: SIDES,
      design,
      previewJson: {},
    })
    const withVariant = computeLine({
      input: { product_id: TEE.id, quantity: 2, size: 'XL', design_id: design.id, variant: 'Navy' },
      product: TEE,
      size: SIZE_XL,
      variant: NAVY,
      sides: SIDES,
      design,
      previewJson: {},
    })
    expect(withoutVariant.ok).toBe(true)
    expect(withVariant.ok).toBe(true)
    if (!withoutVariant.ok || !withVariant.ok) return

    expect(withVariant.item.base_price).toBe(withoutVariant.item.base_price)
    expect(withVariant.item.size_delta).toBe(withoutVariant.item.size_delta)
    expect(withVariant.item.print_fees).toEqual(withoutVariant.item.print_fees)
    expect(withVariant.item.unit_price).toBe(withoutVariant.item.unit_price)
    expect(withVariant.item.line_total).toBe(withoutVariant.item.line_total)

    // The only field that's allowed to differ.
    expect(withoutVariant.item.variant).toBeNull()
    expect(withVariant.item.variant).toBe('Navy')
  })
})

// POD-V2.md §5, §11 Phase 3.3 — server-side minimum order quantity. Landing
// independently of Phase 3's bulk tier pricing (NOT part of this change).
describe('computeLine — min_order_qty enforcement (POD-V2 Phase 3.3)', () => {
  const CARDS: PricingProduct = { ...TEE, id: 2, name: 'Visiting Cards', min_order_qty: 100 }

  it('accepts a quantity exactly equal to min_order_qty (the boundary)', () => {
    const result = computeLine({
      input: { product_id: CARDS.id, quantity: 100 },
      product: CARDS,
      size: null,
      variant: null,
      sides: [],
      design: null,
      previewJson: {},
    })
    expect(result.ok).toBe(true)
  })

  it('rejects one unit below min_order_qty', () => {
    const result = computeLine({
      input: { product_id: CARDS.id, quantity: 99 },
      product: CARDS,
      size: null,
      variant: null,
      sides: [],
      design: null,
      previewJson: {},
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('below_min_order_qty')
  })

  it('the default min_order_qty of 1 leaves every pre-existing fixture unaffected', () => {
    const result = computeLine({
      input: { product_id: TEE.id, quantity: 1, size: 'M' },
      product: TEE, // min_order_qty: 1
      size: SIZE_M,
      variant: null,
      sides: SIDES,
      design: null,
      previewJson: {},
    })
    expect(result.ok).toBe(true)
  })
})
