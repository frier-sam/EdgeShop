// worker/src/lib/designValidation.ts
//
// Pure validation logic behind `POST /api/designs` (routes/designs.ts).
// Pulled out of the route handler — same pattern as lib/pricing.ts's
// `computeLine` — specifically so the security-relevant rules ("which
// sides is a customer allowed to claim art on, against which product")
// can be unit tested without a D1 database or an HTTP request. See
// designValidation.test.ts.

export interface DesignSideRow {
  side: string
  customizable: number
}

/** `sides_used` must be a non-empty array of only 'front'/'back' — this is what a design row is allowed to claim. */
export function validateSidesUsed(
  raw: unknown
): { ok: true; sides: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: 'sides_used must be a non-empty array' }
  }
  const sides = raw.map(String)
  if (sides.some((s) => s !== 'front' && s !== 'back')) {
    return { ok: false, error: 'sides_used may only contain "front" or "back"' }
  }
  return { ok: true, sides }
}

/**
 * Every side a design claims (`sides_used`) must correspond to a side row
 * that actually exists on the product AND is marked customizable. This is
 * the check that stops a customer from posting a design against, say, a
 * plain (non-customizable) product's back, or a side the merchant hasn't
 * configured at all.
 */
export function checkSidesAreCustomizable(
  sidesUsed: string[],
  productSides: DesignSideRow[]
): { ok: true } | { ok: false; error: string } {
  for (const side of sidesUsed) {
    const row = productSides.find((r) => r.side === side)
    if (!row || !row.customizable) {
      return { ok: false, error: `Side "${side}" is not a customizable side of this product` }
    }
  }
  return { ok: true }
}

export interface DesignJsonValidationResult {
  ok: boolean
  error?: string
  parsed?: Record<string, unknown>
}

/**
 * `design_json` must be present, within the byte cap (measured in real
 * UTF-8 bytes, not UTF-16 code units — a multi-byte-heavy design like one
 * full of emoji text objects would otherwise be undercounted), valid
 * JSON, and an object (not an array, string, number, or `null` — note
 * `typeof null === 'object'` is a classic footgun this explicitly guards
 * against).
 */
export function validateDesignJsonPayload(raw: unknown, maxBytes: number): DesignJsonValidationResult {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { ok: false, error: 'design_json is required' }
  }
  const byteLength = new TextEncoder().encode(raw).length
  if (byteLength > maxBytes) {
    return { ok: false, error: `design_json is too large (max ${maxBytes / 1024}KB)` }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'design_json is not valid JSON' }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'design_json must be an object' }
  }
  return { ok: true, parsed: parsed as Record<string, unknown> }
}
