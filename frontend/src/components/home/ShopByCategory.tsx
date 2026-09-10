import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '../../lib/api'
import ProductRail from '../ProductRail'

// POD-UI2.md §7.1 — backend-driven, no more hardcoded storeConfig list.
// `name` doubles as the tile label and the `?category=` value: the worker
// groups on the raw `products.category` column and the products list
// endpoint filters with an exact `p.category = ?` (case-sensitive), so
// this must stay byte-identical, not a slugified/title-cased derivation.
//
// Exported for HeroCarousel.tsx, which fetches the same `/api/categories`
// shape for its slides (POD-UI4.md §4.4) — one shared type instead of two
// structurally-identical local ones.
export interface StorefrontCategory {
  name: string
  count: number
  image: string | null
}

interface CategoriesResponse {
  categories: StorefrontCategory[]
}

// POD-UI4.md §4/H3 / §5 B.4 — compact tile: a square image (or a plain
// neutral fallback) with the category name as its own label underneath,
// rather than the old text-over-gradient overlay. That overlay logic is
// gone entirely now: with the label no longer sharing space with the
// image, "the image failed to load" just means the tile shows its
// `bg-surface-2` ground and nothing else — the label renders unconditionally.
function CategoryTile({ cat, index }: { cat: StorefrontCategory; index: number }) {
  const [imgFailed, setImgFailed] = useState(!cat.image)

  return (
    <Link
      to={`/shop?category=${encodeURIComponent(cat.name)}`}
      className="stagger-delay animate-fade-up group flex w-32 shrink-0 snap-start flex-col items-center gap-3 md:w-40"
      style={{ '--stagger-index': index } as React.CSSProperties}
    >
      <div className="aspect-square w-full overflow-hidden rounded-card bg-surface-2 ring-1 ring-line">
        {!imgFailed && cat.image && (
          <img
            src={cat.image}
            alt=""
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-slow ease-out-soft group-hover:scale-105"
          />
        )}
      </div>
      <span className="text-center font-label text-label-md text-ink">{cat.name}</span>
    </Link>
  )
}

/**
 * H3 (POD-UI4.md §3.2/§4/H3) — a horizontal snap-scroll rail of category
 * tiles, backend-driven off GET /api/categories (POD-UI2.md §7.1).
 * `ProductRail` already renders nothing when it has no children, so the
 * "no categories" case needs no separate empty-state branch here beyond
 * the query itself resolving to an empty list.
 */
export default function ShopByCategory() {
  const { data } = useQuery<CategoriesResponse>({
    queryKey: ['categories'],
    queryFn: () => fetchJson<CategoriesResponse>('/api/categories'),
    staleTime: 5 * 60 * 1000,
  })
  const categories = data?.categories ?? []

  return (
    <ProductRail title="Shop by category">
      {categories.map((cat, i) => (
        <CategoryTile key={cat.name} cat={cat} index={i} />
      ))}
    </ProductRail>
  )
}
