// Recently-viewed product ids — POD-UI4.md §4.3 / H7.
//
// Pure localStorage, no backend and no account needed: a shopper's history
// lives only in this browser, most-recent-first, capped, deduped. That is
// the honest scope of this feature this round — it is real data (an
// actual product id the shopper actually opened), just not synced across
// devices or sessions.
//
// `pages/ProductPage.tsx` (a different workstream) is the only intended
// caller of `recordView` — it fires on mount there. This module must not
// import anything from HomePage or assume it is the only reader; keep the
// two exports exactly as named so that lane can import them independently.
//
// Every entry point — reads AND writes — is wrapped in try/catch, not just
// the writes: some browsers (Safari private browsing, historically) throw
// on `localStorage` *access*, not only on `setItem`. A shopper must never
// see a broken homepage because their browser doesn't like localStorage;
// every failure here degrades to "no history" instead.
const STORAGE_KEY = 'espod:recently-viewed'
const MAX_ENTRIES = 12

/**
 * Reads the raw stored value and returns a trustworthy `number[]`, or `[]`
 * on any problem. `localStorage` can hold literally anything — a stale
 * shape from an earlier version of this module, something hand-edited in
 * devtools, or garbage — so the parsed value is validated element-by-
 * element rather than trusted as-is; a non-array, or an array containing
 * non-positive-integer entries, must not crash the homepage.
 */
function readIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0)
  } catch {
    return []
  }
}

function writeIds(ids: number[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Storage full, disabled, or a private-browsing quota of 0 — recording
    // view history is a nice-to-have; it is never worth surfacing an error
    // for, or interrupting the page the shopper is actually trying to see.
  }
}

/**
 * Records a product view: moves `id` to the front, dedupes it against any
 * earlier entry, and caps the list at `MAX_ENTRIES` (dropping the oldest).
 * Silently a no-op for a non-positive/non-integer id, or when storage is
 * unavailable.
 */
export function recordView(id: number): void {
  if (!Number.isInteger(id) || id <= 0) return
  const rest = readIds().filter((existing) => existing !== id)
  writeIds([id, ...rest].slice(0, MAX_ENTRIES))
}

/** Reads recorded product ids, most-recent-first. Never throws, never returns anything but a `number[]`. */
export function readRecentlyViewed(): number[] {
  return readIds()
}
