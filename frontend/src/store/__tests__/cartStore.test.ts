import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore, cartLineKey, type NewCartLine } from '../cartStore'

function line(overrides: Partial<NewCartLine> = {}): NewCartLine {
  return {
    product_id: 1,
    name: 'Classic Tee',
    size: 'M',
    variant: null,
    design_id: null,
    preview_url: null,
    base_price: 499,
    size_delta: 0,
    print_fees: [],
    unit_price: 499,
    quantity: 1,
    max_qty: 10,
    ...overrides,
  }
}

beforeEach(() => {
  useCartStore.setState({ lines: [], isCartOpen: false })
})

describe('cartLineKey', () => {
  it('composes product_id:size:variant:design_id', () => {
    expect(cartLineKey(1, 'M', 'Navy', 'dsn_abc')).toBe('1:M:Navy:dsn_abc')
  })

  it('falls back to "-" for size and variant, and "plain" for design_id', () => {
    expect(cartLineKey(1, null, null, null)).toBe('1:-:-:plain')
  })
})

// POD-UI4.md §4.2 — the persisted store `version` moved 2 → 3 because
// `cartLineKey` gained the `variant` segment above; a v2-keyed cart must be
// discarded, not silently reinterpreted under the new key shape.
describe('persisted store version', () => {
  it('is bumped to 3 for the variant cart-key segment', () => {
    expect(useCartStore.persist.getOptions().version).toBe(3)
  })

  it('discards any pre-v3 persisted state rather than reinterpreting its keys', () => {
    const migrate = useCartStore.persist.getOptions().migrate
    expect(migrate).toBeDefined()
    const staleV2State = { lines: [{ key: '1:M:plain', product_id: 1, quantity: 2 }] }
    expect(migrate!(staleV2State, 2)).toEqual({ lines: [] })
  })
})

