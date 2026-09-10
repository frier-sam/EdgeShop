// Ambient module declaration for Vite/Vitest's built-in `?raw` raw-text
// import suffix (any file, any extension — no plugin needed), applied here
// to a `.ts` source file. Sibling of sql-raw.d.ts, which declares the same
// mechanism for `*.sql?raw` (see that file's header for the full
// rationale — this one exists purely because the wildcard pattern is
// matched per-extension, so a `.sql?raw` declaration doesn't also cover
// `.ts?raw`). Used only by gc.templates.test.ts, to read gc.ts's own
// committed source text for the design_templates exclusion pin
// (POD-V2.md §11 Phase 4.8) without pulling `@types/node` into this
// project — gc.ts is DO-NOT-EDIT for that task, so there's no exported
// constant to import instead.
declare module '*.ts?raw' {
  const content: string
  export default content
}
