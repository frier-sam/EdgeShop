import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Category } from '../../lib/storeConfig'

interface ShopByCategoryProps {
  categories: Category[]
}

function CategoryTile({ cat, index }: { cat: Category; index: number }) {
  // Falls back to a plain neutral tile (no <img>) if the curated image 404s,
  // rather than showing a broken-image glyph — e.g. while mockups are still
  // being regenerated (POD-UI2.md §3/E5) concurrently with this workstream.
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <Link
      to={`/shop?category=${encodeURIComponent(cat.slug)}`}
      className="stagger-delay animate-fade-up group relative block aspect-square overflow-hidden rounded-card bg-surface-2 ring-1 ring-line"
      style={{ '--stagger-index': index } as React.CSSProperties}
    >
      {!imgFailed && (
        <img
          src={cat.image}
          alt=""
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover transition-transform duration-slow ease-out-soft md:group-hover:scale-110"
        />
      )}
      <div
        className={imgFailed ? 'absolute inset-0 bg-surface-2' : 'absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/0 to-ink/0'}
        aria-hidden="true"
      />
      <span
        className={`absolute inset-x-0 bottom-0 flex min-h-11 items-center justify-center px-2 py-3 text-center text-sm font-semibold ${
          imgFailed ? 'text-ink' : 'text-on-accent'
        }`}
      >
        {cat.label}
      </span>
    </Link>
  )
}

/** F3 — image tiles linking into the shop, pre-filtered by category. */
export default function ShopByCategory({ categories }: ShopByCategoryProps) {
  if (categories.length === 0) return null

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-8 md:py-20">
      <h2 className="mb-8 font-display text-[1.25rem] font-semibold text-ink md:text-[1.75rem]">Shop by category</h2>
      <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4">
        {categories.map((cat, i) => (
          <CategoryTile key={cat.slug} cat={cat} index={i} />
        ))}
      </div>
    </section>
  )
}
