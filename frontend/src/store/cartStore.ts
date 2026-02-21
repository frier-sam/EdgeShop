import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '../themes/types'

interface CartStore {
  items: CartItem[]
  isCartOpen: boolean
  addItem: (item: CartItem) => void
  updateQuantity: (productId: number, quantity: number) => void
  removeItem: (productId: number) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
  totalAmount: () => number
  totalItems: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isCartOpen: false,
      openCart: () => set({ isCartOpen: true }),
      closeCart: () => set({ isCartOpen: false }),
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.product_id === item.product_id)
          const maxQty = item.stock_count ?? Infinity
          if (maxQty <= 0) return state
          return {
            isCartOpen: true,
            items: existing
              ? state.items.map((i) =>
                  i.product_id === item.product_id
                    ? {
                        ...i,
                        quantity: Math.min(i.quantity + item.quantity, maxQty),
                        stock_count: item.stock_count ?? i.stock_count,
                      }
                    : i
                )
              : [...state.items, { ...item, quantity: Math.min(item.quantity, maxQty) }],
          }
        }),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.product_id !== productId)
              : state.items.map((i) =>
                  i.product_id === productId
                    ? { ...i, quantity: Math.min(quantity, i.stock_count ?? Infinity) }
                    : i
                ),
        })),
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.product_id !== productId),
        })),
      clearCart: () => set({ items: [] }),
      totalAmount: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      totalItems: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'edgeshop-cart', partialize: (state) => ({ items: state.items }) }
  )
)
