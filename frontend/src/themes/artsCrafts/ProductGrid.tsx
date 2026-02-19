import type { ProductGridProps } from '../types'
import ProductCard from './ProductCard'

export default function ProductGrid({ products, currency, onAddToCart }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-20" style={{ color: 'var(--color-accent)' }}>
        <p className="text-sm font-bold tracking-wider uppercase">No products yet</p>
      </div>
    )
  }
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            {...p}
            currency={currency}
            onAddToCart={() => onAddToCart(p.id)}
          />
        ))}
      </div>
    </section>
  )
}
