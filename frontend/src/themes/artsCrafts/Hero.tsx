import { Link } from 'react-router-dom'
import type { HeroProps } from '../types'

export default function Hero({ storeName, tagline }: HeroProps) {
  const heroImage = getComputedStyle(document.documentElement).getPropertyValue('--hero-image').trim()

  return (
    <section
      className="relative min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Background image with warm overlay */}
      {heroImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-25"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
      )}
      {/* Warm earthy gradient overlay */}
      <div
        className="absolute inset-0 opacity-15"
        style={{ background: `linear-gradient(160deg, var(--color-accent) 0%, var(--color-primary) 100%)` }}
      />

      {/* Decorative corner element */}
      <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 opacity-30" style={{ borderColor: 'var(--color-accent)' }} />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 opacity-30" style={{ borderColor: 'var(--color-accent)' }} />

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
        <p
          className="text-xs tracking-[0.4em] uppercase mb-6 font-bold"
          style={{ color: 'var(--color-accent)' }}
        >
          {storeName}
        </p>
        <h2
          className="text-4xl sm:text-6xl font-bold tracking-wider uppercase mb-6 leading-tight"
          style={{ color: 'var(--color-primary)' }}
        >
          {tagline}
        </h2>
        <div className="w-16 h-1 mx-auto mb-8 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />
        <Link
          to="/search"
          className="inline-block px-8 py-3 text-xs tracking-[0.2em] uppercase font-bold rounded-full transition-all duration-300 hover:opacity-80"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#FFFFFF',
          }}
        >
          Shop Now
        </Link>
      </div>
    </section>
  )
}
