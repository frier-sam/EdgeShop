// Matches storeConfig.ts's inline `TRUST_ITEMS` element type (POD-UI2.md
// §3/E6) — that file exports the array without a named interface for it,
// so this is declared locally rather than imported. `icon` is still on
// the storeConfig export (owned by another agent this round), but this
// component no longer reads it — POD-UI2.md §7.2 removes the decorative
// icons from the trust strip entirely rather than photographing them, so
// there's nothing left to resolve an icon key to. TS structural typing
// lets a `{icon,title,subtitle}[]` value be passed where `{title,
// subtitle}[]` is expected, so the field can simply be dropped here
// without touching storeConfig.ts.
interface TrustItem {
  title: string
  subtitle: string
}

interface TrustStripProps {
  items: TrustItem[]
}

/**
 * F2 / §7.2 — four USP items as a clean typographic band. No icons (a
 * stock photo for "Secure payment" would be contrived — POD-UI2.md §7.2)
 * and no images; the hierarchy and rhythm carry it instead: a small
 * accent-coloured index number, a bold title, a muted subtitle, and thin
 * vertical dividers between items on desktop where they sit in one row.
 * 2x2 grid on mobile so nothing wraps awkwardly or scrolls.
 */
export default function TrustStrip({ items }: TrustStripProps) {
  return (
    <section className="border-y border-line bg-surface px-4 py-10 sm:px-8 md:py-14">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4 md:gap-x-0 md:divide-x md:divide-line">
        {items.map((item, i) => (
          <div
            key={item.title}
            className="stagger-delay animate-fade-up md:px-6 md:first:pl-0 md:last:pr-0"
            style={{ '--stagger-index': i } as React.CSSProperties}
          >
            <span className="font-display text-xs font-bold text-accent">0{i + 1}</span>
            <h3 className="mt-1.5 text-sm font-semibold leading-snug text-ink md:text-base">{item.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft md:text-[0.8125rem]">{item.subtitle}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
