// POD-UI4.md §4.5 — the price-break pill's three-way honesty rule:
//   1. a real `lowest_break` -> "BUY {min_qty} @ {currency}{unit_price}"
//   2. else a real `min_order_qty > 1` -> "MIN {n} UNITS"
//   3. else -> nothing at all (never a fabricated quantity or a bare
//      base_price dressed up as a bulk price).
// Also covers the computed `% OFF` badge and the back_image_url hover swap.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProductCard from '../ProductCard'

const BASE_PROPS = {
  id: 1,
  name: 'Classic Tee',
  price: 100,
  image_url: '/img/tee.png',
  currency: '₹',
  onAddToCart: vi.fn(),
}

function renderCard(overrides: Partial<React.ComponentProps<typeof ProductCard>> = {}) {
  return render(
    <MemoryRouter>
      <ProductCard {...BASE_PROPS} {...overrides} />
    </MemoryRouter>,
  )
}

describe('ProductCard price-break pill', () => {
  it('shows "BUY {min_qty} @ {currency}{unit_price}" when a real lowest_break is present', () => {
    renderCard({ lowest_break: { min_qty: 100, unit_price: 450 }, min_order_qty: 1 })
    expect(screen.getByText('BUY 100 @ ₹450.00')).toBeInTheDocument()
  })

  it('prefers the lowest_break pill even when min_order_qty is also > 1', () => {
    renderCard({ lowest_break: { min_qty: 50, unit_price: 90 }, min_order_qty: 10 })
    expect(screen.getByText('BUY 50 @ ₹90.00')).toBeInTheDocument()
    expect(screen.queryByText(/MIN \d+ UNITS/)).not.toBeInTheDocument()
  })

  it('falls back to "MIN {n} UNITS" when there is no price break but a real min_order_qty > 1', () => {
    renderCard({ lowest_break: null, min_order_qty: 5 })
    expect(screen.getByText('MIN 5 UNITS')).toBeInTheDocument()
  })

  it('renders no pill at all when there is neither a price break nor a min_order_qty above 1', () => {
    renderCard({ lowest_break: null, min_order_qty: 1 })
    expect(screen.queryByText(/BUY \d+/)).not.toBeInTheDocument()
    expect(screen.queryByText(/MIN \d+ UNITS/)).not.toBeInTheDocument()
  })

  it('renders no pill when both fields are simply absent (older/other-lane callers)', () => {
    renderCard()
    expect(screen.queryByText(/BUY \d+/)).not.toBeInTheDocument()
    expect(screen.queryByText(/MIN \d+ UNITS/)).not.toBeInTheDocument()
  })
})

describe('ProductCard % OFF badge', () => {
  it('shows a whole-percent discount badge computed from compare_price vs price', () => {
    renderCard({ price: 80, compare_price: 100 })
    expect(screen.getByText('20% OFF')).toBeInTheDocument()
  })

  it('hides the badge when the discount rounds to 0%', () => {
    renderCard({ price: 99.6, compare_price: 100 })
    expect(screen.queryByText(/% OFF/)).not.toBeInTheDocument()
  })

  it('hides the badge when there is no compare_price', () => {
    renderCard({ compare_price: null })
    expect(screen.queryByText(/% OFF/)).not.toBeInTheDocument()
  })
})

describe('ProductCard back_image_url hover swap', () => {
  it('renders the back-side image (hidden from assistive tech) when back_image_url is provided', () => {
    const { container } = renderCard({ back_image_url: '/img/tee-back.png' })
    const backImg = container.querySelector('img[aria-hidden="true"]')
    expect(backImg).not.toBeNull()
    expect(backImg).toHaveAttribute('src', '/img/tee-back.png')
  })

  it('renders no back-side image when back_image_url is absent', () => {
    const { container } = renderCard()
    expect(container.querySelector('img[aria-hidden="true"]')).toBeNull()
  })
})
