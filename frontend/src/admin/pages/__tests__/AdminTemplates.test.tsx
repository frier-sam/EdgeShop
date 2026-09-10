// POD-V2.md §6.2 / §11 Phase 4.2. describeAspectRatio is the pure,
// directly-testable piece (mirrors this repo's convention of pulling the
// pure logic out of a CRUD page and pinning it directly — see
// ProductPriceBreaksEditor.test.tsx's isTierBelowPrintFees). The render
// tests below cover empty/loading states and the create-collection
// validation gate without needing a live worker.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AdminTemplates, { describeAspectRatio } from '../AdminTemplates'

vi.mock('../../lib/adminFetch', () => ({ adminFetch: vi.fn() }))
import { adminFetch } from '../../lib/adminFetch'
// CategoryCombobox (mounted inside every collection row, and inside
// NewCollectionForm) calls the plain, unauthenticated fetchJson for the
// public /api/categories suggestions list — mock it too so this page can
// render without a second, unrelated network mock at every call site.
vi.mock('../../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api')>()
  return { ...actual, fetchJson: vi.fn() }
})

const mockedAdminFetch = vi.mocked(adminFetch)
import { fetchJson } from '../../../lib/api'
const mockedFetchJson = vi.mocked(fetchJson)

beforeEach(() => {
  // Re-armed before every test rather than once at the vi.mock() factory
  // — `afterEach`'s `vi.restoreAllMocks()` below wipes any
  // mockResolvedValue set on a plain `vi.fn()` (there's no "original"
  // implementation to restore to), so setting it only once would leave
  // every test after the first with a resolved-undefined fetchJson.
  mockedFetchJson.mockResolvedValue({ categories: [] })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/templates']}>
        <AdminTemplates />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('describeAspectRatio', () => {
  it('labels a taller-than-wide print area "Portrait"', () => {
    expect(describeAspectRatio(300, 400)).toBe('Portrait, 0.75:1')
  })

  it('labels a wider-than-tall print area "Landscape"', () => {
    expect(describeAspectRatio(400, 300)).toBe('Landscape, 1.33:1')
  })

  it('labels a near-1:1 print area "Square" within tolerance', () => {
    expect(describeAspectRatio(100, 100)).toBe('Square, 1.00:1')
    expect(describeAspectRatio(102, 100)).toBe('Square, 1.02:1')
  })

  it('degrades gracefully on non-finite or non-positive input rather than dividing by zero', () => {
    expect(describeAspectRatio(0, 100)).toBe('Unknown shape')
    expect(describeAspectRatio(100, 0)).toBe('Unknown shape')
    expect(describeAspectRatio(NaN, 100)).toBe('Unknown shape')
  })
})

describe('AdminTemplates page', () => {
  it('shows an empty state with a call to action when there are no collections', async () => {
    mockedAdminFetch.mockResolvedValue({ ok: true, json: async () => ({ collections: [] }) } as Response)
    renderPage()
    expect(await screen.findByText(/no collections yet/i)).toBeInTheDocument()
  })

  it('renders an existing collection collapsed, without eagerly fetching its templates', async () => {
    mockedAdminFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ collections: [{ id: 1, name: 'Birthday', category: 'T-Shirts', status: 'active', sort_order: 0 }] }),
    } as Response)
    renderPage()
    expect(await screen.findByDisplayValue('Birthday')).toBeInTheDocument()
    // Only the one call for the collections list — the nested
    // TemplateGrid's own query is gated behind expanding the row, so it
    // must not have fired yet.
    await waitFor(() => expect(mockedAdminFetch).toHaveBeenCalledTimes(1))
    expect(mockedAdminFetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/admin/templates?collection_id='), expect.anything())
  })

  it('blocks creating a collection with a blank name, without calling the API', async () => {
    mockedAdminFetch.mockResolvedValue({ ok: true, json: async () => ({ collections: [] }) } as Response)
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /new collection/i }))
    await user.click(screen.getByRole('button', { name: /create collection/i }))
    expect(await screen.findByText(/give the collection a name/i)).toBeInTheDocument()
    // The only call so far is the initial collections-list GET.
    expect(mockedAdminFetch).toHaveBeenCalledTimes(1)
  })
})
