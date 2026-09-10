// POD-UI4.md §5 A.3/A.4 — covers the two behaviours this round rewrote:
// the mega-menu's open/close mechanics (hover + click/Enter + Escape +
// empty-state) and the header search's debounced `?q=` wiring (no fetch
// per keystroke, an explicit no-matches state, and Enter jumping to the
// full results page).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Header from '../Header'
import type { ProductSummary } from '../../lib/types'

vi.mock('../../lib/api', () => ({ fetchJson: vi.fn() }))
import { fetchJson } from '../../lib/api'

const mockedFetchJson = vi.mocked(fetchJson)

interface MockCategory {
  name: string
  count: number
  image: string | null
}

function category(overrides: Partial<MockCategory> = {}): MockCategory {
  return { name: 'Mugs', count: 4, image: null, ...overrides }
}

function product(overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    id: 1,
    name: 'Classic Mug',
    slug: null,
    base_price: 299,
    compare_price: null,
    category: 'Mugs',
    is_customizable: 0,
    front_image: null,
    back_image: null,
    min_order_qty: 1,
    lowest_break: null,
    ...overrides,
  }
}

/** Routes fetchJson by URL prefix — every render fires the settings + categories queries regardless of what a test cares about, so both need a sane default. */
function mockApi({
  categories = [],
  products = [],
}: {
  categories?: MockCategory[]
  products?: ProductSummary[]
}) {
  mockedFetchJson.mockImplementation(async (url: string) => {
    if (url.startsWith('/api/settings')) return { store_name: 'ESPOD', currency: 'INR' }
    if (url.startsWith('/api/categories')) return { categories }
    if (url.startsWith('/api/products')) return { products }
    throw new Error(`Unexpected fetchJson call in test: ${url}`)
  })
}

function renderHeader() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Header storeName="ESPOD" cartCount={0} onCartOpen={vi.fn()} navItems={[]} />} />
          <Route path="/shop" element={<p>Shop results page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Header — categories mega-menu', () => {
  it('renders no trigger at all when the catalog has no categories — never an empty panel shell', async () => {
    mockApi({ categories: [] })
    renderHeader()
    await waitFor(() => expect(mockedFetchJson).toHaveBeenCalledWith('/api/categories'))
    expect(screen.queryByRole('button', { name: /Categories/i })).not.toBeInTheDocument()
  })

  it('opens on click, lists every category with its count, and closes on Escape, restoring focus to the trigger', async () => {
    mockApi({ categories: [category({ name: 'Mugs', count: 4 }), category({ name: 'T-Shirts', count: 12 })] })
    renderHeader()

    const trigger = await screen.findByRole('button', { name: /Categories/i })
    fireEvent.click(trigger)

    expect(screen.getByRole('menu', { name: 'Categories' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Mugs/ })).toBeInTheDocument()
    expect(screen.getByText('4 items')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /T-Shirts/ })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('opens on hover and closes again shortly after the pointer leaves', async () => {
    mockApi({ categories: [category()] })
    renderHeader()

    const trigger = await screen.findByRole('button', { name: /Categories/i })
    const container = trigger.parentElement as HTMLElement

    fireEvent.mouseEnter(container)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.mouseLeave(container)
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('toggles closed on a second click', async () => {
    mockApi({ categories: [category()] })
    renderHeader()

    const trigger = await screen.findByRole('button', { name: /Categories/i })
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('Header — debounced product search', () => {
  beforeEach(() => {
    mockApi({ products: [product()] })
  })

  it('shows a quiet prompt (no fetch, no spinner) while the field is empty', async () => {
    renderHeader()
    const input = screen.getByRole('searchbox', { name: 'Search products' })
    fireEvent.focus(input)

    expect(screen.getByText(/Start typing to search the catalog/i)).toBeInTheDocument()
    expect(mockedFetchJson).not.toHaveBeenCalledWith(expect.stringContaining('/api/products'))
  })

  it('does not fetch on every keystroke — only once, after the debounce settles', async () => {
    renderHeader()
    const input = screen.getByRole('searchbox', { name: 'Search products' })
    fireEvent.focus(input)

    fireEvent.change(input, { target: { value: 'm' } })
    fireEvent.change(input, { target: { value: 'mu' } })
    fireEvent.change(input, { target: { value: 'mug' } })

    // Debounce window hasn't elapsed yet — nothing fetched for any of the
    // intermediate keystrokes.
    expect(mockedFetchJson).not.toHaveBeenCalledWith(expect.stringContaining('/api/products'))

    await waitFor(() => expect(mockedFetchJson).toHaveBeenCalledWith(expect.stringContaining('q=mug')))
    // Exactly one products call — not one per keystroke.
    const productCalls = mockedFetchJson.mock.calls.filter(([url]) => (url as string).includes('/api/products'))
    expect(productCalls).toHaveLength(1)

    expect(await screen.findByText('Classic Mug')).toBeInTheDocument()
  })

  it('shows an explicit no-matches message for a settled query with zero hits', async () => {
    mockApi({ products: [] })
    renderHeader()
    const input = screen.getByRole('searchbox', { name: 'Search products' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'zzz-nomatch' } })

    await waitFor(() => expect(mockedFetchJson).toHaveBeenCalledWith(expect.stringContaining('q=zzz-nomatch')))
    expect(await screen.findByText(/No products match/i)).toBeInTheDocument()
  })

  it('Enter navigates to /shop?q=<query> with the full result set', async () => {
    renderHeader()
    const input = screen.getByRole('searchbox', { name: 'Search products' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'mug' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(await screen.findByText('Shop results page')).toBeInTheDocument()
  })
})
