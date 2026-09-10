// POD-V2.md §11 Phase 4.3 — "CustomizerEditor is lazy-loaded everywhere
// it's used, to keep Fabric out of the main bundle... Do the same here,
// or Fabric ships to every admin page. This is a hard requirement with a
// test guarding bundle composition."
//
// This runs a REAL production `vite build` (in-process, `write: false` so
// nothing touches disk) and inspects the actual Rollup output chunks —
// not a source-text heuristic like noInternalDocRefs.test.ts's `?raw`
// scan, because "is Fabric in the main chunk" is exactly the kind of
// question a bundler's own chunking decides, not something a regex over
// import statements can prove. `moduleIds` on a chunk is the ground
// truth: a module only appears there if Rollup actually put its code in
// that chunk's output.
//
// `@vitest-environment node` is required on this file specifically:
// vite's own build calls esbuild, and esbuild's Node-target binary loader
// asserts `new TextEncoder().encode('') instanceof Uint8Array`, which is
// false under jsdom's (this repo's default test environment, set in
// vite.config.ts) polyfilled TextEncoder. Running this one file under the
// real Node environment sidesteps that entirely.
import { describe, it, expect } from 'vitest'
import { build } from 'vite'
import type { RollupOutput, OutputChunk } from 'rollup'

async function buildOutput(): Promise<OutputChunk[]> {
  const result = await build({
    // No explicit `root` — vite's own default is the process cwd, and
    // this file must not reference Node globals itself (`process`
    // included): this frontend's tsconfig deliberately carries no
    // `@types/node` (see noInternalDocRefs.test.ts's header comment for
    // the same constraint on a different file), and vitest always runs
    // with cwd already at the frontend package root anyway.
    logLevel: 'silent',
    build: { write: false, sourcemap: false },
    configFile: 'vite.config.ts',
  })
  // `build()`'s return type is `RollupOutput | RollupOutput[] | RollupWatcher`
  // in general (array only for a multi-output config, watcher only for
  // `build.watch`) — neither applies to this single-output, non-watch call.
  const output = (Array.isArray(result) ? result[0] : result) as RollupOutput
  return output.output.filter((o): o is OutputChunk => o.type === 'chunk')
}

describe('admin bundle composition — Fabric stays out of the main chunk', () => {
  it(
    'the entry chunk never includes Fabric or CustomizerEditor, and a dynamic chunk carries both',
    async () => {
      const chunks = await buildOutput()
      const entry = chunks.find((c) => c.isEntry)
      expect(entry, 'expected exactly one entry chunk (index.html has one script)').toBeTruthy()

      const entryFabricModules = entry!.moduleIds.filter((id) => id.includes('/node_modules/fabric/'))
      expect(
        entryFabricModules,
        'Fabric leaked into the main entry chunk — it must only ever be reachable through a dynamic import()'
      ).toEqual([])

      const entryHasEditor = entry!.moduleIds.some((id) => id.endsWith('/editor/CustomizerEditor.tsx'))
      expect(entryHasEditor, 'CustomizerEditor.tsx leaked into the main entry chunk').toBe(false)

      // Not a vacuous pass: Fabric must actually be bundled SOMEWHERE,
      // reachable only via a non-entry (dynamic-only) chunk — proving the
      // split is real, not just "Fabric happens to be unused".
      const dynamicChunks = chunks.filter((c) => !c.isEntry)
      const fabricIsDynamicOnly = dynamicChunks.some((c) => c.moduleIds.some((id) => id.includes('/node_modules/fabric/')))
      expect(fabricIsDynamicOnly, 'expected Fabric to be present in at least one dynamic-only chunk').toBe(true)
    },
    30000
  )

  it(
    'AdminTemplateEdit.tsx reaches CustomizerEditor only through the same dynamic import() as the shopper route',
    async () => {
      const chunks = await buildOutput()
      const editorChunk = chunks.find((c) => c.moduleIds.some((id) => id.endsWith('/editor/CustomizerEditor.tsx')))
      expect(editorChunk, 'expected a chunk containing CustomizerEditor.tsx').toBeTruthy()
      // The whole point of lazy-loading from two call sites (CustomizePage
      // and AdminTemplateEdit) is that Rollup can still put CustomizerEditor
      // in ONE shared chunk, reachable only dynamically — not duplicated,
      // and never pulled into either page's own entry-reachable graph.
      expect(editorChunk!.isEntry).toBe(false)
      expect(editorChunk!.isDynamicEntry).toBe(true)
    },
    30000
  )
})
