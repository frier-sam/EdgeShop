import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../lib/useSettings'
import { NAV_ITEMS, FOOTER_LINKS, CATEGORIES, TRUST_ITEMS, currencySymbol } from '../lib/storeConfig'
import { useCartStore } from '../store/cartStore'
import { useToastStore } from '../store/toastStore'
import Header from '../components/Header'
import Footer from '../components/Footer'
import CartDrawer from '../components/CartDrawer'
import Hero from '../components/home/Hero'
import TrustStrip from '../components/home/TrustStrip'
import ShopByCategory from '../components/home/ShopByCategory'
import FeaturedProducts from '../components/home/FeaturedProducts'
import HowItWorks from '../components/home/HowItWorks'
import SocialProof from '../components/home/SocialProof'
import ClosingCta from '../components/home/ClosingCta'
import type { ProductSummary } from '../lib/types'

interface ProductsData {
  products: ProductSummary[]
  total: number
}

// One fetch feeds three sections — the hero composition (first 3 with a
// photo), "Shop by category" (categories derived from this same page) and
// featured products (capped at 8, see FeaturedProducts.FEATURED_LIMIT) —
// instead of issuing three separate requests for the same catalog.
const CATALOG_FETCH_LIMIT = 12

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
    queryKey: ['products', 'home', CATALOG_FETCH_LIMIT],
    queryFn: () => fetch(`/api/products?page=1&limit=${CATALOG_FETCH_LIMIT}`).then((r) => r.json()),
    staleTime: 60 * 1000,
  })

  const currency = currencySymbol(storeCurrency)
  const products = productsData?.products ?? []
  const heroProducts = useMemo(() => products.filter((p) => p.front_image).slice(0, 3), [products])

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
        <Hero products={heroProducts} currency={currency} isLoading={isLoading} />
        <TrustStrip items={TRUST_ITEMS} />
        <ShopByCategory categories={CATEGORIES} />
        <FeaturedProducts products={products} currency={currency} isLoading={isLoading} onAddToCart={handleAddToCart} />
        <HowItWorks />
        <SocialProof />
        <ClosingCta />
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
