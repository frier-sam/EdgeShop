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
}

export default function ProductGrid({ products, currency, onAddToCart }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-ink-soft">No products yet</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} {...p} currency={currency} onAddToCart={() => onAddToCart(p.id)} />
      ))}
    </div>
  )
}
