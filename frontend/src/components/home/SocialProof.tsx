import { StarIcon } from './icons'
import { TESTIMONIALS } from './homeContent'

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 text-accent" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon key={i} className="h-4 w-4" filled={i < rating} />
      ))}
    </div>
  )
}

/**
 * F6 — three short, clearly-illustrative testimonials (first names only, no
 * photos, no specific/verifiable claims). See homeContent.ts for the
 * rationale — POD-UI2.md §3/F6 is explicit that these must not read as
 * fabricated real reviews.
 */
export default function SocialProof() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-8 md:py-20">
      <h2 className="mb-8 text-center font-display text-[1.25rem] font-semibold text-ink md:mb-12 md:text-[1.75rem]">
        What people are designing
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <div
            key={t.name}
            className="stagger-delay animate-fade-up rounded-card border border-line bg-surface p-6"
            style={{ '--stagger-index': i } as React.CSSProperties}
          >
            <Stars rating={t.rating} />
            <p className="mt-3 text-sm leading-relaxed text-ink">&ldquo;{t.quote}&rdquo;</p>
            <div className="mt-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-dark">
                {t.name.charAt(0)}
              </span>
              <span className="text-xs font-medium text-ink-soft">{t.name}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
