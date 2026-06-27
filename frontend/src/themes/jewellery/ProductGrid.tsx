import { useEffect, useRef } from 'react'
import type { ProductGridProps } from '../types'
import ProductCard from './ProductCard'

export default function ProductGrid({ products, currency, onAddToCart }: ProductGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const items = gridRef.current?.querySelectorAll<HTMLElement>('.pg-card')
    if (!items || items.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            el.style.opacity = '1'
            el.style.transform = 'translateY(0)'
            observer.unobserve(el)
          }
        })
      },
      { threshold: 0.06, rootMargin: '0px 0px -48px 0px' }
    )

    items.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [products])

  if (products.length === 0) {
    return (
      <div className="text-center py-24">
        <span
          className="block w-2 h-2 rotate-45 mx-auto mb-6"
          style={{ backgroundColor: 'var(--color-accent)', opacity: 0.35 }}
        />
        <p className="text-xs tracking-[0.35em] uppercase" style={{ color: 'var(--color-accent)' }}>
          No products yet
        </p>
      </div>
    )
  }

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      {/* Ornamental section header */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-accent)', opacity: 0.22 }} />
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rotate-45 block shrink-0" style={{ backgroundColor: 'var(--color-accent)', opacity: 0.55 }} />
          <h2
            className="text-xl sm:text-2xl font-semibold tracking-wide whitespace-nowrap"
            style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
          >
            Our Collection
          </h2>
          <span className="w-1.5 h-1.5 rotate-45 block shrink-0" style={{ backgroundColor: 'var(--color-accent)', opacity: 0.55 }} />
        </div>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-accent)', opacity: 0.22 }} />
      </div>

      <div className="text-center mb-12">
        <span className="text-[10px] tracking-[0.32em] uppercase" style={{ color: 'var(--color-accent)' }}>
          {products.length} {products.length === 1 ? 'piece' : 'pieces'}
        </span>
      </div>

      <div
        ref={gridRef}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12"
      >
        {products.map((p, index) => (
          <div
            key={p.id}
            className="pg-card"
            style={{
              opacity: 0,
              transform: 'translateY(30px)',
              transition: `opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1), transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)`,
              transitionDelay: `${Math.min(index % 4, 3) * 75}ms`,
            }}
          >
            <ProductCard
              {...p}
              currency={currency}
              onAddToCart={() => onAddToCart(p.id)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
