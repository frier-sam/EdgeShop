import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Button from '../Button'
import IconButton from '../ui/IconButton'

// Regression test for the footgun described in the task brief: Button's
// BASE class hard-codes an unprefixed `inline-flex`. Because Tailwind
// writes `.hidden` earlier than `.inline-flex` in its generated
// stylesheet, `.inline-flex` always won the cascade regardless of where
// `hidden` sat in the `class="..."` string — so
// `<Button className="hidden md:inline-flex">` never actually hid
// anything. This asserts the rendered class list itself no longer carries
// a conflicting unprefixed `inline-flex` alongside the caller's `hidden`.
describe('Button display-class conflicts', () => {
  it('lets a caller-supplied "hidden md:inline-flex" win over the base inline-flex', () => {
    render(<Button className="hidden md:inline-flex">Desktop only</Button>)
    const button = screen.getByRole('button', { name: 'Desktop only' })
    const classes = button.className.split(/\s+/)

    expect(classes).toContain('hidden')
    expect(classes).toContain('md:inline-flex')
    // The component's own unprefixed inline-flex must not survive — that's
    // exactly what defeated `hidden` before this fix.
    expect(classes).not.toContain('inline-flex')
  })

  it('keeps the default inline-flex when the caller does not touch display', () => {
    render(<Button>Normal button</Button>)
    const button = screen.getByRole('button', { name: 'Normal button' })
    expect(button.className.split(/\s+/)).toContain('inline-flex')
  })

  it('IconButton resolves the same conflict', () => {
    render(
      <IconButton className="hidden md:inline-flex" aria-label="Next">
        <svg />
      </IconButton>,
    )
    const button = screen.getByRole('button', { name: 'Next' })
    const classes = button.className.split(/\s+/)

    expect(classes).toContain('hidden')
    expect(classes).toContain('md:inline-flex')
    expect(classes).not.toContain('inline-flex')
  })
})
