// POD-V2.md §1.2 / §11 Phase 1.6 — "a preset only ticks checkboxes, sets
// the two axis names, and prefills some rows... writes nothing a
// hand-filled form couldn't." This pins the literal content the task
// brief specifies (T-shirt's S/M/L/XL, Visiting card's Matte/Glossy +
// price-break rows) so a future edit to the preset list can't silently
// drop what the spec actually asked for.
import { describe, it, expect } from 'vitest'
import { PRODUCT_PRESETS } from '../productPresets'

function preset(id: string) {
  const p = PRODUCT_PRESETS.find((p) => p.id === id)
  if (!p) throw new Error(`no preset "${id}"`)
  return p
}

describe('PRODUCT_PRESETS', () => {
  it('offers exactly the five presets named in the spec', () => {
    expect(PRODUCT_PRESETS.map((p) => p.name).sort()).toEqual(['Bottle', 'Mug', 'Poster', 'T-shirt', 'Visiting card'].sort())
  })

  it('every preset sets both axis names to something non-empty', () => {
    for (const p of PRODUCT_PRESETS) {
      expect(p.axis1_label.trim()).not.toBe('')
      expect(p.axis2_label.trim()).not.toBe('')
    }
  })

  it('T-shirt prefills axis 1 with S/M/L/XL and leaves axis 2 unticked', () => {
    const t = preset('tshirt')
    expect(t.axis1_label).toBe('Size')
    expect(t.axis2_label).toBe('Colour')
    expect(t.enableAxis1).toBe(true)
    expect(t.axis1Rows.map((r) => r.label)).toEqual(['S', 'M', 'L', 'XL'])
    expect(t.enableAxis2).toBe(false)
    expect(t.enableBulk).toBe(false)
  })

  it('Visiting card prefills Matte/Glossy on axis 2 and real price-break rows', () => {
    const c = preset('visiting-card')
    expect(c.axis1_label).toBe('Paper size')
    expect(c.axis2_label).toBe('Finish')
    expect(c.enableAxis2).toBe(true)
    expect(c.axis2Rows.map((r) => r.label)).toEqual(['Matte', 'Glossy'])
    expect(c.enableBulk).toBe(true)
    expect(c.priceBreakRows.length).toBeGreaterThan(0)
    // Ascending min_qty, and every row a real all-in absolute price (>0).
    const qtys = c.priceBreakRows.map((r) => r.min_qty)
    expect(qtys).toEqual([...qtys].sort((a, b) => a - b))
    for (const row of c.priceBreakRows) expect(row.unit_price).toBeGreaterThan(0)
  })

  it('no preset silently assigns a swatch to an option the spec never described as a colour', () => {
    // Visiting card's Matte/Glossy and Bottle's Steel/Black/Copper are
    // finishes, not colours (POD-V2.md §1.1/§3.1) — a preset asserting a
    // hex value for them would be inventing data the spec never gave it.
    for (const row of preset('visiting-card').axis2Rows) expect(row.swatch_hex).toBeNull()
    for (const row of preset('bottle').axis2Rows) expect(row.swatch_hex).toBeNull()
  })

  it('every preset is a POD product and defaults to customizable', () => {
    for (const p of PRODUCT_PRESETS) expect(p.is_customizable).toBe(true)
  })
})
