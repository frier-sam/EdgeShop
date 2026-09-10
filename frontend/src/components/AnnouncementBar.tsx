import { useState } from 'react'
import Icon from './ui/Icon'

const STORAGE_KEY = 'espod:announcement-dismissed'

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Private-browsing / storage-disabled — just show the bar every visit.
    return false
  }
}

/**
 * Slim, dismissible strip rendered above the header (POD-UI2.md §3/E2).
 * Rendered by Header.tsx itself rather than by each page, since Header is
 * mounted identically (and unmodifiable — pages/** is out of this
 * workstream's lane) on every storefront page.
 *
 * Dismissal is persisted to localStorage and read synchronously on mount
 * (lazy `useState` initializer) so there's no flash-then-collapse — once
 * dismissed, the bar simply never renders again and never reserves layout
 * space, so it can't cause a layout shift on return visits. The one-time
 * collapse on the dismiss click itself is an instant unmount (no
 * height-transition to fake) which avoids a step where the bar is present
 * but empty.
 */
export default function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(readDismissed)

  if (dismissed) return null

  function dismiss() {
    setDismissed(true)
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Ignore — worst case it reappears next visit.
    }
  }

  return (
    <div className="relative flex h-9 items-center justify-center bg-accent px-9 text-center">
      <p className="truncate font-label text-label-sm text-on-accent">Free shipping on orders over ₹999</p>
      {/* Absolutely positioned so its 44px touch target (POD-UI.md §2.1
          floor) can extend beyond the 36px bar without growing its height —
          only the visible 20px glyph box sits inside the bar's own bounds. */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 shrink-0 items-center justify-center text-on-accent/80 transition-colors duration-fast hover:text-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-on-accent focus-visible:-outline-offset-2"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  )
}
