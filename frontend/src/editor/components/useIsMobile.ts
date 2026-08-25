import { useEffect, useState } from 'react'

/**
 * POD-UI.md §3 Workstream C — the customizer renders genuinely different
 * chrome per platform (a drag-dismissible bottom `Sheet` on mobile vs. an
 * always-visible right rail on desktop), not just responsive CSS, because
 * `Sheet` has side effects (body scroll lock, focus trap, Escape handler)
 * that must not fire while it is only CSS-hidden. A `matchMedia` listener
 * is the only reliable way to gate that in JS rather than relying on a
 * `hidden md:block` wrapper around a component with side effects.
 *
 * Matches Tailwind's default `md` breakpoint (768px) so "mobile" here means
 * exactly "below `md`", the same cut the rest of the app's CSS uses.
 */
export function useIsMobile(breakpointPx = 768): boolean {
  const query = `(max-width: ${breakpointPx - 1}px)`
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return isMobile
}
