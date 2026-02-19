import type { HeroProps } from '../types'

export default function Hero({ storeName, tagline }: HeroProps) {
  return (
    <section className="py-20 sm:py-28 text-center border-b border-stone-200" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4">
        <p className="text-xs tracking-[0.3em] uppercase mb-4" style={{ color: 'var(--color-accent)' }}>
          {storeName}
        </p>
        <h2 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }} className="text-4xl sm:text-5xl font-semibold mb-6 leading-tight">
          {tagline}
        </h2>
        <div className="w-12 h-px mx-auto" style={{ backgroundColor: 'var(--color-accent)' }} />
      </div>
    </section>
  )
}
