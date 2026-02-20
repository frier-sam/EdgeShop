import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProductCard from '../ProductCard'

describe('Arts & Crafts ProductCard', () => {
  it('renders product name and price', () => {
    render(
      <MemoryRouter>
        <ProductCard
          id={1}
          name="Handwoven Basket"
          price={1299}
          image_url=""
          currency="₹"
          onAddToCart={vi.fn()}
        />
      </MemoryRouter>
    )
    expect(screen.getByText('Handwoven Basket')).toBeInTheDocument()
    expect(screen.getByText(/1299/)).toBeInTheDocument()
  })

  it('calls onAddToCart when button is clicked', async () => {
    const onAddToCart = vi.fn()
    render(
      <MemoryRouter>
        <ProductCard
          id={1}
          name="Clay Pot"
          price={799}
          image_url=""
          currency="₹"
          onAddToCart={onAddToCart}
        />
      </MemoryRouter>
    )
    const btn = screen.getByRole('button')
    btn.click()
    expect(onAddToCart).toHaveBeenCalledOnce()
  })
})
