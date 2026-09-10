// POD-UI3.md §4.5 / §4.6 — preview mode's two contracts that are cheap to
// pin down without a real Fabric canvas:
//   - useEditorObjects' `interactive` gate: in preview mode the live canvas
//     is hidden behind a rendered composite, so the window-level
//     undo/delete keybindings must NOT be bound at all.
//   - PreviewStage's three visual states and their precedence.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PreviewStage from '../components/PreviewStage'
import { useEditorObjects } from '../useEditorObjects'
import type { FabricCanvas } from '../fabric/loadFabric'

/** Just enough canvas for the hook's event-wiring and keybinding effects. */
function mockCanvas(): FabricCanvas {
  return {
    on: vi.fn(),
    off: vi.fn(),
    getObjects: () => [],
    getActiveObject: () => null,
    requestRenderAll: vi.fn(),
  } as unknown as FabricCanvas
}

function keydownListenerCount(spy: ReturnType<typeof vi.spyOn>): number {
  return spy.mock.calls.filter((c) => c[0] === 'keydown').length
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useEditorObjects — POD-UI3.md §4.5 interactive gate', () => {
  it('binds the global keydown listener by default', () => {
    const spy = vi.spyOn(window, 'addEventListener')
    renderHook(() => useEditorObjects({ fabric: null, canvas: mockCanvas() }))
    expect(keydownListenerCount(spy)).toBe(1)
  })

  it('binds it when interactive is explicitly true', () => {
    const spy = vi.spyOn(window, 'addEventListener')
    renderHook(() => useEditorObjects({ fabric: null, canvas: mockCanvas(), interactive: true }))
    expect(keydownListenerCount(spy)).toBe(1)
  })

  it('does NOT bind it when interactive is false (preview mode)', () => {
    const spy = vi.spyOn(window, 'addEventListener')
    renderHook(() => useEditorObjects({ fabric: null, canvas: mockCanvas(), interactive: false }))
    expect(keydownListenerCount(spy)).toBe(0)
  })

  it('unbinds when interactive flips to false and rebinds when it flips back', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const canvas = mockCanvas()
    const { rerender } = renderHook(({ interactive }: { interactive: boolean }) => useEditorObjects({ fabric: null, canvas, interactive }), {
      initialProps: { interactive: true },
    })
    expect(keydownListenerCount(addSpy)).toBe(1)

    rerender({ interactive: false })
    expect(keydownListenerCount(removeSpy)).toBe(1)
    expect(keydownListenerCount(addSpy)).toBe(1) // still just the one bind

    rerender({ interactive: true })
    expect(keydownListenerCount(addSpy)).toBe(2)
  })
})

describe('PreviewStage — POD-UI3.md §4.6', () => {
  it('is an opaque absolute overlay so the design stage beneath cannot show through', () => {
    render(<PreviewStage imageUrl="blob:x" rendering={false} error={null} onRetry={vi.fn()} />)
    const overlay = screen.getByTestId('preview-stage')
    expect(overlay.className).toContain('absolute')
    expect(overlay.className).toContain('inset-0')
    expect(overlay.className).toContain('z-20')
    // What matters is that the ground is OPAQUE — a fully-opaque background
    // token with no alpha modifier — not which shade it happens to be. The
    // shade is a design choice that has already changed once (surface-2 ->
    // surface, so the mockup's own white photo background doesn't read as a
    // panel), whereas any alpha would let the design plane and its guides
    // bleed through and undo the point of the two modes being distinct.
    expect(overlay.className).toMatch(/\bbg-(surface|paper|surface-2)\b(?!\/)/)
  })

  it('shows the composite object-contain once it has one', () => {
    render(<PreviewStage imageUrl="blob:composite" rendering={false} error={null} onRetry={vi.fn()} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'blob:composite')
    expect(img.className).toContain('object-contain')
  })

  it('shows a spinner while rendering, with no image', () => {
    render(<PreviewStage imageUrl={null} rendering error={null} onRetry={vi.fn()} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('Rendering your preview…')).toBeInTheDocument()
  })

  it('shows the error and wires the retry button', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<PreviewStage imageUrl={null} rendering={false} error="It broke." onRetry={onRetry} />)
    expect(screen.getByText('It broke.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('keeps showing a cached side even while the OTHER side is rendering or has failed', () => {
    // `rendering`/`error` are per-SESSION, `imageUrl` is per-SIDE — a
    // shopper looking at a side that rendered fine must keep seeing it.
    const { rerender } = render(<PreviewStage imageUrl="blob:front" rendering error={null} onRetry={vi.fn()} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:front')
    rerender(<PreviewStage imageUrl="blob:front" rendering={false} error="Back side failed." onRetry={vi.fn()} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:front')
    expect(screen.queryByText('Back side failed.')).toBeNull()
  })
})
