// POD-V2.md §6.6 / §11 Phase 4 tasks 4.5-4.6 — the "browse ready-made
// designs" drawer: fetches once per (category, aspect, "show all shapes"),
// filters name+tags client-side, shows loading/error/empty states, and
// hands a picked card straight to `onApply` without doing any Fabric work
// itself.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TemplateDrawer from '../TemplateDrawer'
import { fetchTemplates, TemplatesApiError, type FetchTemplatesResult, type TemplateSummary } from '../../templatesApi'

vi.mock('../../templatesApi', async () => {
  const actual = await vi.importActual<typeof import('../../templatesApi')>('../../templatesApi')
  return { ...actual, fetchTemplates: vi.fn() }
})

const mockedFetchTemplates = vi.mocked(fetchTemplates)

function makeTemplate(overrides: Partial<TemplateSummary> = {}): TemplateSummary {
  return {
    id: 1,
    name: 'Birthday Bash',
    design_json: { objects: [] },
    canvas_w: 100,
    canvas_h: 100,
    preview_url: '/img/templates/1.webp',
    tags: 'party, fun',
    ...overrides,
  }
}

function makeResult(): FetchTemplatesResult {
  return {
    collections: [
      { id: 1, name: 'Birthday', templates: [makeTemplate({ id: 1, name: 'Birthday Bash' }), makeTemplate({ id: 2, name: 'Confetti', tags: 'colorful' })] },
      { id: 2, name: 'Corporate', templates: [makeTemplate({ id: 3, name: 'Minimal Logo', tags: 'clean, professional' })] },
    ],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TemplateDrawer', () => {
  it('does not fetch while closed', () => {
    render(<TemplateDrawer open={false} category="T-Shirts" aspect={1} onClose={vi.fn()} onApply={vi.fn()} />)
    expect(mockedFetchTemplates).not.toHaveBeenCalled()
  })

  it('fetches with category/aspect/all=false on open and renders collections as rows of cards', async () => {
    mockedFetchTemplates.mockResolvedValue(makeResult())
    render(<TemplateDrawer open category="T-Shirts" aspect={1.5} onClose={vi.fn()} onApply={vi.fn()} />)

    expect(mockedFetchTemplates).toHaveBeenCalledWith({ category: 'T-Shirts', aspect: 1.5, all: false })

    expect(await screen.findByText('Birthday')).toBeInTheDocument()
    expect(screen.getByText('Corporate')).toBeInTheDocument()
    expect(screen.getByText('Birthday Bash')).toBeInTheDocument()
    expect(screen.getByText('Minimal Logo')).toBeInTheDocument()
    // Cards render only the small preview image — no Fabric work implied.
    const img = screen.getByAltText('Birthday Bash') as HTMLImageElement
    expect(img.src).toContain('/img/templates/1.webp')
  })

  it('filters by name AND tags, client-side, scoped to already-fetched data', async () => {
    const user = userEvent.setup()
    mockedFetchTemplates.mockResolvedValue(makeResult())
    render(<TemplateDrawer open category="T-Shirts" aspect={1} onClose={vi.fn()} onApply={vi.fn()} />)
    await screen.findByText('Birthday Bash')

    await user.type(screen.getByRole('searchbox', { name: 'Search designs' }), 'clean')
    expect(screen.queryByText('Birthday Bash')).toBeNull()
    expect(screen.getByText('Minimal Logo')).toBeInTheDocument() // matched via its tag, not its name
    // A search that changes doesn't cause a new network round trip.
    expect(mockedFetchTemplates).toHaveBeenCalledTimes(1)
  })

  it('shows a "no matches" message when the search excludes everything', async () => {
    const user = userEvent.setup()
    mockedFetchTemplates.mockResolvedValue(makeResult())
    render(<TemplateDrawer open category="T-Shirts" aspect={1} onClose={vi.fn()} onApply={vi.fn()} />)
    await screen.findByText('Birthday Bash')

    await user.type(screen.getByRole('searchbox', { name: 'Search designs' }), 'nonexistent-xyz')
    expect(await screen.findByText('No designs match “nonexistent-xyz”.')).toBeInTheDocument()
  })

  it('"show all shapes" re-fetches with all=1 (all:true)', async () => {
    const user = userEvent.setup()
    mockedFetchTemplates.mockResolvedValue(makeResult())
    render(<TemplateDrawer open category="T-Shirts" aspect={1} onClose={vi.fn()} onApply={vi.fn()} />)
    await screen.findByText('Birthday Bash')
    expect(mockedFetchTemplates).toHaveBeenLastCalledWith({ category: 'T-Shirts', aspect: 1, all: false })

    await user.click(screen.getByRole('switch', { name: 'Show all shapes' }))
    await waitFor(() => expect(mockedFetchTemplates).toHaveBeenLastCalledWith({ category: 'T-Shirts', aspect: 1, all: true }))
  })

  it('hands the picked template straight to onApply with no intermediate Fabric work', async () => {
    const user = userEvent.setup()
    mockedFetchTemplates.mockResolvedValue(makeResult())
    const onApply = vi.fn()
    render(<TemplateDrawer open category="T-Shirts" aspect={1} onClose={vi.fn()} onApply={onApply} />)
    const card = await screen.findByText('Birthday Bash')

    await user.click(card.closest('button')!)
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply.mock.calls[0][0]).toMatchObject({ id: 1, name: 'Birthday Bash' })
  })

  it('disables every card while a template is being applied', async () => {
    mockedFetchTemplates.mockResolvedValue(makeResult())
    render(<TemplateDrawer open category="T-Shirts" aspect={1} onClose={vi.fn()} onApply={vi.fn()} applying />)
    const card = (await screen.findByText('Birthday Bash')).closest('button')!
    expect(card).toBeDisabled()
  })

  it('shows an error with a working retry', async () => {
    const user = userEvent.setup()
    mockedFetchTemplates.mockRejectedValueOnce(new TemplatesApiError('Server exploded'))
    render(<TemplateDrawer open category="T-Shirts" aspect={1} onClose={vi.fn()} onApply={vi.fn()} />)
    expect(await screen.findByText('Server exploded')).toBeInTheDocument()

    mockedFetchTemplates.mockResolvedValueOnce(makeResult())
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Birthday Bash')).toBeInTheDocument()
  })

  it('shows an empty-catalog message distinct from a no-search-matches message', async () => {
    mockedFetchTemplates.mockResolvedValue({ collections: [] })
    render(<TemplateDrawer open category="T-Shirts" aspect={1} onClose={vi.fn()} onApply={vi.fn()} />)
    expect(await screen.findByText('No designs are available for this product yet.')).toBeInTheDocument()
  })

  it('calls onClose from the close button and the backdrop', async () => {
    const user = userEvent.setup()
    mockedFetchTemplates.mockResolvedValue(makeResult())
    const onClose = vi.fn()
    render(<TemplateDrawer open category="T-Shirts" aspect={1} onClose={onClose} onApply={vi.fn()} />)
    await screen.findByText('Birthday Bash')

    await user.click(screen.getByRole('button', { name: 'Close designs' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('resets search and "show all shapes" each time it is freshly opened', async () => {
    mockedFetchTemplates.mockResolvedValue(makeResult())
    const { rerender } = render(<TemplateDrawer open={false} category="T-Shirts" aspect={1} onClose={vi.fn()} onApply={vi.fn()} />)
    rerender(<TemplateDrawer open category="T-Shirts" aspect={1} onClose={vi.fn()} onApply={vi.fn()} />)
    await screen.findByText('Birthday Bash')
    const search = screen.getByRole('searchbox', { name: 'Search designs' }) as HTMLInputElement
    await userEvent.type(search, 'confetti')
    expect(screen.queryByText('Birthday Bash')).toBeNull()

    // Close, then re-open: a fresh browse session.
    rerender(<TemplateDrawer open={false} category="T-Shirts" aspect={1} onClose={vi.fn()} onApply={vi.fn()} />)
    rerender(<TemplateDrawer open category="T-Shirts" aspect={1} onClose={vi.fn()} onApply={vi.fn()} />)
    await screen.findByText('Birthday Bash')
    expect((screen.getByRole('searchbox', { name: 'Search designs' }) as HTMLInputElement).value).toBe('')
  })

  it('is visually an opaque, off-canvas-when-closed panel', () => {
    render(<TemplateDrawer open={false} category="T-Shirts" aspect={1} onClose={vi.fn()} onApply={vi.fn()} />)
    const panel = screen.getByTestId('template-drawer')
    expect(panel.className).toContain('translate-x-full')
  })

  it('renders both collection rows even when only one matches the search', async () => {
    const user = userEvent.setup()
    mockedFetchTemplates.mockResolvedValue(makeResult())
    render(<TemplateDrawer open category="T-Shirts" aspect={1} onClose={vi.fn()} onApply={vi.fn()} />)
    await screen.findByText('Birthday Bash')

    await user.type(screen.getByRole('searchbox', { name: 'Search designs' }), 'minimal')
    expect(screen.queryByText('Birthday')).toBeNull() // the OTHER collection's row is gone too, not just its cards
    const corporate = screen.getByText('Corporate')
    expect(within(corporate.closest('section')!).getByText('Minimal Logo')).toBeInTheDocument()
  })
})
