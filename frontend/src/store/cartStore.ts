import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '../themes/types'

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  updateQuantity: (productId: number, quantity: number) => void
  removeItem: (productId: number) => void
  clearCart: () => void
  totalAmount: () => number
  totalItems: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.product_id === item.product_id)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product_id === item.product_id
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            }
          }
          return { items: [...state.items, item] }
        }),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.product_id !== productId)
              : state.items.map((i) =>
                  i.product_id === productId ? { ...i, quantity } : i
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
    { name: 'edgeshop-cart' }
  )
)
