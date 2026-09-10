// POD-UI4.md §4.3 — the shared horizontal snap-scroll rail. Covers the
// "render nothing when empty" contract every caller relies on, the
// heading/view-all chrome, and the arrow visibility rule: hidden/absent
// whenever the track isn't actually scrollable or is already at an end,
// derived from scrollWidth/clientWidth/scrollLeft via the same `scroll`
// listener the component itself uses (jsdom lays out nothing, so these are
// stubbed directly on the track node and driven with a `scroll` event
// rather than real layout).
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProductRail from '../ProductRail'

function renderRail(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

function setScrollMetrics(el: HTMLElement, { scrollWidth, clientWidth, scrollLeft = 0 }: { scrollWidth: number; clientWidth: number; scrollLeft?: number }) {
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true })
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true })
  Object.defineProperty(el, 'scrollLeft', { value: scrollLeft, configurable: true, writable: true })
}

describe('ProductRail', () => {
  it('renders nothing at all when children is empty', () => {
    const { container } = renderRail(<ProductRail title="Empty rail">{null}</ProductRail>)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for an empty array of children', () => {
    const { container } = renderRail(<ProductRail title="Empty rail">{[]}</ProductRail>)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the heading, subtitle and children when there is at least one', () => {
    renderRail(
      <ProductRail title="New arrivals" subtitle="Fresh off the press">
        <div>Item one</div>
      </ProductRail>,
    )
    expect(screen.getByRole('heading', { name: 'New arrivals' })).toBeInTheDocument()
    expect(screen.getByText('Fresh off the press')).toBeInTheDocument()
    expect(screen.getByText('Item one')).toBeInTheDocument()
  })

  it('renders a "View all" link only when viewAllHref is given', () => {
    const { rerender } = renderRail(
      <ProductRail title="Featured">
        <div>Item</div>
      </ProductRail>,
    )
    expect(screen.queryByRole('link', { name: 'View all' })).not.toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <ProductRail title="Featured" viewAllHref="/shop">
          <div>Item</div>
        </ProductRail>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/shop')
  })

  it('hides both arrows when the track does not overflow its viewport', () => {
    renderRail(
      <ProductRail title="Rail">
        <div>Item</div>
      </ProductRail>,
    )
    const track = screen.getByTestId('product-rail-track')
    setScrollMetrics(track, { scrollWidth: 300, clientWidth: 300 })
    fireEvent.scroll(track)

    expect(screen.queryByRole('button', { name: 'Scroll left' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Scroll right' })).not.toBeInTheDocument()
  })

  it('shows only the right arrow at the start of an overflowing track', () => {
    renderRail(
      <ProductRail title="Rail">
        <div>Item</div>
      </ProductRail>,
    )
    const track = screen.getByTestId('product-rail-track')
    setScrollMetrics(track, { scrollWidth: 1000, clientWidth: 300, scrollLeft: 0 })
    fireEvent.scroll(track)

    expect(screen.queryByRole('button', { name: 'Scroll left' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scroll right' })).toBeInTheDocument()
  })

  it('shows only the left arrow once scrolled to the end', () => {
    renderRail(
      <ProductRail title="Rail">
        <div>Item</div>
      </ProductRail>,
    )
    const track = screen.getByTestId('product-rail-track')
    setScrollMetrics(track, { scrollWidth: 1000, clientWidth: 300, scrollLeft: 700 })
    fireEvent.scroll(track)

    expect(screen.getByRole('button', { name: 'Scroll left' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Scroll right' })).not.toBeInTheDocument()
  })

  it('shows both arrows in the middle of an overflowing track, and the right arrow scrolls the track forward', () => {
    renderRail(
      <ProductRail title="Rail">
        <div>Item</div>
      </ProductRail>,
    )
    const track = screen.getByTestId('product-rail-track') as HTMLElement & { scrollBy: (opts: unknown) => void }
    setScrollMetrics(track, { scrollWidth: 1000, clientWidth: 300, scrollLeft: 400 })
    fireEvent.scroll(track)

    expect(screen.getByRole('button', { name: 'Scroll left' })).toBeInTheDocument()
    const rightArrow = screen.getByRole('button', { name: 'Scroll right' })

    const scrollBy = vi.fn()
    track.scrollBy = scrollBy
    fireEvent.click(rightArrow)

    expect(scrollBy).toHaveBeenCalledTimes(1)
    const arg = scrollBy.mock.calls[0][0] as { left: number; behavior: string }
    expect(arg.left).toBeGreaterThan(0)
    expect(arg.behavior).toBe('smooth')
  })
})
