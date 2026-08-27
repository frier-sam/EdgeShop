import { describe, it, expect } from 'vitest'
import { cn } from '../cn'

describe('cn', () => {
  it('joins plain, non-conflicting classes in order', () => {
    expect(cn('rounded-btn font-semibold', 'text-sm', 'px-4')).toBe('rounded-btn font-semibold text-sm px-4')
  })

  it('drops falsy fragments', () => {
    expect(cn('a', undefined, false, null, '', 'b')).toBe('a b')
  })

  it('lets a later unprefixed display utility replace an earlier one at the same scope', () => {
    // This is the Button.tsx bug in miniature: a base class hard-codes
    // `inline-flex`, and a caller passes `hidden`. Plain string
    // concatenation keeps both tokens and Tailwind's alphabetical
    // stylesheet order makes `.inline-flex` win regardless of position in
    // the class attribute — `cn` must resolve it before that ever reaches
    // the DOM by dropping the earlier one instead of leaving both.
    const result = cn('relative inline-flex items-center', 'hidden')
    const tokens = result.split(' ')
    expect(tokens).toContain('hidden')
    expect(tokens).not.toContain('inline-flex')
  })

  it('resolves the exact reported case: base inline-flex vs. caller "hidden md:inline-flex"', () => {
    const result = cn('relative inline-flex items-center justify-center', 'hidden md:inline-flex')
    const tokens = result.split(' ')
    // Unprefixed `inline-flex` from BASE must be gone — `hidden` owns the
    // unprefixed (all-viewport) scope now.
    expect(tokens).not.toContain('inline-flex')
    expect(tokens).toContain('hidden')
    // The caller's responsive override survives untouched.
    expect(tokens).toContain('md:inline-flex')
    // No duplicate/leftover unprefixed display utility of any kind.
    expect(tokens.filter((t) => t === 'hidden' || t === 'inline-flex').length).toBe(1)
  })

  it('leaves non-colliding variant scopes alone (unprefixed base + responsive-only override)', () => {
    // e.g. a component defaults to `inline-flex` and a caller only wants
    // to hide it at md+ (`md:hidden`) while keeping the mobile default —
    // that's ordinary Tailwind composition, not a conflict, so both must
    // survive.
    const result = cn('inline-flex items-center', 'md:hidden')
    const tokens = result.split(' ')
    expect(tokens).toContain('inline-flex')
    expect(tokens).toContain('md:hidden')
  })

  it('does not false-positive on utilities that merely start with a display-utility name', () => {
    const result = cn('inline-flex', 'flex-1 grid-cols-2 blockquote-like')
    const tokens = result.split(' ')
    // `flex-1` etc. are not `flex`/`grid`/`block` and must not be treated
    // as display-group members or trigger any replacement.
    expect(tokens).toContain('inline-flex')
    expect(tokens).toContain('flex-1')
    expect(tokens).toContain('grid-cols-2')
    expect(tokens).toContain('blockquote-like')
  })

  it('last display utility at a scope wins when more than two collide', () => {
    const result = cn('flex', 'block', 'hidden')
    expect(result).toBe('hidden')
  })
})
