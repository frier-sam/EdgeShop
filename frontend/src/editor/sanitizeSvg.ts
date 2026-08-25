// frontend/src/editor/sanitizeSvg.ts
//
// Client-side SVG sanitizer — POD.md §5.9. Uploaded SVGs end up served
// same-origin from /img/* (POD.md §5.8), so anything left in an SVG that
// can execute script or phone home to a third party is effectively
// same-origin script execution / SSRF against the store. This runs BEFORE
// the file ever reaches POST /api/uploads/art.
//
// Stripped: <script>, on* event-handler attributes, <foreignObject>, and
// any href/xlink:href/src that points off-document (only `data:` URIs and
// same-document `#fragment` references survive) — plus a couple of
// adjacent footguns (external stylesheet refs, a DOCTYPE with internal
// entities) that fall under the same "external reference" umbrella.

export interface SanitizeResult {
  ok: boolean
  svg: string
  removed: string[]
}

const EVENT_ATTR_RE = /^on/i
const HREF_ATTRS = ['href', 'xlink:href', 'src']

function isSafeUrlValue(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return true
  if (trimmed.startsWith('#')) return true // same-document fragment
  if (trimmed.startsWith('data:')) return true
  return false
}

export function sanitizeSvg(rawSvg: string): SanitizeResult {
  const removed: string[] = []

  if (typeof DOMParser === 'undefined') {
    // Non-browser environment (e.g. a unit test running under a minimal
    // jsdom config) — refuse rather than pass through unsanitized markup.
    return { ok: false, svg: '', removed: ['DOMParser unavailable'] }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml')

  if (doc.querySelector('parsererror')) {
    return { ok: false, svg: '', removed: ['parse error'] }
  }

  const root = doc.documentElement
  if (!root || root.nodeName.toLowerCase() !== 'svg') {
    return { ok: false, svg: '', removed: ['no <svg> root element'] }
  }

  // Reject a DOCTYPE outright — SVGs never need one, and it's the classic
  // XXE / entity-expansion vector.
  for (const node of Array.from(doc.childNodes)) {
    if (node.nodeType === Node.DOCUMENT_TYPE_NODE) {
      doc.removeChild(node)
      removed.push('DOCTYPE')
    }
  }

  // <script> and <foreignObject> (the latter can embed arbitrary HTML,
  // including <script>, inside an otherwise-innocuous SVG) — remove entirely.
  for (const tag of ['script', 'foreignObject']) {
    const els = Array.from(root.querySelectorAll(tag))
    if (els.length) removed.push(`${els.length}x <${tag}>`)
    els.forEach((el) => el.remove())
  }

  // Walk every remaining element: strip on* handlers and any external href/src.
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let current: Element | null = root
  while (current) {
    const attrs = Array.from(current.attributes)
    for (const attr of attrs) {
      const name = attr.name
      if (EVENT_ATTR_RE.test(name)) {
        current.removeAttribute(name)
        removed.push(`${name} on <${current.nodeName}>`)
        continue
      }
      if (HREF_ATTRS.includes(name.toLowerCase()) && !isSafeUrlValue(attr.value)) {
        current.removeAttribute(name)
        removed.push(`${name}="${attr.value.slice(0, 40)}" on <${current.nodeName}>`)
      }
      // javascript: URIs hiding in any other attribute (e.g. a stray
      // xml:base, or a non-standard attribute some editor left behind).
      if (/^\s*javascript:/i.test(attr.value)) {
        current.removeAttribute(name)
        removed.push(`javascript: URI in ${name} on <${current.nodeName}>`)
      }
    }
    // <style> blocks: strip any external @import / url(http...) reference,
    // keep the (common, legitimate) inline CSS rules otherwise.
    if (current.nodeName.toLowerCase() === 'style' && current.textContent) {
      const before = current.textContent
      const after = before
        .replace(/@import[^;]+;?/gi, '')
        .replace(/url\(\s*['"]?(https?:)?\/\/[^)]*\)/gi, 'url()')
      if (after !== before) {
        current.textContent = after
        removed.push('external reference in <style>')
      }
    }
    current = walker.nextNode() as Element | null
  }

  const serialized = new XMLSerializer().serializeToString(root)
  return { ok: true, svg: serialized, removed }
}

/** Convenience wrapper for a File -> sanitized SVG text (throws on unreadable/unparseable input). */
export async function sanitizeSvgFile(file: File): Promise<SanitizeResult> {
  const text = await file.text()
  return sanitizeSvg(text)
}
