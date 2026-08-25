import ProductCard from './ProductCard'

interface ProductGridProps {
  products: Array<{
    id: number
    name: string
    price: number
    compare_price?: number | null
    image_url: string
    is_customizable?: number | boolean
  }>
  currency: string
  onAddToCart: (productId: number) => void
  /** Staggered `fade-up` entrance, 40ms apart (POD-UI.md §B2 — HomePage's featured grid). */
  stagger?: boolean
}

export default function ProductGrid({ products, currency, onAddToCart, stagger = false }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-ink-soft">No products yet</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
      {products.map((p, i) => (
        <div
          key={p.id}
          className={stagger ? 'stagger-delay animate-fade-up' : undefined}
          style={stagger ? ({ '--stagger-index': i } as React.CSSProperties) : undefined}
        >
          <ProductCard {...p} currency={currency} onAddToCart={() => onAddToCart(p.id)} />
        </div>
      ))}
    </div>
  )
}
