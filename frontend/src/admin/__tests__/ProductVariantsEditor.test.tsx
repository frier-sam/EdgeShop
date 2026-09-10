// POD-V2.md §3 (axis 2). Two things this file pins down:
//  - validateVariantRows, the pure mirror of the worker's PUT
//    /:id/variants validation (non-empty, unique, opaque labels).
//  - the "no colour" state is a real, distinct, sendable value: toggling
//    a row to "no colour" must save `swatch_hex: null`, never '' or the
//    field simply omitted — §3.1's whole point is that this is a first-
//    class state, not a degraded one.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductVariantsEditor, { validateVariantRows } from '../ProductVariantsEditor'
import type { VariantDraftRow } from '../types'
import type { ProductVariant } from '../../lib/types'

vi.mock('../lib/adminFetch', () => ({ adminFetch: vi.fn() }))
import { adminFetch } from '../lib/adminFetch'

const mockedAdminFetch = vi.mocked(adminFetch)

afterEach(() => {
  vi.restoreAllMocks()
})

function row(partial: Partial<VariantDraftRow>): VariantDraftRow {
  return { key: 'k', label: '', swatch_hex: null, ...partial }
}

describe('validateVariantRows', () => {
  it('accepts a mix of swatch and no-colour rows', () => {
    expect(
      validateVariantRows([row({ key: 'a', label: 'Navy', swatch_hex: '#1B1F3B' }), row({ key: 'b', label: 'Matte', swatch_hex: null })]),
    ).toBeNull()
  })

  it('rejects an empty label', () => {
    expect(validateVariantRows([row({ label: '  ' })])).toMatch(/needs a label/i)
  })

  it('rejects duplicate labels case-insensitively', () => {
    const err = validateVariantRows([row({ key: 'a', label: 'Navy' }), row({ key: 'b', label: 'navy' })])
    expect(err).toMatch(/duplicate/i)
  })

  it('rejects a malformed hex value', () => {
    const err = validateVariantRows([row({ label: 'Odd', swatch_hex: 'blue' })])
    expect(err).toMatch(/hex colour/i)
  })

  it('passes on an empty row set (axis disabled has nothing to validate)', () => {
    expect(validateVariantRows([])).toBeNull()
  })
})

describe('ProductVariantsEditor', () => {
  const variants: ProductVariant[] = [
    { id: 1, label: 'Navy', swatch_hex: '#1B1F3B', sort_order: 0 },
    { id: 2, label: 'Matte', swatch_hex: null, sort_order: 1 },
  ]

  it('renders existing rows with the right swatch state per row', () => {
    render(<ProductVariantsEditor productId={7} initialVariants={variants} axisLabel="Colour" onSaved={vi.fn()} />)
    expect(screen.getByDisplayValue('Navy')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Matte')).toBeInTheDocument()
    // "No colour" text only appears for the Matte row, not Navy.
    expect(screen.getAllByText('No colour')).toHaveLength(1)
  })

  it('sends swatch_hex: null (not empty string, not omitted) for a "no colour" row on save', async () => {
    const user = userEvent.setup()
    mockedAdminFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ variants: [{ id: 2, label: 'Matte', swatch_hex: null, sort_order: 0 }] }),
    } as Response)

    const onSaved = vi.fn()
    render(<ProductVariantsEditor productId={7} initialVariants={[variants[1]]} axisLabel="Colour" onSaved={onSaved} />)

    await user.click(screen.getByRole('button', { name: /save colour/i }))

    expect(mockedAdminFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockedAdminFetch.mock.calls[0]
    expect(url).toBe('/api/admin/products/7/variants')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({ variants: [{ label: 'Matte', swatch_hex: null, sort_order: 0 }] })
  })

  it('toggling "Has colour" on assigns a real hex, and back off resets to null', async () => {
    const user = userEvent.setup()
    render(<ProductVariantsEditor productId={7} initialVariants={[]} axisLabel="Colour" onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /\+ add colour/i }))
    const rowEl = screen.getByLabelText('Colour label').closest('div.grid') as HTMLElement
    const hasColourCheckbox = within(rowEl).getByRole('checkbox', { name: /has colour/i })

    expect(within(rowEl).getByText('No colour')).toBeInTheDocument()

    await user.click(hasColourCheckbox)
    expect(within(rowEl).queryByText('No colour')).not.toBeInTheDocument()
    expect(within(rowEl).getByLabelText('Colour swatch colour')).toBeInTheDocument()

    await user.click(hasColourCheckbox)
    expect(within(rowEl).getByText('No colour')).toBeInTheDocument()
  })

  it('blocks save and shows an inline error on a duplicate label instead of calling the API', async () => {
    const user = userEvent.setup()
    render(
      <ProductVariantsEditor
        productId={7}
        initialVariants={[
          { id: 1, label: 'Navy', swatch_hex: null, sort_order: 0 },
          { id: 2, label: 'navy', swatch_hex: null, sort_order: 1 },
        ]}
        axisLabel="Colour"
        onSaved={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /save colour/i }))
    expect(await screen.findByText(/duplicate option label/i)).toBeInTheDocument()
    expect(mockedAdminFetch).not.toHaveBeenCalled()
  })
})
