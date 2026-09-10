// Guards the icon-subset contract, not one instance of it — POD-UI4.md §2.6.
//
// Material Symbols is loaded SUBSETTED (`icon_names=` in index.html) because
// the full variable font is ~340KB. The failure mode when a name isn't in the
// subset is silent and shopper-visible: the ligature never substitutes, so the
// glyph renders as the literal word "shopping_cart". Nothing throws, no test
// fails on its own, and it looks like a broken page.
//
// So there are two halves to keep in sync, and this file pins both:
//   1. every `<Icon name="X">` literal in the source is in `ICON_NAMES`, and
//   2. `index.html`'s `icon_names=` parameter equals `ICON_NAMES` exactly.
//
// (1) is *also* enforced by the type system — `IconName` is derived from
// `ICON_NAMES` — but only for statically-written literals; a name assembled at
// runtime, or a stray hand-written `<span className="material-symbols-outlined">`,
// would slip past `tsc`. (2) the type system cannot see at all.
//
// Uses Vite's `import.meta.glob` with `?raw` rather than node:fs, matching
// admin/__tests__/noInternalDocRefs.test.ts — the frontend tsconfig
// deliberately has no `@types/node`.
import { describe, it, expect } from 'vitest'
import { ICON_NAMES } from '../iconNames'

const sources = import.meta.glob('../../../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const indexHtml = import.meta.glob('../../../../index.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const NAME_SET = new Set<string>(ICON_NAMES)

/** `name="foo"` / `name='foo'` / `name={'foo'}` on an <Icon …> element. */
const ICON_USAGE = /<Icon\b[^>]*?\bname=(?:"([a-z0-9_]+)"|'([a-z0-9_]+)'|\{\s*'([a-z0-9_]+)'\s*\})/g

describe('Material Symbols subset stays in sync with its usage', () => {
  it('scans a meaningful number of source files', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(40)
  })

  it('ICON_NAMES is sorted and free of duplicates', () => {
    expect([...ICON_NAMES]).toEqual([...ICON_NAMES].slice().sort())
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length)
  })

  it('every <Icon name="…"> literal in the source is in the loaded subset', () => {
    const missing: string[] = []
    for (const [path, src] of Object.entries(sources)) {
      if (/iconNames\.ts$/.test(path)) continue
      for (const m of src.matchAll(ICON_USAGE)) {
        const name = m[1] ?? m[2] ?? m[3]
        if (name && !NAME_SET.has(name)) missing.push(`${path}: ${name}`)
      }
    }
    expect(
      missing,
      'An <Icon> uses a name that is not in ICON_NAMES, so the subsetted font will not contain it and ' +
        'the glyph will render as its literal ligature text. Add it to iconNames.ts AND to index.html:\n' +
        missing.map((m) => `  ${m}`).join('\n'),
    ).toEqual([])
  })

  it("index.html's icon_names= parameter matches ICON_NAMES exactly", () => {
    const html = Object.values(indexHtml)[0]
    expect(html, 'index.html was not found by the glob').toBeTruthy()

    const match = html.match(/icon_names=([a-z0-9_,]+)/)
    expect(match, 'index.html has no icon_names= parameter on the Material Symbols stylesheet link').toBeTruthy()

    expect(match![1].split(',')).toEqual([...ICON_NAMES])
  })
})
