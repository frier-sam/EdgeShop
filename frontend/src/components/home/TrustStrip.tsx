import { PackageIcon, RefreshIcon, ShieldCheckIcon, SparkleIcon, TruckIcon } from './icons'

// Matches storeConfig.ts's inline `TRUST_ITEMS` element type (POD-UI2.md
// §3/E6) — that file exports the array without a named interface for it,
// so this is declared locally rather than imported.
interface TrustItem {
  icon: string
  title: string
  subtitle: string
}

interface TrustStripProps {
  items: TrustItem[]
}

// Resolves a TRUST_ITEMS `icon` string key to a component. Substring
// matching (rather than an exact-key map) so this keeps working once the
// real storeConfig.CATEGORIES/TRUST_ITEMS export lands with whatever exact
// key names it picks, as long as they're recognisably about the same
// concept — falling back to a generic sparkle glyph otherwise.
function resolveIcon(key: string) {
  const k = key.toLowerCase()
  if (k.includes('ship') || k.includes('truck') || k.includes('deliver')) return TruckIcon
  if (k.includes('secure') || k.includes('payment') || k.includes('shield')) return ShieldCheckIcon
  if (k.includes('return') || k.includes('refund') || k.includes('exchange')) return RefreshIcon
  if (k.includes('order') || k.includes('made') || k.includes('package') || k.includes('print')) return PackageIcon
  return SparkleIcon
}

/** F2 — four USP items. 2x2 grid on mobile so nothing wraps awkwardly or scrolls. */
export default function TrustStrip({ items }: TrustStripProps) {
  return (
    <section className="bg-paper px-4 py-12 sm:px-8 md:py-16">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
        {items.map((item, i) => {
          const Icon = resolveIcon(item.icon)
          return (
            <div
              key={item.title}
              className="stagger-delay animate-fade-up flex flex-col items-center gap-2 rounded-card border border-line bg-surface px-4 py-6 text-center sm:flex-row sm:items-start sm:gap-3 sm:text-left"
              style={{ '--stagger-index': i } as React.CSSProperties}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-dark">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{item.title}</span>
                <span className="block text-xs text-ink-soft">{item.subtitle}</span>
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
