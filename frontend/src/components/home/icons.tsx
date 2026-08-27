// Shared inline SVG icons for the homepage sections. Per POD-UI2.md §7.2,
// the decorative/illustrative icons formerly here (trust-strip badges,
// "how it works" step icons) were replaced with real imagery or removed
// outright — TrustStrip.tsx is now icon-free typography and HowItWorks.tsx
// uses real process photographs. What remains are functional glyphs that
// are themselves interface elements, not illustration: a star rating
// (SocialProof.tsx) and a directional affordance on a link/button
// (ClosingCta.tsx) — "a magnifier means search in a way no photograph
// does" (§7.2). Same visual language as Header.tsx's CartIcon/AccountIcon
// (strokeWidth 1.75, round caps/joins), sized by the parent via className.
// Both are decorative to assistive tech (aria-hidden) — the adjacent text
// or the filled-star count carries the actual meaning.

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
