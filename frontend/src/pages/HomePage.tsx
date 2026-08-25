import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../lib/useSettings'
import { NAV_ITEMS, FOOTER_LINKS, currencySymbol } from '../lib/storeConfig'
import { useCartStore } from '../store/cartStore'
import { useToastStore } from '../store/toastStore'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProductGrid from '../components/ProductGrid'
import CartDrawer from '../components/CartDrawer'
import Button from '../components/Button'
import type { ProductSummary } from '../lib/types'

interface ProductsData {
  products: ProductSummary[]
  total: number
}

const STEPS = [
  {
    title: 'Pick a product',
    description: 'Tees, hoodies, mugs and more — browse the catalog and choose your base.',
  },
  {
    title: 'Add your design',
    description: 'Upload art or add text on the print area, front and back.',
  },
  {
    title: 'We print & ship',
    description: 'Your design is printed to order and shipped straight to your door.',
  },
]

export default function HomePage() {
  const { store_name: storeName, currency: storeCurrency } = useSettings()
  const cartOpen = useCartStore((s) => s.isCartOpen)
  const openCart = useCartStore((s) => s.openCart)
  const closeCart = useCartStore((s) => s.closeCart)
  const navigate = useNavigate()
  const addLine = useCartStore((s) => s.addLine)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const lines = useCartStore((s) => s.lines)
  const totalItems = useCartStore((s) => s.totalItems)
  const addToast = useToastStore((s) => s.addToast)

  const { data: productsData, isLoading } = useQuery<ProductsData>({
    queryKey: ['products', 'featured'],
    queryFn: () => fetch('/api/products?page=1&limit=8').then((r) => r.json()),
    staleTime: 60 * 1000,
  })

  const currency = currencySymbol(storeCurrency)
  const products = productsData?.products ?? []

  useEffect(() => {
    document.title = storeName
  }, [storeName])

  function handleAddToCart(productId: number) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    addLine({
      product_id: product.id,
      name: product.name,
      size: null,
      design_id: null,
      preview_url: product.front_image,
      base_price: product.base_price,
      size_delta: 0,
      print_fees: [],
      unit_price: product.base_price,
      quantity: 1,
    })
    addToast('Added to cart')
  }

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <Header storeName={storeName} cartCount={totalItems()} onCartOpen={openCart} navItems={NAV_ITEMS} />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="mb-5 inline-block rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-dark">
            Print on demand
          </span>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-6xl">
            {storeName}
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base text-ink-soft sm:text-lg">
            Design it yourself, we print it and ship it — no minimums, made one at a time.
          </p>
          <div className="mt-9">
            <Button variant="accent" size="lg" onClick={() => navigate('/shop')}>
              Shop the collection
            </Button>
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="mb-10 text-center font-display text-2xl font-semibold text-ink">How it works</h2>
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((step, i) => (
                <div key={step.title} className="text-center">
                  <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                    {i + 1}
                  </div>
                  <h3 className="mb-1.5 text-sm font-semibold text-ink">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-soft">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Featured products */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="font-display text-2xl font-semibold text-ink">Featured products</h2>
            <Button variant="ghost" size="sm" to="/shop">
              View all →
            </Button>
          </div>

          {isLoading ? (
            <p className="py-16 text-center text-sm text-ink-soft">Loading products…</p>
          ) : (
            <ProductGrid
              products={products.map((p) => ({
                id: p.id,
                name: p.name,
                price: p.base_price,
                compare_price: p.compare_price,
                image_url: p.front_image ?? '',
                is_customizable: p.is_customizable,
              }))}
              currency={currency}
              onAddToCart={handleAddToCart}
            />
          )}
        </section>
      </main>

      <Footer storeName={storeName} links={FOOTER_LINKS} />
      <CartDrawer
        isOpen={cartOpen}
        lines={lines}
        currency={currency}
        onClose={closeCart}
        onUpdateQuantity={updateQuantity}
        onRemove={removeItem}
        onCheckout={() => {
          closeCart()
          navigate('/checkout')
        }}
      />
    </div>
  )
}
