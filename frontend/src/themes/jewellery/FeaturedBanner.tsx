import { Link } from 'react-router-dom'

interface FeaturedBannerProps {
  enabled?: boolean
  title?: string
  subtitle?: string
  image?: string
  href?: string
  ctaLabel?: string
}

export default function FeaturedBanner({
  enabled = true,
  title = 'The Gold Edit',
  subtitle = 'Timeless pieces for every occasion — curated with love.',
  image = '',
  href = '/shop',
  ctaLabel = 'Explore the Collection',
}: FeaturedBannerProps) {
  if (!enabled) return null

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <div className="relative overflow-hidden flex flex-col sm:flex-row">
        {/* Text side — dark background for drama */}
        <div
          className="flex-1 px-8 py-12 sm:py-16 flex flex-col justify-center relative overflow-hidden"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {/* Subtle diamond pattern on text side */}
          <svg
            className="absolute inset-0 w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
            style={{ opacity: 0.04 }}
            aria-hidden="true"
          >
            <defs>
              <pattern id="bannerDp" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                <polygon points="16,1 31,16 16,31 1,16" fill="none" stroke="#C9A96E" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#bannerDp)" />
          </svg>

          {/* Gold accent bar on left */}
          <div
            className="absolute left-0 top-8 bottom-8 w-0.5"
            style={{ backgroundColor: 'var(--color-accent)' }}
          />

          <div className="relative">
            <p
              className="text-[10px] tracking-[0.45em] uppercase mb-4 font-medium"
              style={{ color: 'var(--color-accent)' }}
            >
              Featured Collection
            </p>
            <h2
              className="text-3xl sm:text-4xl font-semibold mb-1 leading-tight"
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-bg)' }}
            >
              {title}
            </h2>
            {/* Italic variant for visual interest */}
            <h2
              className="text-3xl sm:text-4xl font-semibold mb-5 leading-tight italic"
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-accent)' }}
            >
              &amp; more
            </h2>
            <p
              className="text-sm leading-relaxed mb-8 max-w-xs"
              style={{ color: 'var(--color-bg)', opacity: 0.65 }}
            >
              {subtitle}
            </p>
            <Link
              to={href}
              className="group inline-flex items-center gap-3 text-xs tracking-[0.22em] uppercase font-medium transition-all duration-300 hover:gap-5"
              style={{ color: 'var(--color-accent)' }}
            >
              {ctaLabel}
              <svg
                width="18"
                height="10"
                viewBox="0 0 18 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-300"
              >
                <line x1="0" y1="5" x2="14" y2="5" />
                <polyline points="10 1 14 5 10 9" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Image side */}
        {image ? (
          <div className="w-full sm:w-1/2 overflow-hidden">
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover min-h-[240px] transition-transform duration-700 hover:scale-105"
            />
          </div>
        ) : (
          /* Decorative abstract side — no image */
          <div
            className="w-full sm:w-64 h-48 sm:h-auto sm:self-stretch flex items-center justify-center relative overflow-hidden"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 22%, var(--color-bg))' }}
            aria-hidden="true"
          >
            {/* Large diamond motif */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 120 120"
              className="w-32 h-32"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              style={{ color: 'var(--color-primary)', opacity: 0.18 }}
            >
              <polygon points="60,4 116,60 60,116 4,60" />
              <polygon points="60,4 116,60 60,40 4,60" />
              <line x1="4" y1="60" x2="116" y2="60" />
              <line x1="60" y1="40" x2="30" y2="116" />
              <line x1="60" y1="40" x2="90" y2="116" />
              <polygon points="60,20 96,60 60,58 24,60" strokeWidth="0.5" />
            </svg>

            {/* Small floating diamonds */}
            {[
              { top: '15%', left: '18%', size: 5 },
              { top: '75%', left: '72%', size: 4 },
              { top: '55%', left: '15%', size: 3 },
            ].map((d, i) => (
              <span
                key={i}
                className="absolute rotate-45"
                style={{
                  top: d.top,
                  left: d.left,
                  width: d.size,
                  height: d.size,
                  backgroundColor: 'var(--color-accent)',
                  opacity: 0.35,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
