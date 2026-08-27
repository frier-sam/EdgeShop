import Badge from '../ui/Badge'
import { Skeleton } from '../Skeleton'
import type { ProductSummary } from '../../lib/types'

interface ProductCompositionProps {
  products: ProductSummary[]
  currency: string
  isLoading: boolean
}

// Shared frame for every tile: a fixed `bg-surface-2` mat behind the photo
// via `object-contain` + padding. This is deliberate, not decorative — the
// current catalog mixes product photos shot on different grounds (white,
// cream, off-white — POD-UI2.md §1 problem #3), so a uniform card mat is
// what keeps the composition looking like one system regardless of what
// each individual mockup's own background happens to be.
const TILE_FRAME =
  'absolute overflow-hidden rounded-card bg-surface-2 ring-1 ring-line animate-home-float'

// Float delays are staggered so the three tiles don't bob in lockstep —
// purely cosmetic, has no effect on layout (see home.css).
const TILE_LAYOUT = [
  { wrap: `${TILE_FRAME} left-[4%] top-[6%] z-0 w-[62%] shadow-card`, rotate: '-6deg', delay: '0s' },
  { wrap: `${TILE_FRAME} bottom-[6%] right-[2%] z-20 w-[58%] shadow-lift`, rotate: '5deg', delay: '0.9s' },
  { wrap: `${TILE_FRAME} bottom-[0%] left-[0%] z-10 hidden w-[34%] shadow-card sm:block`, rotate: '-4deg', delay: '1.6s' },
]

function EmptyTile() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-faint">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M4 7v10l8 4 8-4V7l-8-4-8 4Z" />
      </svg>
      <span className="text-xs">Catalog loading</span>
    </div>
  )
}

export default function ProductComposition({ products, currency, isLoading }: ProductCompositionProps) {
  const tiles = products.slice(0, 3)
  const priceTile = tiles[1] ?? tiles[0]

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-sm md:mx-0 md:max-w-none">
      {/* Soft depth glow behind the composition — tokens only, no hex. */}
      <div
        className="absolute inset-[10%] -z-10 rounded-full bg-accent-soft opacity-80 blur-3xl"
        aria-hidden="true"
      />

      {isLoading
        ? TILE_LAYOUT.map((tile, i) => (
            <div key={i} className={tile.wrap} style={{ transform: `rotate(${tile.rotate})`, animationDelay: tile.delay }}>
              <Skeleton className="h-full w-full rounded-none" />
            </div>
          ))
        : tiles.length === 0
          ? (
              <div className={`${TILE_FRAME} inset-[8%] w-auto shadow-card`} style={{ animationDelay: '0s' }}>
                <EmptyTile />
              </div>
            )
          : tiles.map((product, i) => {
              const layout = TILE_LAYOUT[i]
              return (
                <div
                  key={product.id}
                  className={`${layout.wrap} aspect-square`}
                  style={{ transform: `rotate(${layout.rotate})`, animationDelay: layout.delay }}
                >
                  {product.front_image ? (
                    <img
                      src={product.front_image}
                      alt={product.name}
                      className="h-full w-full object-contain p-4 sm:p-5"
                      loading="eager"
                    />
                  ) : (
                    <EmptyTile />
                  )}
                </div>
              )
            })}

      {!isLoading && priceTile && (
        <Badge variant="accent" size="md" className="absolute right-[4%] top-[2%] z-30 shadow-card">
          From {currency}
          {priceTile.base_price.toFixed(0)}
        </Badge>
      )}
    </div>
  )
}
