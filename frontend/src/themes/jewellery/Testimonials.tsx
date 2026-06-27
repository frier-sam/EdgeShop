const DEFAULT_REVIEWS = [
  {
    name: 'Priya S.',
    location: 'Mumbai',
    rating: 5,
    text: 'Absolutely love my ring! The quality is exceptional and it arrived beautifully packaged. Will definitely be ordering again.',
  },
  {
    name: 'Ananya K.',
    location: 'Bengaluru',
    rating: 5,
    text: 'The necklace I gifted my mother made her cry happy tears. Stunning craftsmanship at a great price.',
  },
  {
    name: 'Meera R.',
    location: 'Delhi',
    rating: 5,
    text: 'Fast shipping, easy returns policy, and the earrings look even better in person. Highly recommend!',
  },
]

interface TestimonialsProps {
  enabled?: boolean
  heading?: string
  items?: { name: string; location: string; rating: number; text: string }[]
}

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5 mb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill={i < count ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={i < count ? 0 : 1.5}
          className="w-3.5 h-3.5"
          style={{ color: 'var(--color-accent)' }}
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export default function Testimonials({ enabled = true, heading = 'What Our Customers Say', items }: TestimonialsProps) {
  if (!enabled) return null

  const reviews = items && items.length > 0 ? items : DEFAULT_REVIEWS

  return (
    <section
      className="py-16"
      style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 5%, var(--color-bg))' }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center mb-12">
          <p
            className="text-[10px] tracking-[0.45em] uppercase mb-3 font-medium"
            style={{ color: 'var(--color-accent)' }}
          >
            Customer Stories
          </p>
          <h2
            className="text-xl sm:text-2xl font-semibold"
            style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
          >
            {heading}
          </h2>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="h-px w-10" style={{ backgroundColor: 'var(--color-accent)', opacity: 0.35 }} />
            <span className="w-1.5 h-1.5 rotate-45 block" style={{ backgroundColor: 'var(--color-accent)', opacity: 0.5 }} />
            <div className="h-px w-10" style={{ backgroundColor: 'var(--color-accent)', opacity: 0.35 }} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {reviews.map((review, i) => (
            <article
              key={i}
              className="relative p-6 overflow-hidden"
              style={{
                backgroundColor: 'var(--color-bg)',
                border: '1px solid color-mix(in srgb, var(--color-accent) 18%, transparent)',
              }}
            >
              {/* Decorative large quotation mark */}
              <svg
                className="absolute top-3 right-4"
                width="44"
                height="36"
                viewBox="0 0 44 36"
                fill="currentColor"
                aria-hidden="true"
                style={{ color: 'var(--color-accent)', opacity: 0.07 }}
              >
                <path d="M0 36V23.04C0 16.56 1.44 11.16 4.32 6.84 7.2 2.52 11.88 0 18.36 0v6.48c-2.88 0-5.04 1.08-6.48 3.24C10.44 11.88 9.72 14.4 9.72 17.28h8.64V36H0zm23.4 0V23.04c0-6.48 1.44-11.88 4.32-16.2C30.6 2.52 35.28 0 41.76 0v6.48c-2.88 0-5.04 1.08-6.48 3.24-1.44 2.16-2.16 4.68-2.16 7.56h9.36V36H23.4z" />
              </svg>

              <StarRow count={review.rating} />

              <p
                className="text-sm leading-relaxed mb-6 relative"
                style={{ color: 'var(--color-primary)', opacity: 0.78, fontStyle: 'italic' }}
              >
                &ldquo;{review.text}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 65%, #000) 100%)',
                    color: '#fff',
                    fontFamily: "'Playfair Display', serif",
                  }}
                >
                  {review.name[0]}
                </span>
                <div>
                  <p className="text-xs font-semibold tracking-wide" style={{ color: 'var(--color-primary)' }}>
                    {review.name}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--color-primary)', opacity: 0.42 }}>
                    {review.location}
                  </p>
                </div>
              </div>

              {/* Bottom accent line */}
              <div
                className="absolute bottom-0 left-6 right-6 h-px"
                style={{ backgroundColor: 'var(--color-accent)', opacity: 0.12 }}
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
