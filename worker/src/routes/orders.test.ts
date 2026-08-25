// worker/src/routes/orders.test.ts
//
// buildPreviewLines is the field-selection boundary for the public,
// unauthenticated GET /api/orders/:id/previews endpoint (Bug 3 fix) — the
// critical property under test is that it can NEVER surface a field from
// the sibling PII columns on the same `orders` row (customer_name,
// customer_email, customer_phone, shipping_address, …), even if a caller
// tried to smuggle one into items_json.
import { describe, it, expect } from 'vitest'
import { buildPreviewLines } from './orders'

describe('buildPreviewLines', () => {
  it('extracts only preview-safe fields from a normal items_json row', () => {
    const itemsJson = JSON.stringify([
      { product_id: 12, name: 'Classic Tee', size: 'M', quantity: 2, design_id: 'dsn_9f3c', previews: { front: '/img/designs/dsn_9f3c/front.webp' }, unit_price: 697 },
    ])
    const lines = buildPreviewLines('ORD-123-ABCDEF12', itemsJson)
    expect(lines).toEqual([
      { key: 'ORD-123-ABCDEF12:0', name: 'Classic Tee', size: 'M', quantity: 2, preview_url: '/img/designs/dsn_9f3c/front.webp', design_id: 'dsn_9f3c' },
    ])
  })

  it('prefers image_url over previews.front when both are present (matches pricing.ts ResolvedLineItem)', () => {
    const itemsJson = JSON.stringify([{ name: 'Tee', image_url: '/img/designs/dsn_a/front.webp', previews: { front: '/img/designs/dsn_a/other.webp' } }])
    expect(buildPreviewLines('ORD-1', itemsJson)[0].preview_url).toBe('/img/designs/dsn_a/front.webp')
  })

  it('falls back to any non-front preview when front is missing', () => {
    const itemsJson = JSON.stringify([{ name: 'Tee', previews: { back: '/img/designs/dsn_b/back.webp' } }])
    expect(buildPreviewLines('ORD-1', itemsJson)[0].preview_url).toBe('/img/designs/dsn_b/back.webp')
  })

  it('a plain (no-design) line has a null preview_url and null design_id, never an empty string', () => {
    const itemsJson = JSON.stringify([{ name: 'Plain Mug', size: null, quantity: 1 }])
    const [line] = buildPreviewLines('ORD-1', itemsJson)
    expect(line.preview_url).toBeNull()
    expect(line.design_id).toBeNull()
  })

  it('never leaks a smuggled PII-shaped field — only the five allow-listed keys ever appear on a line', () => {
    const itemsJson = JSON.stringify([
      {
        name: 'Tee',
        customer_name: 'Jane Doe',
        customer_email: 'jane@example.com',
        shipping_address: '123 Main St',
        customer_phone: '+1 555 0100',
      },
    ])
    const [line] = buildPreviewLines('ORD-1', itemsJson)
    expect(Object.keys(line).sort()).toEqual(['design_id', 'key', 'name', 'preview_url', 'quantity', 'size'])
  })

  it('degrades to an empty array for malformed JSON instead of throwing', () => {
    expect(buildPreviewLines('ORD-1', '{ not valid json')).toEqual([])
  })

  it('degrades to an empty array when items_json is not an array', () => {
    expect(buildPreviewLines('ORD-1', JSON.stringify({ oops: true }))).toEqual([])
  })

  it('defaults a missing/invalid quantity to 1 rather than 0 or NaN', () => {
    const itemsJson = JSON.stringify([{ name: 'Tee', quantity: 'two' }])
    expect(buildPreviewLines('ORD-1', itemsJson)[0].quantity).toBe(1)
  })

  it('keys are stable and unique per line index within one order', () => {
    const itemsJson = JSON.stringify([{ name: 'A' }, { name: 'B' }])
    const lines = buildPreviewLines('ORD-9', itemsJson)
    expect(lines.map((l) => l.key)).toEqual(['ORD-9:0', 'ORD-9:1'])
  })
})
