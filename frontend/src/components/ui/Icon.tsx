import type { IconName } from './iconNames'

interface IconProps {
  name: IconName
  /** Optical size in px — drives both the rendered glyph box and the `opsz` axis. Defaults to 24, the font's design size. */
  size?: number
  /** Solid rather than outlined (`FILL` axis). Used for emphasis: an active favourite, a filled rating star, a satisfied checklist chip. */
  fill?: boolean
  /** Stroke weight (`wght` axis, 100–700). 400 is the design default. */
  weight?: number
  className?: string
}

/**
 * The one icon primitive — POD-UI4.md §2.6.
 *
 * A Material Symbols glyph is a *ligature*: the element's text content is the
 * icon name, and the font substitutes the artwork. Two consequences this
 * component exists to contain:
 *
 *  1. **It is always `aria-hidden`.** Without that, a screen reader announces
 *     the literal word "shopping_cart", and `getByText`/`getByRole` queries in
 *     tests match icon names as page text. The accessible name always comes
 *     from the wrapping control's `aria-label` / visible label instead — never
 *     from the glyph. There is deliberately no prop to opt out.
 *  2. **The name must be in the loaded subset.** `IconName` is derived from
 *     `ICON_NAMES`, so an unlisted name is a type error at author time, and
 *     `__tests__/iconNames.test.ts` catches the `index.html` half of the
 *     contract drifting out of sync.
 *
 * Colour is inherited (`currentColor` via the font), so callers set it with an
 * ordinary text utility on this element or an ancestor.
 */
export default function Icon({ name, size = 24, fill = false, weight = 400, className = '' }: IconProps) {
  return (
    <span
      aria-hidden="true"
      translate="no"
      className={`material-symbols-outlined shrink-0 select-none ${className}`}
      style={{
        fontSize: `${size}px`,
        // Both axes have to be restated together: `font-variation-settings` is
        // not a shorthand that merges with the base rule's declaration — it
        // replaces it wholesale, so omitting `wght` here would silently reset
        // it to the font's default rather than keeping index.css's 400.
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
        // The glyph box is square at the optical size; pinning it keeps rows
        // of icons on a shared baseline grid even while the webfont is still
        // loading and the ligature text (which is wider) is what's laid out.
        width: `${size}px`,
        height: `${size}px`,
        // The un-substituted ligature text is far wider than the final glyph,
        // so during the font swap it would otherwise blow out flex rows.
        overflow: 'hidden',
      }}
    >
      {name}
    </span>
  )
}
