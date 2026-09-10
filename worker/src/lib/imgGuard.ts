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
//      sees it), a key that doesn't start with one of the prefixes this
//      app ever writes to is rejected outright — there is no path by
//      which /img/* can be used to fetch an R2 object outside mockups/,
//      uploads/, designs/, or templates/.
//
// 'templates/' added for POD-V2.md §11 Phase 4.4/4's admin template
// preview upload (PUT /api/admin/templates/:id/preview,
// routes/admin/templates.ts), which — same as design previews — is served
// back same-origin through this exact /img/* proxy so the customizer's
// "Designs" drawer can draw preview thumbnails into a <canvas> without
// tainting it.
export const IMG_ALLOWED_PREFIXES = ['mockups/', 'uploads/', 'designs/', 'templates/'] as const

export function isAllowedImgKey(key: string | null | undefined): boolean {
  if (!key) return false
  if (key.includes('..')) return false
  return IMG_ALLOWED_PREFIXES.some((p) => key.startsWith(p))
}
