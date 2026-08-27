import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '../../lib/api'

// POD-UI2.md §7.1 — backend-driven, no more hardcoded storeConfig list.
// `name` doubles as the tile label and the `?category=` value: the worker
// groups on the raw `products.category` column and the products list
// endpoint filters with an exact `p.category = ?` (case-sensitive), so
// this must stay byte-identical, not a slugified/title-cased derivation.
export interface StorefrontCategory {
  name: string
  count: number
  image: string | null
}

interface CategoriesResponse {
  categories: StorefrontCategory[]
}

function CategoryTile({ cat, index }: { cat: StorefrontCategory; index: number }) {
  // Falls back to a plain neutral tile (no <img>) if there's no
  // representative image at all, or the one the API returned 404s —
  // rather than showing a broken-image glyph.
  const [imgFailed, setImgFailed] = useState(!cat.image)

  return (
    <Link
      to={`/shop?category=${encodeURIComponent(cat.name)}`}
      className="stagger-delay animate-fade-up group relative block aspect-square overflow-hidden rounded-card bg-surface-2 ring-1 ring-line"
      style={{ '--stagger-index': index } as React.CSSProperties}
    >
      {!imgFailed && cat.image && (
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
        {cat.name}
      </span>
    </Link>
  )
}

/** F3 — image tiles linking into the shop, pre-filtered by category. Backend-driven (POD-UI2.md §7.1) — renders nothing while loading, on error, or when the catalogue has no active categories at all. */
export default function ShopByCategory() {
  const { data } = useQuery<CategoriesResponse>({
    queryKey: ['categories'],
    queryFn: () => fetchJson<CategoriesResponse>('/api/categories'),
    staleTime: 5 * 60 * 1000,
  })
  const categories = data?.categories ?? []

  if (categories.length === 0) return null

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-8 md:py-20">
      <h2 className="mb-8 font-display text-[1.25rem] font-semibold text-ink md:text-[1.75rem]">Shop by category</h2>
      <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4">
        {categories.map((cat, i) => (
          <CategoryTile key={cat.name} cat={cat} index={i} />
        ))}
      </div>
    </section>
  )
}
