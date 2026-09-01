// Ambient module declaration for Vite/Vitest's built-in `?raw` raw-text
// import suffix (any file, any extension — no plugin needed). Used only
// by migrate.test.ts to read migrations/schema.sql's literal contents for
// the drift check against schemaSql.generated.ts, without pulling
// `@types/node` (and its global Node ambient types) into a Workers
// project that deliberately restricts `tsconfig.json`'s `types` to just
// `@cloudflare/workers-types`. Wrangler's own esbuild bundler never sees
// this import — it's only reachable from a test file, never from
// src/index.ts's real dependency graph.
declare module '*.sql?raw' {
  const content: string
  export default content
}
