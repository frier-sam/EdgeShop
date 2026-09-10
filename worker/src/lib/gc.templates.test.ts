// worker/src/lib/gc.templates.test.ts
//
// POD-V2.md §6.1 / §11 Phase 4.8 — pins that the orphan-design GC
// (runOrphanDesignGC in ./gc.ts) can never reap `design_templates` rows.
// Templates live in their own table specifically so gc.ts's `designs`-only
// query is already safe today (see the schema.sql comment above
// `template_collections`, and gc.ts's own header) — but that safety is
// currently just an accident of table choice, not something gc.ts enforces
// against. A future refactor that widened gc.ts's SELECT/DELETE to cover
// "any orphaned design-shaped row" (or introduced a shared `designs ∪
// design_templates` view) would quietly start deleting the merchant's
// whole template library, since a template's very definition (§6.1) is
// that it's never attached to an order — the exact same condition
// (`order_id IS NULL`) the GC already uses to select real orphans.
//
// gc.ts is explicitly DO-NOT-EDIT for this task, and per
// routes/admin/products.test.ts's header this repo deliberately has no
// D1/SQLite test harness — D1-touching code isn't integration-tested
// here. So this pins the contract the same way migrate.test.ts pins
// schema.sql: by reading gc.ts's own committed source text (Vite/
// Vitest's `?raw` import — see ./ts-raw.d.ts) and asserting neither
// `design_templates` nor `template_collections` appears in it anywhere,
// plus that the actual SQL it does run names `designs` explicitly.
import { describe, it, expect } from 'vitest'
import gcSource from './gc.ts?raw'

describe('gc.ts never references the template tables (POD-V2.md §6.1 / §11 Phase 4.8)', () => {
  it('contains no mention of design_templates or template_collections anywhere in the file', () => {
    // A blanket string check, not just a check against today's one query —
    // this fails the instant either table name is introduced into gc.ts at
    // all, however it's introduced (a new query, a comment referencing a
    // planned change, a JOIN, a UNION, ...).
    expect(gcSource).not.toMatch(/design_templates/i)
    expect(gcSource).not.toMatch(/template_collections/i)
  })

  it('the orphan-selection query and the delete statement both name the designs table explicitly', () => {
    // Belt-and-braces on top of the blanket check above: confirm gc.ts's
    // actual SQL targets a real, explicitly-named `designs` table rather
    // than, say, a view or wildcard that a future migration could
    // redefine to include templates without gc.ts's own source ever
    // mentioning them.
    expect(gcSource).toMatch(/FROM designs\b/)
    expect(gcSource).toMatch(/DELETE FROM designs\b/)
  })

  it('sanity: the source text actually contains the GC function, so this isn\'t silently reading an empty/wrong file', () => {
    expect(gcSource).toContain('runOrphanDesignGC')
    expect(gcSource.length).toBeGreaterThan(500)
  })
})
