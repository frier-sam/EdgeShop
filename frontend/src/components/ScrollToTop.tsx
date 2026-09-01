import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Bug 1 — navigating to a new page (e.g. tapping a product card) opened it
 * at the PREVIOUS page's scroll offset, which on a shorter page landed the
 * viewport at the footer and left it there — nothing anywhere reset scroll
 * on route change. Mounted once inside `<BrowserRouter>` (App.tsx).
 *
 * `useLayoutEffect` runs synchronously before the browser paints the new
 * route, so there's no visible jump/flash of the wrong scroll position —
 * PROVIDED the reset itself is instant. `index.css` sets a global `html {
 * scroll-behavior: smooth }` (for in-page anchors); per the CSSOM View
 * spec, `behavior: 'auto'` means "use whatever `scroll-behavior` the
 * element's CSS specifies" — i.e. it does NOT force instant, it inherits
 * smooth. Confirmed live against `wrangler dev` in headless Chromium: a
 * `behavior: 'auto'` call visibly glided a long `/shop` page back to the
 * top over ~300ms instead of jumping — exactly the bug this component
 * exists to prevent. `behavior: 'instant'` is the value that actually
 * overrides the page's CSS and forces an immediate jump.
 *
 * Deliberately narrow:
 *  - Fires only on a PATHNAME change, never on query-string or hash-only
 *    changes: `/shop?category=X` must not scroll-jump while filtering
 *    (`useLocation().pathname` is stable across a `?category=` change),
 *    and an in-page anchor like `#how-it-works` on the SAME pathname must
 *    keep working (the browser/React Router already handles scrolling to
 *    a hash target; resetting to 0 here would fight that).
 *  - Skips `/customize/*` entirely — that route is a non-scrolling
 *    `100dvh` editor with its own internal layout, never part of the
 *    normal document scroll.
 *  - Skips POP navigations (browser back/forward). This is "cheap" in the
 *    sense that it's simply NOT overriding anything: `history.
 *    scrollRestoration` defaults to `'auto'` and nothing in this app sets
 *    it to `'manual'`, so the browser already restores each history
 *    entry's own scroll position natively on back/forward. Forcing 0
 *    here would fight that native restoration; a fully custom
 *    scroll-position cache (keyed per history entry, restored after the
 *    target page's content has actually painted) would be the "proper"
 *    alternative but is materially more code/risk for behaviour the
 *    platform already gives for free — not attempted.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const prevPathnameRef = useRef(pathname)

  useLayoutEffect(() => {
    const changed = prevPathnameRef.current !== pathname
    prevPathnameRef.current = pathname
    if (!changed) return
    if (pathname.startsWith('/customize')) return
    if (navigationType === 'POP') return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, navigationType])

  return null
}
