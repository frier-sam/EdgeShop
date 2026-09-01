import { HOW_IT_WORKS_STEPS } from './homeContent'
import { ShirtIcon, DesignIcon, ParcelIcon } from './icons'

// Step icons are inline SVG, NOT images.
//
// An earlier pass used real generated process photographs here
// (POD-UI2.md §7.2). Those files were only ever written to LOCAL R2 by
// scripts/generate-mockups.py — production R2 starts empty, so every one
// of them 404s on a fresh deploy and the section renders three broken
// frames. Inline SVG ships inside the JS bundle, so it renders correctly
// in every environment with no upload step and no extra request.
//
// The rest of the homepage's imagery is unaffected: category tiles and the
// hero composition both read merchant-uploaded product photos through the
// API, which do exist in production once the catalogue has products.
const STEP_ICONS = [ShirtIcon, DesignIcon, ParcelIcon]

function StepIcon({ index }: { index: number }) {
  const Icon = STEP_ICONS[index]
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-card bg-accent-soft text-accent ring-1 ring-line">
      <Icon className="h-6 w-6" />
    </div>
  )
}

/**
 * F5 / §7.2 — "how it works". Desktop: three steps with a connecting line
 * behind the numbered badges. Mobile: a tight horizontal snap-scroll
 * carousel instead of a tall vertical stack, so the section stays compact
 * rather than leaving large dead gaps (POD-UI2.md §1 problem #5 / §3/F5).
 *
 * Card width bug note: an earlier pass used `min-w-[78%]` on these
 * carousel cards, but inside a flex row `flex-basis` defaults to `auto`,
 * so `min-width` only ever raised the floor — the card's actual basis was
 * its (much wider) content, which blew a 78%-intended card out to ~604px
 * on a 390px screen. `w-[78%]` sets the basis directly.
 */
export default function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-line bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8 md:py-20">
        <h2 className="mb-8 text-center font-display text-[1.25rem] font-semibold text-ink md:mb-14 md:text-[1.75rem]">
          How it works
        </h2>

        {/* Mobile / tablet: compact snap-scroll cards. */}
        <div
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [&::-webkit-scrollbar]:hidden md:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <div
              key={step.title}
              className="stagger-delay animate-fade-up w-[78%] shrink-0 snap-center rounded-card border border-line bg-surface p-5"
              style={{ '--stagger-index': i } as React.CSSProperties}
            >
              <StepIcon index={i} />
              <div className="mt-4 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent">
                  {i + 1}
                </span>
                <h3 className="text-sm font-semibold text-ink">{step.title}</h3>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{step.description}</p>
            </div>
          ))}
        </div>

        {/* Desktop: a fixed-height badge row (line + numbers) above each
            icon. The line is anchored to that fixed-height row so it stays
            exactly centred on the badges at every viewport width. */}
        <div className="relative hidden md:grid md:grid-cols-3 md:gap-8">
          <div className="pointer-events-none absolute left-[16.6667%] right-[16.6667%] top-4 h-px bg-line" aria-hidden="true" />
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <div
              key={step.title}
              className="stagger-delay animate-fade-up relative flex flex-col items-center text-center"
              style={{ '--stagger-index': i } as React.CSSProperties}
            >
              <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent ring-4 ring-paper">
                {i + 1}
              </span>
              <div className="mt-6">
                <StepIcon index={i} />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-ink">{step.title}</h3>
              <p className="mt-1.5 max-w-[220px] text-sm leading-relaxed text-ink-soft">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
