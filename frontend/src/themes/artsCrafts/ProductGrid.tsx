import type { ProductGridProps } from '../types'
import ProductCard from './ProductCard'

export default function ProductGrid({ products, currency, onAddToCart }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-20 text-amber-400">
        <p className="text-sm font-bold tracking-wider uppercase">No products yet</p>
      </div>
    )
  }
  return (
    <section className="bg-[#F5F0E8] max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
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
