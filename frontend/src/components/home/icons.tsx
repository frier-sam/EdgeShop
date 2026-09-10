// Shared inline SVG icons for the homepage sections.
//
// "How it works" step icons live here rather than as images. They were
// briefly real process photographs (POD-UI2.md §7.2), but those files were
// generated into LOCAL R2 only — production R2 starts empty, so they 404
// on a fresh deploy. Inline SVG is bundled with the JS, so it renders on
// any environment with no upload step and no network request. Imagery
// elsewhere on the homepage (category tiles, hero composition) is safe
// because it comes from merchant-uploaded product photos via the API.
//
// Same visual language as Header.tsx's CartIcon/AccountIcon
// (strokeWidth 1.75, round caps/joins), sized by the parent via className.
// All are decorative to assistive tech (aria-hidden) — adjacent text
// carries the actual meaning.
//
// POD-UI4.md §2.6 — the star and arrow icons that used to live here
// (`StarIcon`, `ArrowRightIcon`) are gone: both have a direct Material
// Symbols equivalent (`star`, `arrow_forward`) already in `ICON_NAMES`, so
// SocialProof.tsx and ClosingCta.tsx now render `<Icon>` directly instead
// of a hand-rolled SVG. Only the three step icons below stay hand-drawn —
// there is no subsetted glyph for "garment on a hanger" / "pen signing a
// design" / "sealed parcel", and the R2-404 risk above is specific to
// *images*, which a webfont glyph never is.

interface IconProps {
  className?: string
}

// ── "How it works" step icons ────────────────────────────────────
// Bundled inline so they never depend on R2 contents. See header note.

/** Step 1 — pick a product: a garment on a hanger. */
export function ShirtIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 3.5 4 6.2l1.4 3.6 2-.7V20h9.2V9.1l2 .7L20 6.2 15 3.5" />
      <path d="M9 3.5a3 3 0 0 0 6 0" />
    </svg>
  )
}

/** Step 2 — add your design: a pen drawing on a surface. */
export function DesignIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M11 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V13" />
      <path d="M18.4 3.6a1.9 1.9 0 0 1 2.7 2.7L13.5 14 10 15l1-3.5Z" />
    </svg>
  )
}

/** Step 3 — we print & ship: a sealed parcel. */
export function ParcelIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z" />
      <path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9" />
      <path d="M7.75 5.5l8.5 4" />
    </svg>
  )
}
