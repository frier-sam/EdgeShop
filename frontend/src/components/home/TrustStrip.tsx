import Icon from '../ui/Icon'
import type { IconName } from '../ui/iconNames'

// Matches storeConfig.ts's inline `TRUST_ITEMS` element type (owned by
// another agent this round) — that file exports the array without a named
// interface for it, so this is declared locally rather than imported.
interface TrustItem {
  icon: string
  title: string
  subtitle: string
}

interface TrustStripProps {
  items: TrustItem[]
}

// storeConfig.TRUST_ITEMS' `icon` values name a merchant-facing concept
// ('made-to-order', 'shipping', …), not a Material Symbols glyph — this is
// the one place that maps one to the other. `local_shipping`/`shield`/
// `autorenew`/`design_services` are exactly the four POD-UI4.md §5 B.3
// names to the right glyph for; an unrecognised key (storeConfig gains a
// fifth item without this map being updated) falls back to a generic icon
// rather than an empty circle.
const ICON_MAP: Record<string, IconName> = {
  'made-to-order': 'design_services',
  shipping: 'local_shipping',
  'secure-payment': 'shield',
  returns: 'autorenew',
}
const FALLBACK_ICON: IconName = 'help'

/**
 * H2 (POD-UI4.md §3.2/§4/H2) — the comp's value-prop band: a filled icon in
 * a mint circle, a bold title, a muted subtitle. Row with vertical dividers
 * on desktop, 2x2 grid on mobile so nothing wraps awkwardly or scrolls.
 */
export default function TrustStrip({ items }: TrustStripProps) {
  return (
    <section className="border-y border-line bg-surface px-4 py-10 md:px-10 md:py-14">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4 md:gap-x-0 md:divide-x md:divide-line">
        {items.map((item, i) => (
          <div
            key={item.title}
            className="stagger-delay animate-fade-up flex flex-col items-center gap-3 text-center md:flex-row md:items-center md:gap-4 md:px-6 md:text-left md:first:pl-0 md:last:pr-0"
            style={{ '--stagger-index': i } as React.CSSProperties}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-surface-4 text-accent">
              <Icon name={ICON_MAP[item.icon] ?? FALLBACK_ICON} fill />
            </span>
            <div>
              <h3 className="font-label text-label-md text-primary">{item.title}</h3>
              <p className="text-body-sm text-ink-soft">{item.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
