import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// POD.md §7.2 — cart line identity. Two shirts with different artwork, or
// the same product in two sizes, are different lines: dedupe on product_id
// alone (the v1 behaviour) silently merged them and corrupted totals.
export interface CartLine {
  key: string
  product_id: number
  name: string
  size: string | null
  design_id: string | null
  preview_url: string | null // e.g. '/img/designs/dsn_x/front.webp', or a plain product mockup
  base_price: number
  size_delta: number
  print_fees: { side: 'front' | 'back'; fee: number }[]
  unit_price: number
  quantity: number
  max_qty: number
}

export type NewCartLine = Omit<CartLine, 'key' | 'quantity' | 'max_qty'> & {
  quantity: number
  max_qty?: number
}

export function cartLineKey(product_id: number, size: string | null, design_id: string | null): string {
  return `${product_id}:${size ?? '-'}:${design_id ?? 'plain'}`
}

/** One entry of the server's §7.3 price-mismatch quote — matched back onto cart lines by their composite key. */
export interface ServerQuoteItem {
  product_id: number
  size: string | null
  design_id: string | null
  base_price: number
  size_delta: number
  print_fees: { side: 'front' | 'back'; fee: number }[]
  unit_price: number
}

interface CartStore {
  lines: CartLine[]
  isCartOpen: boolean
  addLine: (line: NewCartLine) => void
  updateQuantity: (key: string, quantity: number) => void
  removeItem: (key: string) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
  subtotal: () => number
  totalItems: () => number
  /** POD.md §7.3/§7.4 — checkout returned `price_mismatch`: overwrite each matching line's pricing fields (never quantity) with the server-computed truth, so re-submitting the order actually matches what the server will charge. */
  reconcilePricing: (items: ServerQuoteItem[]) => void
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      lines: [],
      isCartOpen: false,
      openCart: () => set({ isCartOpen: true }),
      closeCart: () => set({ isCartOpen: false }),

      addLine: (input) =>
        set((state) => {
          const maxQty = input.max_qty ?? Infinity
          if (maxQty <= 0 || input.quantity <= 0) return state

          const key = cartLineKey(input.product_id, input.size ?? null, input.design_id ?? null)
          const idx = state.lines.findIndex((l) => l.key === key)

          if (idx === -1) {
            const line: CartLine = {
              ...input,
              key,
              size: input.size ?? null,
              design_id: input.design_id ?? null,
              preview_url: input.preview_url ?? null,
              max_qty: maxQty,
              quantity: Math.min(input.quantity, maxQty),
            }
            return { isCartOpen: true, lines: [...state.lines, line] }
          }

          // Full composite key matched — merge quantity onto the existing line.
          const lines = state.lines.slice()
          const existing = lines[idx]
          lines[idx] = {
            ...existing,
            max_qty: maxQty,
            quantity: Math.min(existing.quantity + input.quantity, maxQty),
          }
          return { isCartOpen: true, lines }
        }),

      updateQuantity: (key, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.key !== key)
              : state.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(quantity, l.max_qty) } : l)),
        })),

      removeItem: (key) =>
        set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),

      clearCart: () => set({ lines: [] }),

      subtotal: () => get().lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0),
      totalItems: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),

      reconcilePricing: (items) =>
        set((state) => {
          const byKey = new Map(items.map((i) => [cartLineKey(i.product_id, i.size, i.design_id), i]))
          return {
            lines: state.lines.map((line) => {
              const match = byKey.get(line.key)
              if (!match) return line
              return {
                ...line,
                base_price: match.base_price,
                size_delta: match.size_delta,
                print_fees: match.print_fees,
                unit_price: match.unit_price,
              }
            }),
          }
        }),
    }),
    {
      name: 'edgeshop-cart',
      // v1 stored `items: CartItem[]` deduped on product_id — an incompatible
      // shape. Silently carrying it forward would corrupt totals, so any
      // persisted version below 2 is discarded rather than migrated.
      version: 2,
      migrate: () => ({ lines: [] }),
      partialize: (state) => ({ lines: state.lines }),
    }
  )
)
