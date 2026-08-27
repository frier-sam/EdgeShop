// Tiny, purpose-built class-merge helper — NOT a general Tailwind conflict
// resolver like `tailwind-merge`. It resolves exactly one class group:
// display utilities (`hidden`, `flex`, `inline-flex`, `block`, `grid`, …).
//
// Why this exists: Tailwind's generated stylesheet orders utilities
// alphabetically, not by where they appear in a `class="..."` attribute.
// `.hidden { display: none }` is written before `.inline-flex
// { display: inline-flex }` in the stylesheet, so when a component
// hard-codes an unprefixed `inline-flex` in its own base classes,
// `.inline-flex` always wins the cascade over a caller's `hidden` — even
// though `hidden` appears later in the class string — because CSS cascade
// order depends on stylesheet source order, not attribute order. That
// silently defeated `<Button className="hidden md:inline-flex">` (see
// components/Button.tsx).
//
// The fix: when the caller supplies a display utility at a given
// responsive/state variant (e.g. unprefixed `hidden`, or `md:flex`), drop
// the component's own display utility at that *same* variant scope instead
// of letting both fight it out alphabetically. Variants that don't
// collide — e.g. the component's unprefixed `inline-flex` plus a caller's
// `md:hidden` — are left alone; that's ordinary, working Tailwind
// responsive composition, not a conflict.
const DISPLAY_UTILITIES = new Set([
  'block',
  'inline-block',
  'inline',
  'flex',
  'inline-flex',
  'table',
  'inline-table',
  'table-caption',
  'table-cell',
  'table-column',
  'table-column-group',
  'table-footer-group',
  'table-header-group',
  'table-row-group',
  'table-row',
  'flow-root',
  'grid',
  'inline-grid',
  'contents',
  'list-item',
  'hidden',
])

/** Splits `md:hover:inline-flex` into variant scope `md:hover:` and utility `inline-flex`. */
function splitVariant(token: string): { variant: string; utility: string } {
  const i = token.lastIndexOf(':')
  return i === -1 ? { variant: '', utility: token } : { variant: token.slice(0, i + 1), utility: token.slice(i + 1) }
}

/**
 * Joins class-name fragments in order, later fragments taking precedence
 * over earlier ones whenever two land on the same display-utility variant
 * scope. Falsy fragments (`undefined`, `false`, `''`) are ignored, so it's
 * safe to pass conditional classes directly.
 */
export function cn(...classLists: Array<string | undefined | false | null>): string {
  const tokens = classLists.flatMap((c) => (c ? c.split(/\s+/).filter(Boolean) : []))
  const result: string[] = []
  const displaySlot = new Map<string, number>() // variant scope -> index already in `result`

  for (const token of tokens) {
    const { variant, utility } = splitVariant(token)
    if (DISPLAY_UTILITIES.has(utility)) {
      const existingIndex = displaySlot.get(variant)
      if (existingIndex !== undefined) {
        result[existingIndex] = token // later display utility at this scope wins; drop the earlier one
        continue
      }
      displaySlot.set(variant, result.length)
    }
    result.push(token)
  }

  return result.join(' ')
}
