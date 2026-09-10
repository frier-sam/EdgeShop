// POD-V2.md §5 / §9 decision 7 / §9.1. Three things pinned down here:
//  - validatePriceBreakRows, the pure mirror of the worker's PUT
//    /:id/price_breaks validation (min_qty >= 1 integer, unique tiers).
//  - sumPrintFees / isTierBelowPrintFees, the pure logic behind the §9.1
//    non-blocking warning ("a tier's price is below the sum of this
//    product's per-side print fees") — tested directly, with no
//    rendering needed, since it's the security-adjacent-but-not-actually-
//    security-critical bit worth pinning precisely.
//  - the editor renders that warning for the right tier only, and always
//    displays tiers sorted by min_qty regardless of entry order.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductPriceBreaksEditor, {
  validatePriceBreakRows,
  sumPrintFees,
  isTierBelowPrintFees,
  computeLineTotal,
  computeSavingsPercent,
} from '../ProductPriceBreaksEditor'
import type { PriceBreakDraftRow } from '../types'
import type { ProductPriceBreak, ProductSide } from '../../lib/types'

vi.mock('../lib/adminFetch', () => ({ adminFetch: vi.fn() }))
import { adminFetch } from '../lib/adminFetch'

const mockedAdminFetch = vi.mocked(adminFetch)

afterEach(() => {
  vi.restoreAllMocks()
})

function row(partial: Partial<PriceBreakDraftRow>): PriceBreakDraftRow {
  return { key: 'k', min_qty: 100, unit_price: 10, ...partial }
}

function side(partial: Partial<ProductSide>): ProductSide {
  return {
    id: 1, product_id: 1, side: 'front', label: '', image_url: '', image_w: 0, image_h: 0,
    customizable: 1, print_x: 0, print_y: 0, print_w: 0, print_h: 0, print_width_in: 0,
    print_fee: 0, sort_order: 0, ...partial,
  }
}

describe('validatePriceBreakRows', () => {
  it('accepts ascending, unique tiers', () => {
    expect(validatePriceBreakRows([row({ key: 'a', min_qty: 100, unit_price: 8 }), row({ key: 'b', min_qty: 250, unit_price: 6 })])).toBeNull()
  })

  it('rejects a min_qty below 1', () => {
    expect(validatePriceBreakRows([row({ min_qty: 0 })])).toMatch(/whole number of 1 or more/i)
  })

  it('rejects a non-integer min_qty', () => {
    expect(validatePriceBreakRows([row({ min_qty: 2.5 })])).toMatch(/whole number/i)
  })

  it('rejects duplicate tiers', () => {
    const err = validatePriceBreakRows([row({ key: 'a', min_qty: 100 }), row({ key: 'b', min_qty: 100 })])
    expect(err).toMatch(/duplicate tier/i)
  })

  it('rejects a negative unit price', () => {
    expect(validatePriceBreakRows([row({ unit_price: -1 })])).toMatch(/zero or more/i)
  })
})

describe('sumPrintFees', () => {
  it('sums only customizable sides', () => {
    expect(sumPrintFees([side({ customizable: 1, print_fee: 99 }), side({ customizable: 1, print_fee: 99, side: 'back' })])).toBe(198)
  })

  it('ignores a mockup-only (non-customizable) side', () => {
    expect(sumPrintFees([side({ customizable: 1, print_fee: 99 }), side({ customizable: 0, print_fee: 50, side: 'back' })])).toBe(99)
  })

  it('is 0 for a product with no sides', () => {
    expect(sumPrintFees([])).toBe(0)
  })
})

describe('isTierBelowPrintFees', () => {
  it('flags a tier priced under the combined print fee', () => {
    expect(isTierBelowPrintFees(180, 198)).toBe(true)
  })

  it('does not flag a tier priced at or above the combined print fee', () => {
    expect(isTierBelowPrintFees(198, 198)).toBe(false)
    expect(isTierBelowPrintFees(250, 198)).toBe(false)
  })

  it('never fires when the product has no print fees to compare against', () => {
    expect(isTierBelowPrintFees(0, 0)).toBe(false)
  })
})

describe('computeLineTotal', () => {
  it('multiplies quantity by unit price', () => {
    expect(computeLineTotal(2, 320)).toBe(640)
  })

  it('is null (never NaN) for a non-finite or negative quantity', () => {
    expect(computeLineTotal(NaN, 10)).toBeNull()
    expect(computeLineTotal(-1, 10)).toBeNull()
  })

  it('is null (never NaN) for a non-finite or negative unit price', () => {
    expect(computeLineTotal(10, NaN)).toBeNull()
    expect(computeLineTotal(10, -5)).toBeNull()
  })

  it('is 0, not null, for a legitimately zero unit price', () => {
    expect(computeLineTotal(10, 0)).toBe(0)
  })
})

