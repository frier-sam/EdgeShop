// Bug 1 — scroll resets to the top on a real pathname navigation, but not
// on a same-pathname query-string change, a same-pathname hash change, a
// /customize/* route, or a POP (back/forward) navigation.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import ScrollToTop from '../ScrollToTop'

function Page({ label }: { label: string }) {
  const navigate = useNavigate()
  return (
    <div>
      <p>{label}</p>
      <Link to="/shop">Go to shop</Link>
      <Link to="/shop?category=hats">Filter hats</Link>
      <Link to="/shop#how-it-works">Anchor</Link>
      <Link to="/customize/1">Customize</Link>
      <button onClick={() => navigate(-1)}>Back</button>
    </div>
  )
}

function TestApp({ initialEntries }: { initialEntries: string[] }) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Page label="home" />} />
        <Route path="/shop" element={<Page label="shop" />} />
        <Route path="/customize/:id" element={<Page label="customize" />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ScrollToTop', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  it('scrolls to top on a real pathname navigation (PUSH)', () => {
    render(<TestApp initialEntries={['/']} />)
    fireEvent.click(screen.getByText('Go to shop'))
    // `behavior: 'instant'` is required, NOT 'auto' — 'auto' means "defer
    // to the element's CSS `scroll-behavior`", and index.css sets a
    // global `scroll-behavior: smooth`, so an 'auto' call would silently
    // animate instead of jumping (caught live against wrangler dev, not
    // by this jsdom test — jsdom's scrollTo mock doesn't simulate the
    // CSSOM View spec's behavior inheritance, so this assertion is what
    // pins the fix down at the unit level).
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
  })

  it('does NOT scroll when only the query string changes on the same pathname', () => {
    render(<TestApp initialEntries={['/shop']} />)
    vi.mocked(window.scrollTo).mockClear()
    fireEvent.click(screen.getByText('Filter hats'))
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('does NOT scroll when only the hash changes on the same pathname', () => {
    render(<TestApp initialEntries={['/shop']} />)
    vi.mocked(window.scrollTo).mockClear()
    fireEvent.click(screen.getByText('Anchor'))
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('does NOT scroll when navigating onto /customize/*', () => {
    render(<TestApp initialEntries={['/']} />)
    vi.mocked(window.scrollTo).mockClear()
    fireEvent.click(screen.getByText('Customize'))
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('does NOT force-scroll on a POP (back) navigation', () => {
    render(<TestApp initialEntries={['/', '/shop']} />)
    // MemoryRouter starts at the LAST entry ('/shop'); go back to '/'.
    vi.mocked(window.scrollTo).mockClear()
    fireEvent.click(screen.getByText('Back'))
    expect(window.scrollTo).not.toHaveBeenCalled()
  })
})
