import ProductCard from './ProductCard'

interface ProductGridProps {
  products: Array<{
    id: number
    name: string
    price: number
    compare_price?: number | null
    image_url: string
    images?: string[]
    category: string
  }>
  currency: string
  onAddToCart: (productId: number) => void
}

export default function ProductGrid({ products, currency, onAddToCart }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-sm text-gray-400">No products yet</p>
      </div>
    )
  }

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
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
