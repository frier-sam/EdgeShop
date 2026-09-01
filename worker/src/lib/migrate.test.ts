// worker/src/lib/migrate.test.ts
//
// Covers the self-bootstrapping schema added for automatic Cloudflare
// resource provisioning (DEPLOY.md's "Deploy from Git" path): a freshly
// provisioned, completely empty D1 database has no tables at all, so the
// worker must be able to create its own schema on cold start. See
// migrate.ts's '0000_base_schema' migration.
import { describe, it, expect } from 'vitest'
import { splitSqlStatements } from './migrate'
import { BASE_SCHEMA_SQL } from './schemaSql.generated'
// Vite/Vitest's built-in raw-text import (see sql-raw.d.ts) — an
// independent read of schema.sql's literal contents, so this test doesn't
// just compare the generated constant against itself.
import rawSchemaSql from '../../migrations/schema.sql?raw'

describe('schemaSql.generated.ts stays in sync with migrations/schema.sql', () => {
  it('BASE_SCHEMA_SQL is byte-for-byte identical to the committed schema.sql', () => {
    // Guards against someone editing schema.sql without re-running
    // `npm run generate:schema`. If this fails, run that command (from
    // worker/ or the repo root) and commit the regenerated file.
    expect(BASE_SCHEMA_SQL).toBe(rawSchemaSql)
  })
})

describe('splitSqlStatements', () => {
  it('strips full-line comments and splits on statement-terminating semicolons', () => {
    const sql = `-- a leading comment
CREATE TABLE IF NOT EXISTS foo (id INTEGER);
-- another comment
CREATE TABLE IF NOT EXISTS bar (id INTEGER);
`
    expect(splitSqlStatements(sql)).toEqual([
      'CREATE TABLE IF NOT EXISTS foo (id INTEGER)',
      'CREATE TABLE IF NOT EXISTS bar (id INTEGER)',
    ])
  })

  it('drops empty statements produced by trailing/blank content', () => {
    expect(splitSqlStatements('SELECT 1;\n\n\n')).toEqual(['SELECT 1'])
    expect(splitSqlStatements('   ;  ;  SELECT 1;')).toEqual(['SELECT 1'])
  })

  it('schema.sql contains no semicolons inside string literals (the naive-split assumption)', () => {
    // A `;` inside a quoted string (e.g. a settings default value) would
    // be mis-split by splitSqlStatements' naive `.split(';')`. Assert none
    // of schema.sql's single-quoted SQL string literals contain one.
    //
    // Comment lines are stripped first, exactly like splitSqlStatements
    // itself does, before scanning for quote pairs — otherwise a plain
    // English apostrophe in a `--` comment (e.g. "the worker's own...")
    // desyncs the naive `'[^']*'` quote-pairing for everything after it,
    // which is a real false positive this test tripped over while being
    // written, not a hypothetical.
    const codeOnly = BASE_SCHEMA_SQL.split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
    const stringLiterals = codeOnly.match(/'[^']*'/g) ?? []
    expect(stringLiterals.length).toBeGreaterThan(0) // sanity: the scan itself is finding literals
    for (const literal of stringLiterals) {
      expect(literal).not.toContain(';')
    }
  })

  it('produces exactly the 14 statements schema.sql defines, in order', () => {
    const statements = splitSqlStatements(BASE_SCHEMA_SQL)
    expect(statements).toHaveLength(14)
    expect(statements[0]).toMatch(/^CREATE TABLE IF NOT EXISTS products\b/)
    expect(statements.at(-1)).toMatch(/^INSERT OR IGNORE INTO settings\b/)
    // Every statement must be non-empty after trimming (already implied by
    // the filter in splitSqlStatements, asserted directly here too).
    for (const s of statements) expect(s.length).toBeGreaterThan(0)
  })

  it('every statement is idempotent-safe (CREATE ... IF NOT EXISTS or INSERT OR IGNORE)', () => {
    // The whole point of 0000_base_schema is that it's safe to run against
    // an already-migrated database. Guard that property at the statement
    // level so a future schema.sql edit can't silently reintroduce a
    // non-idempotent statement (a bare CREATE TABLE / bare INSERT) into
    // the base migration.
    const statements = splitSqlStatements(BASE_SCHEMA_SQL)
    for (const s of statements) {
      const isIdempotent =
        /^CREATE (TABLE|INDEX) IF NOT EXISTS\b/i.test(s) || /^INSERT OR IGNORE\b/i.test(s)
      expect.soft(isIdempotent, `statement not idempotent-safe: ${s.slice(0, 60)}...`).toBe(true)
    }
  })
})
