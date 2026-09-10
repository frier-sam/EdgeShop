// POD-V2.md §11 Phase 1.3 — "unticking a block hides it but MUST NOT
// delete its rows." Section (exported from AdminProductEdit.tsx) is the
// one primitive every capability block (axis 1, axis 2, bulk pricing,
// customization) shares for this — so testing it directly, with a
// stand-in child instead of the real ProductSizesEditor/
// ProductVariantsEditor/ProductPriceBreaksEditor, pins the exact
// mechanism those three depend on without needing a live product fetch
// or network mocking for the whole page.
import { describe, it, expect, vi } from 'vitest'
import { useEffect, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Section } from '../AdminProductEdit'

// Stands in for a row editor: local state (`text`) representing an
// in-progress draft row, and a mount-effect spy that only fires again if
// this component is ever actually unmounted and remounted — which is
// exactly the bug this test guards against (a naive `{checked && <Child/>}`
// would remount on every toggle and silently drop `text`).
function DraftRowStandIn({ mountSpy }: { mountSpy: () => void }) {
  const [text, setText] = useState('')
  useEffect(() => {
    mountSpy()
  }, [mountSpy])
  return <input aria-label="draft row" value={text} onChange={(e) => setText(e.target.value)} />
}

function ToggleHarness({ mountSpy }: { mountSpy: () => void }) {
  const [checked, setChecked] = useState(true)
  return (
    <Section title="Axis 2" toggle={{ checked, onChange: setChecked }}>
      <DraftRowStandIn mountSpy={mountSpy} />
    </Section>
  )
}

describe('Section — capability block toggle', () => {
  it('never unmounts its child on untick, so an unsaved row survives hide → show', async () => {
    const user = userEvent.setup()
    const mountSpy = vi.fn()
    render(<ToggleHarness mountSpy={mountSpy} />)

    await user.type(screen.getByLabelText('draft row'), 'Navy')
    expect(mountSpy).toHaveBeenCalledTimes(1)

    const checkbox = screen.getByRole('checkbox')
    const wrapper = screen.getByLabelText('draft row').closest('div') as HTMLElement
    expect(wrapper.className).toBe('')

    // Untick: hidden via CSS only.
    await user.click(checkbox)
    expect(wrapper.className).toBe('hidden')
    expect(screen.getByLabelText('draft row')).toHaveValue('Navy')
    expect(mountSpy).toHaveBeenCalledTimes(1) // still just the original mount

    // Re-tick: visible again, value never had to be retyped.
    await user.click(checkbox)
    expect(wrapper.className).toBe('')
    expect(screen.getByLabelText('draft row')).toHaveValue('Navy')
    expect(mountSpy).toHaveBeenCalledTimes(1)
  })

  it('renders as a plain bordered card with no checkbox when no toggle is given (Basics)', () => {
    render(
      <Section title="Basics">
        <p>plain content</p>
      </Section>,
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByText('Basics')).toBeInTheDocument()
    expect(screen.getByText('plain content')).toBeInTheDocument()
  })
})
