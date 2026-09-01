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
// All are decorative to assistive tech (aria-hidden) — adjacent text, or
// the filled-star count, carries the actual meaning.

interface IconProps {
  className?: string
}

export function StarIcon({ className = 'h-4 w-4', filled = true }: IconProps & { filled?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z" />
    </svg>
  )
}

export function ArrowRightIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h16" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  )
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
