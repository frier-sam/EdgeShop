import { Link } from 'react-router-dom'
import { jewelleryConfig } from './config'

interface CollectionItem {
  label: string
  href: string
}

interface CategoryRowProps {
  enabled?: boolean
  items?: CollectionItem[]
}

/* Dark warm gradient tiles — premium jewellery palette */
const TILE_GRADIENTS = [
  'linear-gradient(145deg, #12100C 0%, #2C1E10 100%)',
  'linear-gradient(145deg, #0C0C0C 0%, #221808 100%)',
  'linear-gradient(145deg, #1A1008 0%, #3A2010 100%)',
  'linear-gradient(145deg, #080808 0%, #1E1608 100%)',
  'linear-gradient(145deg, #160E06 0%, #302010 100%)',
  'linear-gradient(145deg, #0E0E0E 0%, #1E1608 100%)',
]

export default function CategoryRow({ enabled = true, items }: CategoryRowProps) {
  if (!enabled) return null

  const collections: CollectionItem[] = items && items.length > 0
    ? items
    : jewelleryConfig.collectionLinks

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
      <style>{`
        @keyframes tile-shine {
          0%   { left: -80%; opacity: 0; }
          20%  { opacity: 0.06; }
          100% { left: 180%; opacity: 0; }
        }
        .cat-tile:hover .tile-shine-bar {
          animation: tile-shine 0.75s ease forwards;
        }
      `}</style>

      <p
        className="text-[10px] tracking-[0.48em] uppercase mb-8 text-center font-medium"
        style={{ color: 'var(--color-accent)' }}
      >
        Shop by Collection
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {collections.map((col, index) => (
          <Link
            key={col.label}
            to={col.href}
            className="cat-tile group relative aspect-square overflow-hidden"
            style={{ background: TILE_GRADIENTS[index % TILE_GRADIENTS.length] }}
          >
            {/* Background layer that scales on hover */}
            <div
              className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-110"
              style={{ background: TILE_GRADIENTS[index % TILE_GRADIENTS.length] }}
            />

            {/* Diamond lattice overlay */}
            <svg
              className="absolute inset-0 w-full h-full"
              xmlns="http://www.w3.org/2000/svg"
              style={{ opacity: 0.07 }}
              aria-hidden="true"
            >
              <defs>
                <pattern id={`catdp-${index}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <polygon points="10,1 19,10 10,19 1,10" fill="none" stroke="#C9A96E" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#catdp-${index})`} />
            </svg>

            {/* Shine sweep */}
            <div
              className="tile-shine-bar absolute top-0 bottom-0 w-1/2 -skew-x-12 pointer-events-none"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', left: '-80%' }}
            />

            {/* Decorative corner diamond */}
            <span
              className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rotate-45 transition-all duration-300 group-hover:scale-150 group-hover:opacity-80"
              style={{ backgroundColor: '#C9A96E', opacity: 0.45 }}
            />

            {/* Content */}
            <div className="absolute inset-0 z-10 flex flex-col justify-end p-3 sm:p-4">
              <p
                className="text-[11px] sm:text-xs tracking-[0.22em] uppercase font-semibold leading-tight transition-all duration-300 group-hover:-translate-y-0.5"
                style={{ color: '#C9A96E' }}
              >
                {col.label}
              </p>
              <svg
                width="14"
                height="8"
                viewBox="0 0 14 8"
                fill="none"
                stroke="#C9A96E"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-1 transition-all duration-300 opacity-0 group-hover:opacity-55 group-hover:translate-x-1"
                aria-hidden="true"
              >
                <line x1="0" y1="4" x2="10" y2="4" />
                <polyline points="7 1 10 4 7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
