import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from '../cartStore'

beforeEach(() => {
  useCartStore.setState({ items: [] })
})

describe('Cart Store', () => {
  it('adds item to cart', () => {
    useCartStore.getState().addItem({ product_id: 1, name: 'Ring', price: 999, quantity: 1, image_url: '' })
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('increments quantity if same product added again', () => {
    const store = useCartStore.getState()
    store.addItem({ product_id: 1, name: 'Ring', price: 999, quantity: 1, image_url: '' })
    store.addItem({ product_id: 1, name: 'Ring', price: 999, quantity: 1, image_url: '' })
    expect(useCartStore.getState().items[0].quantity).toBe(2)
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('updates quantity', () => {
    useCartStore.getState().addItem({ product_id: 1, name: 'Ring', price: 999, quantity: 1, image_url: '' })
    useCartStore.getState().updateQuantity(1, 3)
    expect(useCartStore.getState().items[0].quantity).toBe(3)
  })

  it('removes item when quantity set to 0', () => {
    useCartStore.getState().addItem({ product_id: 1, name: 'Ring', price: 999, quantity: 1, image_url: '' })
    useCartStore.getState().updateQuantity(1, 0)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('computes totalAmount', () => {
    useCartStore.getState().addItem({ product_id: 1, name: 'Ring', price: 1000, quantity: 2, image_url: '' })
    expect(useCartStore.getState().totalAmount()).toBe(2000)
  })

  it('computes totalItems', () => {
    useCartStore.getState().addItem({ product_id: 1, name: 'Ring', price: 1000, quantity: 2, image_url: '' })
    useCartStore.getState().addItem({ product_id: 2, name: 'Necklace', price: 500, quantity: 1, image_url: '' })
    expect(useCartStore.getState().totalItems()).toBe(3)
  })

  it('clears cart', () => {
    useCartStore.getState().addItem({ product_id: 1, name: 'Ring', price: 999, quantity: 1, image_url: '' })
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().items).toHaveLength(0)
  })
})
