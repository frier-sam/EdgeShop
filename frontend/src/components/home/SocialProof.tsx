import Icon from '../ui/Icon'
import { TESTIMONIALS } from './homeContent'

// `star` (POD-UI4.md §2.2) is dedicated to ratings — never part of the
// accent system — so filled stars use `text-star`, not `text-accent`.
function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon key={i} name="star" size={16} fill={i < rating} className={i < rating ? 'text-star' : 'text-line'} />
      ))}
    </div>
  )
}

/**
 * F6 — three short, clearly-illustrative testimonials (first names only, no
 * photos, no specific/verifiable claims). See homeContent.ts for the
 * rationale — these must not read as fabricated real reviews.
 */
export default function SocialProof() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 md:px-10 md:py-16">
      <h2 className="mb-8 text-center font-display text-headline-md text-ink md:mb-12">What people are designing</h2>
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
              <span className="flex h-8 w-8 items-center justify-center rounded-pill bg-accent-soft text-xs font-semibold text-accent-dark">
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
