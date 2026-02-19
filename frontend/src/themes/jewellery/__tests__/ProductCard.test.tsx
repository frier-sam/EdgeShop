import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProductCard from '../ProductCard'

describe('Jewellery ProductCard', () => {
  it('renders product name and price', () => {
    render(
      <ProductCard
        id={1}
        name="Gold Ring"
        price={2999}
        image_url=""
        currency="₹"
        onAddToCart={vi.fn()}
      />
    )
    expect(screen.getByText('Gold Ring')).toBeInTheDocument()
    expect(screen.getByText(/2999/)).toBeInTheDocument()
  })

  it('calls onAddToCart when button is clicked', async () => {
    const onAddToCart = vi.fn()
    render(
      <ProductCard
        id={1}
        name="Silver Bracelet"
        price={1499}
        image_url=""
        currency="₹"
        onAddToCart={onAddToCart}
      />
    )
    screen.getByRole('button', { name: /add to bag/i }).click()
    expect(onAddToCart).toHaveBeenCalledOnce()
  })
})
