import { Link } from 'react-router-dom'
import { useTheme } from '../themes/ThemeProvider'

export default function NotFoundPage() {
  const { theme, navItems, settings } = useTheme()
  const storeName = settings.store_name ?? 'EdgeShop'
  const Header = theme?.components?.Header
  const Footer = theme?.components?.Footer

  return (
    <div className="min-h-screen">
      {Header && <Header storeName={storeName} cartCount={0} onCartOpen={() => {}} navItems={navItems} />}
      <main className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">Page not found</p>
        <Link to="/" className="px-6 py-3 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors">
          Back to Home
        </Link>
      </main>
      {Footer && <Footer storeName={storeName} />}
    </div>
  )
}
