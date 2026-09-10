// Guards a class of bug, not one instance of it.
//
// This codebase's convention is that comments cite the plan document they
// implement ("POD-V2.md §3.1"), which is genuinely useful — for developers.
// Phase 1 leaked that convention into three pieces of merchant-facing copy: a
// category hint, a bulk-pricing explainer and a tier warning all shipped a
// literal "POD-V2.md §N" to people running a shop, for whom it is noise at
// best and a sign of a broken page at worst.
//
// Fixing those three strings does not stop a fourth appearing, because the
// convention that produced them is still (correctly) in force. So this scans
// every source file for a plan-doc reference that is NOT inside a comment.
// Comments are what the convention is for; rendered text is not.
//
// Uses Vite's `import.meta.glob` with `?raw` rather than node:fs, so it needs
// no `@types/node` in a frontend tsconfig that deliberately doesn't have them.
import { describe, it, expect } from 'vitest'

const modules = import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

const DOC_REF = /POD[A-Za-z0-9-]*\.md/

/**
 * Strips `//`, block and JSX-expression comments so only code and rendered
 * text remain. Deliberately conservative: under-stripping is fine (a false
 * positive is a visible, easily-checked failure) but over-stripping would let
 * a real leak through silently.
 */
function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ') // {/* JSX comment */}
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // /* block */ and /** jsdoc */
    .replace(/^[ \t]*\/\/.*$/gm, ' ') // whole-line //
    .replace(/([^:"'`])\/\/.*$/gm, '$1') // trailing // that isn't a URL's //
}

const files = Object.entries(modules).filter(([path]) => !/\.test\.tsx?$/.test(path) && !/__(tests|demo)__/.test(path))

describe('no internal plan-document references reach the UI', () => {
  it('scans a meaningful number of source files', () => {
    expect(files.length).toBeGreaterThan(40)
  })

  it.each(files)('%s', (_path, src) => {
    const offenders = stripComments(src)
      .split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => DOC_REF.test(line))
    expect(
      offenders,
      'A plan-document reference appears outside a comment, so it may render to a user:\n' +
        offenders.map((o) => `  line ${o.n}: ${o.line}`).join('\n')
    ).toEqual([])
  })
})
