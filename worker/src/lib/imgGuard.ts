// worker/src/lib/imgGuard.ts
//
// POD.md §5.8 — the guard for `GET /img/*` in index.ts. This is the ONLY
// thing standing between a request path and a raw R2 `.get(key)` call, so
// it is pulled out as a pure, dependency-free predicate specifically so
// it can be unit tested (imgGuard.test.ts) without spinning up the whole
// worker or a real R2 bucket.
//
// Two independent checks, both must pass:
//   1. An explicit reject on any '..' segment — defense in depth, even
//      though R2 keys are flat strings with no real filesystem traversal
//      risk (there is no directory to escape).
//   2. An allow-list of key PREFIXES. This is the check that actually
//      matters: even if (1) were bypassed (e.g. a percent-encoded
//      '%2e%2e' that never becomes a literal '..' before this function
//      sees it), a key that doesn't start with one of the three prefixes
//      this app ever writes to is rejected outright — there is no path
//      by which /img/* can be used to fetch an R2 object outside
//      mockups/, uploads/, or designs/.
export const IMG_ALLOWED_PREFIXES = ['mockups/', 'uploads/', 'designs/'] as const

export function isAllowedImgKey(key: string | null | undefined): boolean {
  if (!key) return false
  if (key.includes('..')) return false
  return IMG_ALLOWED_PREFIXES.some((p) => key.startsWith(p))
}
