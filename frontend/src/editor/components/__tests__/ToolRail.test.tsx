// POD-V2.md §6.6 / §11 Phase 4 task 4.6 — the "Designs" entry is FIRST in
// the rail, ahead of every insert-a-single-element tool.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ToolRail from '../ToolRail'

function renderRail(overrides: Partial<React.ComponentProps<typeof ToolRail>> = {}) {
  return render(
    <ToolRail
      onOpenDesigns={vi.fn()}
      onAddText={vi.fn()}
      onPickImage={vi.fn()}
      onAddShape={vi.fn()}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      canUndo={false}
      canRedo={false}
      uploading={false}
      {...overrides}
    />
  )
}

describe('ToolRail', () => {
  it('renders "Designs" as the very first button in the rail', () => {
    renderRail()
    const rail = screen.getByTestId('tool-rail')
    const firstButton = rail.querySelector('button')
    expect(firstButton).toHaveAttribute('data-testid', 'tool-rail-designs')
    expect(firstButton).toHaveTextContent('Designs')
  })

  it('calls onOpenDesigns when clicked', async () => {
    const user = userEvent.setup()
    const onOpenDesigns = vi.fn()
    renderRail({ onOpenDesigns })
    await user.click(screen.getByTestId('tool-rail-designs'))
    expect(onOpenDesigns).toHaveBeenCalledTimes(1)
  })
})
