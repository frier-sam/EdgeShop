#!/usr/bin/env node
// Regenerates worker/src/lib/schemaSql.generated.ts from
// worker/migrations/schema.sql.
//
// schema.sql is the single source of truth for the base schema (it's what
// you'd paste into the D1 dashboard Console by hand). This script inlines
// its exact contents into a TS string constant so the worker can run that
// same SQL itself on cold start against an empty database — see
// worker/src/lib/migrate.ts's '0000_base_schema' migration.
//
// Run via `npm run generate:schema` (wired as a pre-hook ahead of
// dev/build/test in package.json) or manually after editing schema.sql.
// worker/src/lib/migrate.test.ts asserts the generated file stays
// byte-for-byte in sync with schema.sql, so a forgotten regeneration
// fails `vitest run` loudly instead of silently drifting.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(__dirname, '..', 'migrations', 'schema.sql')
const outPath = path.join(__dirname, '..', 'src', 'lib', 'schemaSql.generated.ts')

const sql = readFileSync(schemaPath, 'utf8')

// Escape only what a template literal needs escaped. This is a pure,
// lossless round-trip (verified by migrate.test.ts) — no whitespace or
// comment stripping happens here, that's splitSqlStatements()'s job at
// migration-run time.
const escaped = sql
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${')

const out = `// AUTO-GENERATED — do not edit by hand.
// Source: worker/migrations/schema.sql
// Regenerate: npm run generate:schema (from the worker/ directory, or the
// repo root) — this also runs automatically before dev/build/test.
// worker/src/lib/migrate.test.ts fails if this drifts from schema.sql.
/* eslint-disable */

export const BASE_SCHEMA_SQL = \`${escaped}\`
`

writeFileSync(outPath, out)
console.log(
  `[generate-schema-sql] wrote ${path.relative(process.cwd(), outPath)} (${sql.length} bytes from schema.sql)`
)
