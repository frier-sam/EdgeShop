// POD-UI4.md §5 C.4 / POD-V2.md §3.1, §3.3 decision #9 — the axis-2 picker's
// three degradation states: a validated `swatch_hex` renders a colour chip,
// a null `swatch_hex` renders a plain labelled pill, and a product mixing
// both is handled per-option. Tested directly against the exported
// `VariantPicker` (and its `isValidSwatchHex` guard) rather than mounting
// the whole page — same reasoning as AdminProductEdit.test.tsx's `Section`
// export: no live product fetch or network mocking needed to pin this.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VariantPicker, isValidSwatchHex } from '../ProductPage'
import type { ProductVariant } from '../../lib/types'

function variant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return { id: 1, label: 'Navy', swatch_hex: null, sort_order: 0, ...overrides }
}

describe('isValidSwatchHex', () => {
  it('accepts a well-formed 6-digit hex', () => {
    expect(isValidSwatchHex('#1B2A4A')).toBe(true)
  })

  it('rejects null and undefined', () => {
    expect(isValidSwatchHex(null)).toBe(false)
    expect(isValidSwatchHex(undefined)).toBe(false)
  })

  it('rejects a malformed value rather than trusting the database', () => {
    expect(isValidSwatchHex('blue')).toBe(false)
    expect(isValidSwatchHex('#fff')).toBe(false)
    expect(isValidSwatchHex('1B2A4A')).toBe(false)
    expect(isValidSwatchHex('#1B2A4G')).toBe(false)
  })
})

describe('VariantPicker — three degradation states', () => {
  it('renders nothing when the product has no variants', () => {
    const { container } = render(<VariantPicker variants={[]} axisLabel="Colour" selected={null} onSelect={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('state 1 — a validated swatch_hex renders a colour chip, with the value repeated as text (not colour alone)', () => {
    render(<VariantPicker variants={[variant({ label: 'Navy', swatch_hex: '#1B2A4A' })]} axisLabel="Colour" selected={null} onSelect={vi.fn()} />)
    const chip = screen.getByRole('button', { name: 'Colour: Navy' })
    const swatch = chip.querySelector('span[aria-hidden="true"]')
    expect(swatch).toHaveStyle({ backgroundColor: '#1B2A4A' })
  })

  it('state 2 — a null swatch_hex renders a plain labelled pill, since "Matte"/"Glossy" has no colour', () => {
    render(<VariantPicker variants={[variant({ label: 'Matte', swatch_hex: null })]} axisLabel="Finish" selected={null} onSelect={vi.fn()} />)
    const pill = screen.getByRole('button', { name: 'Matte' })
    expect(pill.querySelector('span[aria-hidden="true"]')).not.toBeInTheDocument()
    expect(pill.style.backgroundColor).toBe('')
  })

  it('a malformed hex from the database degrades to a plain pill rather than reaching a style prop untrusted', () => {
    render(<VariantPicker variants={[variant({ label: 'Odd', swatch_hex: 'not-a-colour' })]} axisLabel="Colour" selected={null} onSelect={vi.fn()} />)
    const pill = screen.getByRole('button', { name: 'Odd' })
    expect(pill.querySelector('span[aria-hidden="true"]')).not.toBeInTheDocument()
  })

  it('state 3 — a product mixing both kinds handles each option independently, not per-product', () => {
    render(
      <VariantPicker
        variants={[variant({ label: 'Navy', swatch_hex: '#1B2A4A' }), variant({ id: 2, label: 'Matte', swatch_hex: null, sort_order: 1 })]}
        axisLabel="Colour"
        selected={null}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Colour: Navy' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Matte' })).toBeInTheDocument()
  })

  it('shows the axis label and the selected value as text next to the group', () => {
    render(<VariantPicker variants={[variant({ label: 'Navy', swatch_hex: '#1B2A4A' })]} axisLabel="Colour" selected="Navy" onSelect={vi.fn()} />)
    expect(screen.getByText('Colour')).toBeInTheDocument()
    expect(screen.getByText(': Navy')).toBeInTheDocument()
  })

  it('marks the selected swatch chip with an accent outline', () => {
    render(<VariantPicker variants={[variant({ label: 'Navy', swatch_hex: '#1B2A4A' })]} axisLabel="Colour" selected="Navy" onSelect={vi.fn()} />)
    const chip = screen.getByRole('button', { name: 'Colour: Navy' })
    expect(chip.querySelector('span[aria-hidden="true"]')?.className).toContain('outline-accent')
  })

  it('calls onSelect with the option label when a chip is clicked', async () => {
    const onSelect = vi.fn()
    render(<VariantPicker variants={[variant({ label: 'Navy', swatch_hex: '#1B2A4A' })]} axisLabel="Colour" selected={null} onSelect={onSelect} />)
    screen.getByRole('button', { name: 'Colour: Navy' }).click()
    expect(onSelect).toHaveBeenCalledWith('Navy')
  })

  it('prompts to choose an option, in the axis label\'s own wording, when none is selected', () => {
    render(<VariantPicker variants={[variant({ label: 'Steel', swatch_hex: null })]} axisLabel="Cap colour" selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText('Choose a cap colour to continue.')).toBeInTheDocument()
  })
})
