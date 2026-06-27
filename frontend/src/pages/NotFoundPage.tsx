import { Link } from 'react-router-dom'
import { useTheme } from '../themes/ThemeProvider'

export default function NotFoundPage() {
  const { theme, navItems, settings } = useTheme()
  const storeName = settings.store_name ?? 'EdgeShop'
  const Header = theme?.components?.Header
  const Footer = theme?.components?.Footer

  return (
    <>
      <style>{`
        @keyframes not-found-fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .not-found-content {
          opacity: 0;
          animation: not-found-fade-up 0.7s ease forwards;
          animation-delay: 0.1s;
        }
      `}</style>

      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
        {Header && (
          <Header
            storeName={storeName}
            cartCount={0}
            onCartOpen={() => {}}
            navItems={navItems}
          />
        )}

        <main className="relative flex flex-col items-center justify-center min-h-[70vh] text-center px-4 overflow-hidden">

          {/* Decorative background "404" */}
          <span
            className="pointer-events-none select-none absolute text-[120px] sm:text-[180px] font-semibold leading-none"
            style={{
              fontFamily: "'Playfair Display', serif",
              color: 'var(--color-accent)',
              opacity: 0.15,
              zIndex: 0,
            }}
            aria-hidden="true"
          >
            404
          </span>

          {/* Foreground content */}
          <div className="relative not-found-content" style={{ zIndex: 1 }}>
            <h1
              className="text-3xl sm:text-4xl font-semibold mb-4"
              style={{
                fontFamily: "'Playfair Display', serif",
                color: 'var(--color-primary)',
              }}
            >
              Oops, lost in the collection
            </h1>

            <p
              className="text-sm sm:text-base mb-8 max-w-sm mx-auto leading-relaxed"
              style={{ color: 'var(--color-primary)', opacity: 0.55 }}
            >
              The page you're looking for doesn't exist or has been moved.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
              <Link
                to="/"
                className="inline-block px-7 py-3 text-xs tracking-widest uppercase transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-bg)',
                  fontFamily: "'Playfair Display', serif",
                  letterSpacing: '0.12em',
                }}
              >
                ← Go Home
              </Link>
              <Link
                to="/shop"
                className="inline-block px-7 py-3 text-xs tracking-widest uppercase transition-opacity hover:opacity-70"
                style={{
                  border: '1.5px solid var(--color-accent)',
                  color: 'var(--color-accent)',
                  fontFamily: "'Playfair Display', serif",
                  letterSpacing: '0.12em',
                }}
              >
                Browse Products
              </Link>
              <Link
                to="/contact"
                className="inline-block px-7 py-3 text-xs tracking-widest uppercase transition-opacity hover:opacity-60"
                style={{
                  color: 'var(--color-primary)',
                  fontFamily: "'Playfair Display', serif",
                  letterSpacing: '0.12em',
                }}
              >
                Contact Us
              </Link>
            </div>

            {/* Decorative divider */}
            <div className="flex items-center justify-center gap-3 mx-auto max-w-xs">
              <div
                className="flex-1 h-px"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 35%, transparent)' }}
              />
              <span
                className="text-xs"
                style={{ color: 'var(--color-accent)', opacity: 0.6 }}
                aria-hidden="true"
              >
                ✦
              </span>
              <div
                className="flex-1 h-px"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 35%, transparent)' }}
              />
            </div>
          </div>

        </main>

        {Footer && <Footer storeName={storeName} />}
      </div>
    </>
  )
}
