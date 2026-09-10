// POD-V2.md §7 — categories stay free text, so this is a warning, never a
// block: a value matching an existing category shows nothing extra, a
// genuinely novel value is completely fine to save, and only a
// near-miss (nothing matches at all) gets a nudge, because that is
// exactly the case that later silently orphans a Phase-4 template
// collection.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CategoryCombobox from '../CategoryCombobox'

vi.mock('../../lib/api', () => ({ fetchJson: vi.fn() }))
import { fetchJson } from '../../lib/api'

const mockedFetchJson = vi.mocked(fetchJson)

afterEach(() => {
  vi.restoreAllMocks()
})

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('CategoryCombobox', () => {
  it('shows no warning while the category list is still loading', () => {
    mockedFetchJson.mockReturnValue(new Promise(() => {})) // never resolves
    renderWithClient(<CategoryCombobox value="T-shirts" onChange={vi.fn()} />)
    expect(screen.queryByText(/new category/i)).not.toBeInTheDocument()
  })

  it('shows no warning when the typed value matches an existing category (case-insensitively)', async () => {
    mockedFetchJson.mockResolvedValue({ categories: [{ name: 'Visiting Cards', count: 4, image: null }] })
    renderWithClient(<CategoryCombobox value="visiting cards" onChange={vi.fn()} />)
    await waitFor(() => expect(mockedFetchJson).toHaveBeenCalledWith('/api/categories'))
    expect(screen.queryByText(/new category/i)).not.toBeInTheDocument()
  })

  it('warns when the typed value matches no existing category — the Visiting Card / Visiting Cards trap', async () => {
    mockedFetchJson.mockResolvedValue({ categories: [{ name: 'Visiting Cards', count: 4, image: null }] })
    renderWithClient(<CategoryCombobox value="Visiting Card" onChange={vi.fn()} />)
    expect(await screen.findByText(/new category — "Visiting Card" will be created/i)).toBeInTheDocument()
  })

  it('never warns on an empty value', async () => {
    mockedFetchJson.mockResolvedValue({ categories: [{ name: 'Visiting Cards', count: 4, image: null }] })
    renderWithClient(<CategoryCombobox value="" onChange={vi.fn()} />)
    await waitFor(() => expect(mockedFetchJson).toHaveBeenCalled())
    expect(screen.queryByText(/new category/i)).not.toBeInTheDocument()
  })

  it('offers every existing category as a <datalist> suggestion', async () => {
    mockedFetchJson.mockResolvedValue({
      categories: [
        { name: 'T-shirts', count: 10, image: null },
        { name: 'Mugs', count: 3, image: null },
      ],
    })
    const { container } = renderWithClient(<CategoryCombobox value="" onChange={vi.fn()} />)
    // jsdom/testing-library don't compute an ARIA "option" role for
    // <option> elements sitting inside a <datalist> (only inside
    // <select>), so this asserts on the DOM directly rather than by role.
    await waitFor(() => expect(container.querySelectorAll('datalist option')).toHaveLength(2))
  })
})
