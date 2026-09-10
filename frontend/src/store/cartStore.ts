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
  // POD-V2.md §3.4 / POD-UI4.md §4.2 — axis 2 (colour/finish/material).
  // Carried purely for identity/display/fulfilment, exactly like `size`,
  // but NEVER priced: axis 2 has no price_delta by design (POD-V2.md §3.1),
  // so nothing downstream of this field may touch a monetary value.
  variant: string | null
  design_id: string | null
  preview_url: string | null // e.g. '/img/designs/dsn_x/front.webp', or a plain product mockup
  base_price: number
  size_delta: number
  print_fees: { side: 'front' | 'back'; fee: number }[]
  unit_price: number
  quantity: number
  max_qty: number
}

// `variant` is optional here (defaulting to null in `addLine` below), not
// required like the rest of `CartLine` — HomePage's plain add-to-cart and
// CustomizerEditor's addLine call (frozen apart from threading
// `initialVariant` through) both predate axis 2 and have no variant to
// pass; forcing every existing call site to add `variant: null` for a
// no-op would be needless churn for zero behaviour change.
export type NewCartLine = Omit<CartLine, 'key' | 'quantity' | 'max_qty' | 'variant'> & {
  variant?: string | null
  quantity: number
  max_qty?: number
}

// POD-UI4.md §4.2 / POD-V2.md §3.4 — cart line identity gains a `variant`
// segment. Order matters: `ServerQuoteItem` below and the worker's
// `items_json` resolution must build the exact same string or
// `reconcilePricing`'s key-based matching silently stops finding lines.
export function cartLineKey(product_id: number, size: string | null, variant: string | null, design_id: string | null): string {
  return `${product_id}:${size ?? '-'}:${variant ?? '-'}:${design_id ?? 'plain'}`
}

/** One entry of the server's §7.3 price-mismatch quote — matched back onto cart lines by their composite key. */
export interface ServerQuoteItem {
  product_id: number
  size: string | null
  variant: string | null
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

          const key = cartLineKey(input.product_id, input.size ?? null, input.variant ?? null, input.design_id ?? null)
          const idx = state.lines.findIndex((l) => l.key === key)

          if (idx === -1) {
            const line: CartLine = {
              ...input,
              key,
              size: input.size ?? null,
              variant: input.variant ?? null,
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
          const byKey = new Map(items.map((i) => [cartLineKey(i.product_id, i.size, i.variant, i.design_id), i]))
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
      // persisted version below 2 was discarded rather than migrated.
      //
      // POD-UI4.md §4.2 / POD-V2.md §11 Phase 2.4 — v3 bump for the same
      // reason: `cartLineKey` gained a `variant` segment, so a v2 key like
      // `1:M:plain` no longer matches the v3 shape `1:M:-:plain`. A live
      // shopper's `localStorage` holds v2-keyed lines; silently reading them
      // as v3 would make every `reconcilePricing` key lookup miss, so the
      // same "discard, don't migrate" call as v1→v2 applies here — an empty
      // cart the shopper has to re-fill beats one that silently stops
      // reconciling its own prices.
      version: 3,
      migrate: () => ({ lines: [] }),
      partialize: (state) => ({ lines: state.lines }),
    }
  )
)
