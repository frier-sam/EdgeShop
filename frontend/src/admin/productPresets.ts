// POD-V2.md §1.2 / §11 Phase 1.6 — "don't build 100 admins" answer.
//
// A preset is a CLIENT-SIDE CONSTANT, full stop. It ticks some capability
// checkboxes, sets the two axis names, and prefills some rows in the
// already-existing block editors. It writes nothing a hand-filled form
// couldn't, creates no route, and — critically — has NO server
// representation: there is no `product_type` column for a preset to
// write into (that's the entire point of POD-V2.md §1). Applying "T-shirt"
// and then hand-editing every field afterwards is completely
// indistinguishable, on the wire, from never having touched a preset.
//
// Offered on the NEW product screen only (CreateProductForm in
// AdminProductEdit.tsx) — an existing product already has its own real
// data, and a preset has nothing useful to prefill over it.
//
// What each preset prefills is deliberately literal to POD-V2.md, not
// invented: the T-shirt and Visiting card rows come straight from the
// task brief's own examples; Bottle and Mug come from the §1.1 axis table
// (the only place those product types' example values are written down).
// Poster has no documented example values anywhere in POD-V2.md, so it
// only sets axis names and leaves rows for the merchant to fill in —
// inventing plausible poster sizes would be exactly the kind of
// unrequested content this system is trying to avoid baking in.
export interface PresetAxis1Row {
  label: string
}

export interface PresetAxis2Row {
  label: string
  /** null = no swatch for this option (POD-V2.md §3.1) — a preset must be
   *  able to express that just as validly as a hex value. */
  swatch_hex: string | null
}

export interface PresetPriceBreakRow {
  min_qty: number
  unit_price: number
}

export interface ProductPreset {
  id: string
  name: string
  /** One-line description shown under the preset's name in the picker. */
  blurb: string
  axis1_label: string
  axis2_label: string
  /** Whether this preset's product is expected to carry customer artwork.
   *  Every listed preset is a POD product, so all default to true — but
   *  it stays a checkbox the merchant can untick same as if they'd never
   *  used a preset at all. */
  is_customizable: boolean
  enableAxis1: boolean
  axis1Rows: PresetAxis1Row[]
  enableAxis2: boolean
  axis2Rows: PresetAxis2Row[]
  enableBulk: boolean
  priceBreakRows: PresetPriceBreakRow[]
}

export const PRODUCT_PRESETS: ProductPreset[] = [
  {
    id: 'tshirt',
    name: 'T-shirt',
    blurb: 'Size + Colour, no bulk tiers.',
    axis1_label: 'Size',
    axis2_label: 'Colour',
    is_customizable: true,
    enableAxis1: true,
    axis1Rows: [{ label: 'S' }, { label: 'M' }, { label: 'L' }, { label: 'XL' }],
    // POD-V2.md §11 Phase 1.6 only specifies axis names + the Size rows
    // for this preset ("T-shirt → axes 'Size'/'Colour' + S M L XL") — it
    // does not ask for axis-2 rows to be ticked/prefilled, so this stays
    // off by default. The axis2_label is still set, ready the moment the
    // merchant ticks the Colour block on.
    enableAxis2: false,
    axis2Rows: [],
    enableBulk: false,
    priceBreakRows: [],
  },
  {
    id: 'visiting-card',
    name: 'Visiting card',
    blurb: 'Finish + bulk price tiers, no per-size pricing.',
    axis1_label: 'Paper size',
    axis2_label: 'Finish',
    is_customizable: true,
    // Task brief: "Visiting card → 'Paper size'/'Finish' + Matte, Glossy +
    // price-break rows" — axis 1 gets a name but no prefilled rows or
    // tick (card stock sizes vary too much by merchant to guess), axis 2
    // and bulk pricing get both a name and real starter rows.
    enableAxis1: false,
    axis1Rows: [],
    enableAxis2: true,
    axis2Rows: [
      { label: 'Matte', swatch_hex: null },
      { label: 'Glossy', swatch_hex: null },
    ],
    enableBulk: true,
    // Round, Vistaprint-shaped starter tiers (§5) — the merchant's real
    // print costs decide the actual numbers; these exist so "Save" isn't
    // the first time the bulk editor has ever been looked at.
    priceBreakRows: [
      { min_qty: 100, unit_price: 8 },
      { min_qty: 250, unit_price: 6 },
      { min_qty: 500, unit_price: 5 },
      { min_qty: 1000, unit_price: 4 },
    ],
  },
  {
    id: 'bottle',
    name: 'Bottle',
    blurb: 'Volume + cap colour.',
    // POD-V2.md §1.1 prose: "a bottle by Volume and Cap colour" — the
    // table's axis-2 examples for Bottle (Steel · Black · Copper) are cap
    // *material* finishes as much as colours, so swatch_hex is left null
    // here too; a merchant selling literal colour caps can turn swatches
    // on per-row themselves.
    axis1_label: 'Volume',
    axis2_label: 'Cap colour',
    is_customizable: true,
    enableAxis1: true,
    axis1Rows: [{ label: '250ml' }, { label: '500ml' }, { label: '1L' }],
    enableAxis2: true,
    axis2Rows: [
      { label: 'Steel', swatch_hex: null },
      { label: 'Black', swatch_hex: null },
      { label: 'Copper', swatch_hex: null },
    ],
    enableBulk: false,
    priceBreakRows: [],
  },
  {
    id: 'mug',
    name: 'Mug',
    blurb: 'Size + colour.',
    axis1_label: 'Size',
    axis2_label: 'Colour',
    is_customizable: true,
    enableAxis1: true,
    axis1Rows: [{ label: '11oz' }, { label: '15oz' }],
    enableAxis2: true,
    axis2Rows: [
      { label: 'Ceramic White', swatch_hex: '#F7F7F5' },
      { label: 'Black', swatch_hex: '#101014' },
    ],
    enableBulk: false,
    priceBreakRows: [],
  },
  {
    id: 'poster',
    name: 'Poster',
    blurb: 'Names the axes; no example rows are prescribed anywhere in the spec.',
    axis1_label: 'Size',
    axis2_label: 'Stock',
    is_customizable: true,
    enableAxis1: false,
    axis1Rows: [],
    enableAxis2: false,
    axis2Rows: [],
    enableBulk: false,
    priceBreakRows: [],
  },
]
