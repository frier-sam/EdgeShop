import { Link } from 'react-router-dom'
import type { HeroProps } from '../types'

export default function Hero({ storeName, tagline }: HeroProps) {
  const heroImage = getComputedStyle(document.documentElement).getPropertyValue('--hero-image').trim()

  return (
    <section
      className="relative min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Background image */}
      {heroImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
      )}
      {/* Gradient overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{ background: `linear-gradient(135deg, var(--color-accent) 0%, transparent 60%)` }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
        <p
          className="text-xs tracking-[0.4em] uppercase mb-6 font-light"
          style={{ color: 'var(--color-accent)' }}
        >
          {storeName}
        </p>
        <h2
          style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
          className="text-4xl sm:text-6xl font-semibold mb-6 leading-tight"
        >
          {tagline}
        </h2>
        <div className="w-12 h-px mx-auto mb-8" style={{ backgroundColor: 'var(--color-accent)' }} />
        <Link
          to="/search"
          className="inline-block px-8 py-3 text-xs tracking-[0.2em] uppercase border transition-all duration-300 hover:opacity-80"
          style={{
            borderColor: 'var(--color-primary)',
            color: 'var(--color-bg)',
            backgroundColor: 'var(--color-primary)',
          }}
        >
          Shop Now
        </Link>
      </div>
    </section>
  )
}
