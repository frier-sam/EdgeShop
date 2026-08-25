import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore, cartLineKey, type NewCartLine } from '../cartStore'

function line(overrides: Partial<NewCartLine> = {}): NewCartLine {
  return {
    product_id: 1,
    name: 'Classic Tee',
    size: 'M',
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
  it('composes product_id:size:design_id', () => {
    expect(cartLineKey(1, 'M', 'dsn_abc')).toBe('1:M:dsn_abc')
  })

  it('falls back to "-" for size and "plain" for design_id', () => {
    expect(cartLineKey(1, null, null)).toBe('1:-:plain')
  })
})

describe('Cart Store', () => {
  it('adds a line to the cart', () => {
    useCartStore.getState().addLine(line())
    expect(useCartStore.getState().lines).toHaveLength(1)
    expect(useCartStore.getState().lines[0].key).toBe('1:M:plain')
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
    const key = cartLineKey(1, 'M', null)
    useCartStore.getState().updateQuantity(key, 5)
    const lines = useCartStore.getState().lines
    expect(lines.find((l) => l.key === key)?.quantity).toBe(5)
    expect(lines.find((l) => l.size === 'L')?.quantity).toBe(1)
  })

  it('updateQuantity clamps to max_qty', () => {
    const key = cartLineKey(1, 'M', null)
    useCartStore.getState().addLine(line({ max_qty: 3 }))
    useCartStore.getState().updateQuantity(key, 99)
    expect(useCartStore.getState().lines[0].quantity).toBe(3)
  })

  it('removes the line when quantity is set to 0', () => {
    const key = cartLineKey(1, 'M', null)
    useCartStore.getState().addLine(line())
    useCartStore.getState().updateQuantity(key, 0)
    expect(useCartStore.getState().lines).toHaveLength(0)
  })

  it('removeItem keys off `key`, not product_id', () => {
    useCartStore.getState().addLine(line({ size: 'M' }))
    useCartStore.getState().addLine(line({ size: 'L' }))
    useCartStore.getState().removeItem(cartLineKey(1, 'M', null))
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
})
