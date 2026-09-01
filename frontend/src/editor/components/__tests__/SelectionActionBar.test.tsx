// Bug 2 — the compact mobile action bar: delete/duplicate/layer controls
// are always present and wired up, the colour swatch only shows for a
// colourable object (never an image), and "Edit" opens the full sheet on
// demand rather than automatically.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SelectionActionBar from '../SelectionActionBar'
import type { FabricObject } from '../../fabric/loadFabric'

function mockObject(props: Record<string, unknown>): FabricObject {
  return { set: vi.fn(), ...props } as unknown as FabricObject
}

describe('SelectionActionBar', () => {
  it('renders delete, duplicate, layer controls and Edit, and wires them up', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    const onDuplicate = vi.fn()
    const onBringForward = vi.fn()
    const onSendBackward = vi.fn()
    const onOpenSheet = vi.fn()

    render(
      <SelectionActionBar
        selected={mockObject({ type: 'i-text', fill: '#ff0000' })}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onBringForward={onBringForward}
        onSendBackward={onSendBackward}
        onCommit={vi.fn()}
        onOpenSheet={onOpenSheet}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(onDuplicate).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Bring forward' }))
    expect(onBringForward).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Send backward' }))
    expect(onSendBackward).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onOpenSheet).toHaveBeenCalledTimes(1)
  })

  it('every button target is at least 44px (h-11) — POD-UI.md §5 acceptance #5', () => {
    render(
      <SelectionActionBar
        selected={mockObject({ type: 'rect', fill: '#000000' })}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onBringForward={vi.fn()}
        onSendBackward={vi.fn()}
        onCommit={vi.fn()}
        onOpenSheet={vi.fn()}
      />
    )
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toMatch(/\bh-11\b/)
    }
  })

  it('shows a colour swatch for a colourable (text/shape) object', () => {
    render(
      <SelectionActionBar
        selected={mockObject({ type: 'rect', fill: '#2563eb' })}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onBringForward={vi.fn()}
        onSendBackward={vi.fn()}
        onCommit={vi.fn()}
        onOpenSheet={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Fill colour')).toBeInTheDocument()
  })

  it('never shows a colour swatch for an image', () => {
    render(
      <SelectionActionBar
        selected={mockObject({ type: 'image' })}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onBringForward={vi.fn()}
        onSendBackward={vi.fn()}
        onCommit={vi.fn()}
        onOpenSheet={vi.fn()}
      />
    )
    expect(screen.queryByTitle('Colour')).not.toBeInTheDocument()
  })

  it('applies a colour change through onCommit', () => {
    const onCommit = vi.fn()
    const selected = mockObject({ type: 'i-text', fill: '#101014' })
    render(
      <SelectionActionBar
        selected={selected}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onBringForward={vi.fn()}
        onSendBackward={vi.fn()}
        onCommit={onCommit}
        onOpenSheet={vi.fn()}
      />
    )
    const input = screen.getByLabelText('Text colour') as HTMLInputElement
    fireEvent.change(input, { target: { value: '#00ff00' } })
    expect((selected as unknown as { set: ReturnType<typeof vi.fn> }).set).toHaveBeenCalledWith({ fill: '#00ff00' })
    expect(onCommit).toHaveBeenCalledTimes(1)
  })
})
