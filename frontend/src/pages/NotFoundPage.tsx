import { Link } from 'react-router-dom'
import { useSettings } from '../lib/useSettings'
import { NAV_ITEMS } from '../lib/storeConfig'
import Header from '../components/Header'
import Footer from '../components/Footer'
import Button from '../components/Button'

export default function NotFoundPage() {
  const { store_name: storeName } = useSettings()

  return (
    <div className="min-h-screen bg-paper">
      <Header storeName={storeName} cartCount={0} onCartOpen={() => {}} navItems={NAV_ITEMS} />

      <main className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-4 text-center">
        <span
          className="pointer-events-none absolute select-none font-display text-[120px] font-bold leading-none text-ink/10 sm:text-[180px]"
          aria-hidden="true"
        >
          404
        </span>

        <div className="relative animate-fade-up">
          <h1 className="mb-4 font-display text-[1.75rem] font-bold text-ink sm:text-[2.5rem]">Page not found</h1>
          <p className="mx-auto mb-8 max-w-sm text-sm leading-relaxed text-ink-soft sm:text-base">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="mb-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button as={Link} to="/" variant="primary" size="lg">
              ← Go Home
            </Button>
            <Button as={Link} to="/shop" variant="secondary" size="lg">
              Browse Products
            </Button>
          </div>
        </div>
      </main>

      <Footer storeName={storeName} />
    </div>
  )
}