describe('computeSavingsPercent', () => {
  it('computes the % cheaper than the first tier, matching the comp\'s "3% savings" example', () => {
    // 330 -> 320 is a 3.03% saving, which the UI rounds to 3%.
    expect(computeSavingsPercent(320, 330)).toBeCloseTo(3.0303, 3)
  })

  it('is null for the first tier itself (nothing to save against its own price)', () => {
    expect(computeSavingsPercent(330, 330)).toBeNull()
  })

  it('is null (never NaN/Infinity) when the first tier price is zero', () => {
    expect(computeSavingsPercent(10, 0)).toBeNull()
  })

  it('is null (never NaN/Infinity) when the first tier price is missing (NaN)', () => {
    expect(computeSavingsPercent(10, NaN)).toBeNull()
  })

  it('is null when this tier is priced at or above the first tier (no negative-looking badge)', () => {
    expect(computeSavingsPercent(400, 330)).toBeNull()
  })

  it('is null when this tier\'s own price is non-finite', () => {
    expect(computeSavingsPercent(NaN, 330)).toBeNull()
  })
})

describe('ProductPriceBreaksEditor', () => {
  const twoSides = [side({ side: 'front', customizable: 1, print_fee: 99 }), side({ id: 2, side: 'back', customizable: 1, print_fee: 99 })]

  it('displays tiers sorted by min_qty regardless of the order they were saved in', () => {
    const breaks: ProductPriceBreak[] = [
      { id: 1, min_qty: 500, unit_price: 5 },
      { id: 2, min_qty: 100, unit_price: 8 },
      { id: 3, min_qty: 250, unit_price: 6 },
    ]
    render(<ProductPriceBreaksEditor productId={1} initialPriceBreaks={breaks} sides={[]} onSaved={vi.fn()} />)
    const qtyInputs = screen.getAllByLabelText('Minimum quantity') as HTMLInputElement[]
    expect(qtyInputs.map((el) => el.value)).toEqual(['100', '250', '500'])
  })

  it('shows the §9.1 warning only on the tier priced below the combined print fee', () => {
    const breaks: ProductPriceBreak[] = [
      { id: 1, min_qty: 100, unit_price: 180 }, // below 198
      { id: 2, min_qty: 1000, unit_price: 250 }, // above 198
    ]
    render(<ProductPriceBreaksEditor productId={1} initialPriceBreaks={breaks} sides={twoSides} onSaved={vi.fn()} />)
    const warnings = screen.getAllByText(/combined print fee/i)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].textContent).toMatch(/100\+/)
    expect(warnings[0].textContent).toMatch(/₹180\.00/)
    expect(warnings[0].textContent).toMatch(/₹198\.00/)
  })

  it('shows no warning when every tier clears the combined print fee', () => {
    const breaks: ProductPriceBreak[] = [{ id: 1, min_qty: 100, unit_price: 500 }]
    render(<ProductPriceBreaksEditor productId={1} initialPriceBreaks={breaks} sides={twoSides} onSaved={vi.fn()} />)
    expect(screen.queryByText(/combined print fee/i)).not.toBeInTheDocument()
  })

  it('saves an absolute all-in payload of { min_qty, unit_price } only, sorted by min_qty', async () => {
    const user = userEvent.setup()
    mockedAdminFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ price_breaks: [{ id: 1, min_qty: 100, unit_price: 8 }] }),
    } as Response)
    const onSaved = vi.fn()
    render(
      <ProductPriceBreaksEditor
        productId={9}
        initialPriceBreaks={[{ id: 1, min_qty: 100, unit_price: 8 }]}
        sides={[]}
        onSaved={onSaved}
      />,
    )
    await user.click(screen.getByRole('button', { name: /save bulk pricing/i }))
    expect(mockedAdminFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockedAdminFetch.mock.calls[0]
    expect(url).toBe('/api/admin/products/9/price_breaks')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({ price_breaks: [{ min_qty: 100, unit_price: 8 }] })
  })

  it('shows the computed line total, per-unit price and savings-vs-first-tier for each row', () => {
    const breaks: ProductPriceBreak[] = [
      { id: 1, min_qty: 1, unit_price: 330 },
      { id: 2, min_qty: 2, unit_price: 320 },
    ]
    render(<ProductPriceBreaksEditor productId={1} initialPriceBreaks={breaks} sides={[]} onSaved={vi.fn()} />)
    // Qty 1 (the first tier) has nothing to save against itself.
    expect(screen.getByText('₹330.00')).toBeInTheDocument()
    // Qty 2: 2 x 320 = 640 total, 320/unit, ~3% cheaper than the 330 baseline.
    expect(screen.getByText('₹640.00')).toBeInTheDocument()
    expect(screen.getByText('₹320.00 per unit')).toBeInTheDocument()
    expect(screen.getByText('3% savings')).toBeInTheDocument()
  })

  it('blocks save on a duplicate tier instead of calling the API', async () => {
    const user = userEvent.setup()
    render(
      <ProductPriceBreaksEditor
        productId={9}
        initialPriceBreaks={[
          { id: 1, min_qty: 100, unit_price: 8 },
          { id: 2, min_qty: 100, unit_price: 7 },
        ]}
        sides={[]}
        onSaved={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /save bulk pricing/i }))
    expect(await screen.findByText(/duplicate tier/i)).toBeInTheDocument()
    expect(mockedAdminFetch).not.toHaveBeenCalled()
  })
})