describe('Cart Store', () => {
  it('adds a line to the cart', () => {
    useCartStore.getState().addLine(line())
    expect(useCartStore.getState().lines).toHaveLength(1)
    expect(useCartStore.getState().lines[0].key).toBe('1:M:-:plain')
  })

  it('merges quantity when the full composite key matches', () => {
    const store = useCartStore.getState()
    store.addLine(line({ quantity: 1 }))
    store.addLine(line({ quantity: 2 }))
    const { lines } = useCartStore.getState()
    expect(lines).toHaveLength(1)
    expect(lines[0].quantity).toBe(3)
  })

  it('keeps two lines separate when only design_id differs', () => {
    const store = useCartStore.getState()
    store.addLine(line({ design_id: null }))
    store.addLine(line({ design_id: 'dsn_abc', preview_url: '/img/designs/dsn_abc/front.webp' }))
    const { lines } = useCartStore.getState()
    expect(lines).toHaveLength(2)
    expect(new Set(lines.map((l) => l.key)).size).toBe(2)
  })

  it('keeps two lines separate when only size differs', () => {
    const store = useCartStore.getState()
    store.addLine(line({ size: 'M' }))
    store.addLine(line({ size: 'L' }))
    const { lines } = useCartStore.getState()
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.size).sort()).toEqual(['L', 'M'])
  })

  // POD-UI4.md §4.2 / POD-V2.md §3.4 — the new cartLineKey segment: two
  // otherwise-identical lines that only differ by axis-2 option must stay
  // distinct lines, not merge into one (which would silently drop one
  // colour's quantity into the other's).
  it('keeps two lines separate when only variant differs', () => {
    const store = useCartStore.getState()
    store.addLine(line({ variant: 'Navy' }))
    store.addLine(line({ variant: 'White' }))
    const { lines } = useCartStore.getState()
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.variant).sort()).toEqual(['Navy', 'White'])
  })

  it('clamps quantity to max_qty on add', () => {
    useCartStore.getState().addLine(line({ quantity: 5, max_qty: 2 }))
    expect(useCartStore.getState().lines[0].quantity).toBe(2)
  })

  it('does not add a line when max_qty is 0', () => {
    useCartStore.getState().addLine(line({ max_qty: 0 }))
    expect(useCartStore.getState().lines).toHaveLength(0)
  })

  it('updateQuantity keys off `key`, not product_id', () => {
    useCartStore.getState().addLine(line({ size: 'M' }))
    useCartStore.getState().addLine(line({ size: 'L' }))
    const key = cartLineKey(1, 'M', null, null)
    useCartStore.getState().updateQuantity(key, 5)
    const lines = useCartStore.getState().lines
    expect(lines.find((l) => l.key === key)?.quantity).toBe(5)
    expect(lines.find((l) => l.size === 'L')?.quantity).toBe(1)
  })

  it('updateQuantity clamps to max_qty', () => {
    const key = cartLineKey(1, 'M', null, null)
    useCartStore.getState().addLine(line({ max_qty: 3 }))
    useCartStore.getState().updateQuantity(key, 99)
    expect(useCartStore.getState().lines[0].quantity).toBe(3)
  })

  it('removes the line when quantity is set to 0', () => {
    const key = cartLineKey(1, 'M', null, null)
    useCartStore.getState().addLine(line())
    useCartStore.getState().updateQuantity(key, 0)
    expect(useCartStore.getState().lines).toHaveLength(0)
  })

  it('removeItem keys off `key`, not product_id', () => {
    useCartStore.getState().addLine(line({ size: 'M' }))
    useCartStore.getState().addLine(line({ size: 'L' }))
    useCartStore.getState().removeItem(cartLineKey(1, 'M', null, null))
    const lines = useCartStore.getState().lines
    expect(lines).toHaveLength(1)
    expect(lines[0].size).toBe('L')
  })

  it('computes subtotal from unit_price * quantity', () => {
    useCartStore.getState().addLine(line({ size: 'M', unit_price: 598, quantity: 2 }))
    useCartStore.getState().addLine(line({ size: 'L', unit_price: 499, quantity: 1 }))
    expect(useCartStore.getState().subtotal()).toBe(598 * 2 + 499)
  })

  it('computes totalItems across lines', () => {
    useCartStore.getState().addLine(line({ size: 'M', quantity: 2 }))
    useCartStore.getState().addLine(line({ size: 'L', quantity: 1 }))
    expect(useCartStore.getState().totalItems()).toBe(3)
  })

  it('clears the cart', () => {
    useCartStore.getState().addLine(line())
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().lines).toHaveLength(0)
  })

  it('opens the cart when a line is added', () => {
    useCartStore.getState().addLine(line())
    expect(useCartStore.getState().isCartOpen).toBe(true)
  })

  // POD.md §7.3/§7.4 — checkout's price_mismatch response carries a corrected
  // quote; reconcilePricing must overwrite pricing fields (never quantity).
  describe('reconcilePricing', () => {
    it('overwrites pricing fields on the matching line without touching quantity', () => {
      useCartStore.getState().addLine(line({ size: 'M', design_id: 'dsn_1', unit_price: 598, quantity: 3 }))
      useCartStore.getState().reconcilePricing([
        {
          product_id: 1,
          size: 'M',
          variant: null,
          design_id: 'dsn_1',
          base_price: 499,
          size_delta: 0,
          print_fees: [{ side: 'front', fee: 149 }],
          unit_price: 648,
        },
      ])
      const updated = useCartStore.getState().lines[0]
      expect(updated.unit_price).toBe(648)
      expect(updated.print_fees).toEqual([{ side: 'front', fee: 149 }])
      expect(updated.quantity).toBe(3)
    })

    it('leaves lines with no matching server item untouched', () => {
      useCartStore.getState().addLine(line({ size: 'L', unit_price: 499 }))
      useCartStore.getState().reconcilePricing([
        { product_id: 999, size: null, variant: null, design_id: null, base_price: 1, size_delta: 0, print_fees: [], unit_price: 1 },
      ])
      expect(useCartStore.getState().lines[0].unit_price).toBe(499)
    })

    // A variant carries no price by design (POD-V2.md §3.1), but it is
    // still part of the composite key — a server quote item whose variant
    // doesn't match must NOT be treated as the same line.
    it('does not match a line when only variant differs from the server item', () => {
      useCartStore.getState().addLine(line({ size: 'M', variant: 'Navy', unit_price: 499 }))
      useCartStore.getState().reconcilePricing([
        { product_id: 1, size: 'M', variant: 'White', design_id: null, base_price: 1, size_delta: 0, print_fees: [], unit_price: 1 },
      ])
      expect(useCartStore.getState().lines[0].unit_price).toBe(499)
    })
  })
})
