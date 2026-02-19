import type { HeroProps } from '../types'

export default function Hero({ storeName, tagline }: HeroProps) {
  return (
    <section className="py-20 sm:py-28 text-center border-b-2 border-amber-200" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4">
        <p className="text-xs tracking-[0.3em] uppercase font-bold mb-4" style={{ color: 'var(--color-accent)' }}>
          {storeName}
        </p>
        <h2 className="text-4xl sm:text-5xl font-bold tracking-wider uppercase mb-6 leading-tight" style={{ color: 'var(--color-primary)' }}>
          {tagline}
        </h2>
        <div className="w-16 h-1 mx-auto rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />
      </div>
    </section>
  )
}
