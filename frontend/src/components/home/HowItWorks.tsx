import { GridIcon, PencilIcon, PrinterIcon } from './icons'
import { HOW_IT_WORKS_STEPS } from './homeContent'

const STEP_ICONS = [GridIcon, PencilIcon, PrinterIcon]

/** Small decorative hint for step 2 — a mockup with a design patch placed on
 * it, standing in for the editor. Purely illustrative DOM shapes, no asset
 * dependency and nothing that could be mistaken for a real screenshot. */
function EditorHintVisual() {
  return (
    <div
      className="relative mt-1 flex h-14 w-16 shrink-0 items-center justify-center rounded-card border border-line bg-surface-2 md:mt-4 md:h-16 md:w-20"
      aria-hidden="true"
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" className="text-ink-faint">
        <path d="M8 2 3 6v4h3v10h12V10h3V6l-5-4-2 2h-2L8 2Z" />
      </svg>
      <span className="absolute h-3.5 w-3.5 rotate-12 rounded-sm bg-accent shadow-card" />
    </div>
  )
}

/**
 * F5 — redesigned "how it works". Desktop: three steps with icons and a
 * connecting line through the icon centers. Mobile: a tight horizontal
 * snap-scroll carousel instead of a tall vertical stack, so the section
 * stays compact instead of leaving large dead gaps (POD-UI2.md §1 problem
 * #5 / §3/F5).
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
          {HOW_IT_WORKS_STEPS.map((step, i) => {
            const Icon = STEP_ICONS[i]
            return (
              <div
                key={step.title}
                className="stagger-delay animate-fade-up flex w-[78%] shrink-0 snap-center gap-3 rounded-card border border-line bg-surface p-5"
                style={{ '--stagger-index': i } as React.CSSProperties}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xs font-bold text-ink-faint">0{i + 1}</span>
                    <h3 className="text-sm font-semibold text-ink">{step.title}</h3>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.description}</p>
                  {i === 1 && <EditorHintVisual />}
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop: icons on a connecting line. */}
        <div className="relative hidden md:grid md:grid-cols-3 md:gap-8">
          <div className="pointer-events-none absolute left-[16.6667%] right-[16.6667%] top-7 h-px bg-line" aria-hidden="true" />
          {HOW_IT_WORKS_STEPS.map((step, i) => {
            const Icon = STEP_ICONS[i]
            return (
              <div
                key={step.title}
                className="stagger-delay animate-fade-up relative flex flex-col items-center text-center"
                style={{ '--stagger-index': i } as React.CSSProperties}
              >
                <div className="relative inline-flex">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-card">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface text-[10px] font-bold text-ink ring-1 ring-line">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-ink">{step.title}</h3>
                <p className="mt-1.5 max-w-[220px] text-sm leading-relaxed text-ink-soft">{step.description}</p>
                {i === 1 && <EditorHintVisual />}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
