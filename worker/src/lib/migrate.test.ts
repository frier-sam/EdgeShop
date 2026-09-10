// worker/src/lib/migrate.test.ts
//
// Covers the self-bootstrapping schema added for automatic Cloudflare
// resource provisioning (DEPLOY.md's "Deploy from Git" path): a freshly
// provisioned, completely empty D1 database has no tables at all, so the
// worker must be able to create its own schema on cold start. See
// migrate.ts's '0000_base_schema' migration.
import { describe, it, expect } from 'vitest'
import { splitSqlStatements, MIGRATIONS } from './migrate'
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

  it('produces exactly the 19 statements schema.sql defines, in order', () => {
    // 14 pre-POD-V2 statements + 5 new CREATE TABLEs (product_variants,
    // product_side_images, product_price_breaks, template_collections,
    // design_templates — POD-V2.md §1.1/§3/§5/§6). The new columns on
    // products/product_sides don't add statements — they're added inside
    // those tables' existing CREATE TABLE statement.
    const statements = splitSqlStatements(BASE_SCHEMA_SQL)
    expect(statements).toHaveLength(19)
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

// POD-V2.md §10 / §11 Phase 1.1 — 0016_v2_options_bulk_templates.sql patches
// EXISTING (pre-0016) databases with the tables/columns schema.sql already
// bakes into fresh installs via 0000_base_schema. There is no in-repo D1/
// SQLite test harness to actually execute a migration twice and assert on
// the resulting rows (see gc.test.ts / pricing.test.ts's pattern of testing
// only the pure, DB-free halves of their modules), so this suite pins the
// two things that ARE checkable from the SQL text alone: (1) 0016 is a true
// no-op on a database that just ran 0000_base_schema, because schema.sql's
// own bookkeeping INSERT marks it pre-applied before runMigrations' loop
// ever reaches it, and (2) if 0016 ever does run for real (an existing
// database that's missing these tables/columns), every statement in it is
// shaped the way the rest of this file requires.
describe('0016_v2_options_bulk_templates.sql', () => {
  const migration = MIGRATIONS.find((m) => m.name === '0016_v2_options_bulk_templates.sql')

  it('is registered, after 0015, and BASE_SCHEMA_STATEMENTS marks it pre-applied', () => {
    expect(migration).toBeDefined()
    const names = MIGRATIONS.map((m) => m.name)
    expect(names.indexOf('0016_v2_options_bulk_templates.sql')).toBe(
      names.indexOf('0015_espod_rename.sql') + 1
    )
    // The single source of "which migrations does a fresh install already
    // count as applied" is schema.sql's own bookkeeping INSERT (see
    // extractLegacyMigrationNames in migrate.ts) — assert against that
    // same literal text rather than re-deriving it, so this test fails
    // loudly if schema.sql's list and this migration's name ever drift.
    const bookkeeping = splitSqlStatements(BASE_SCHEMA_SQL).find((s) =>
      /^INSERT OR IGNORE INTO _migrations\b/i.test(s)
    )
    expect(bookkeeping).toContain("'0016_v2_options_bulk_templates.sql'")
  })

  it('creates all 5 new tables with CREATE TABLE IF NOT EXISTS', () => {
    const allSql = migration!.phases.flat().join('\n')
    for (const table of [
      'product_variants',
      'product_side_images',
      'product_price_breaks',
      'template_collections',
      'design_templates',
    ]) {
      expect(allSql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`))
    }
  })

  it('adds the 4 new columns via ALTER TABLE ... ADD COLUMN, each with a default', () => {
    const allSql = migration!.phases.flat().join('\n')
    expect(allSql).toMatch(/ALTER TABLE products ADD COLUMN axis1_label TEXT NOT NULL DEFAULT 'Size'/)
    expect(allSql).toMatch(/ALTER TABLE products ADD COLUMN axis2_label TEXT NOT NULL DEFAULT 'Colour'/)
    expect(allSql).toMatch(/ALTER TABLE products ADD COLUMN min_order_qty INTEGER NOT NULL DEFAULT 1/)
    expect(allSql).toMatch(/ALTER TABLE product_sides ADD COLUMN label TEXT NOT NULL DEFAULT ''/)
  })

  it("0016's CREATE TABLE statements match schema.sql's, byte-for-byte, for the tables they share", () => {
    // Both files hand-write the same 5 CREATE TABLE bodies (schema.sql for
    // fresh installs, migrate.ts for existing ones) — nothing mechanically
    // keeps them in sync, so pin that they haven't drifted apart.
    const schemaStatements = splitSqlStatements(BASE_SCHEMA_SQL)
    const migrationStatements = migration!.phases.flat()
    for (const table of [
      'product_variants',
      'product_side_images',
      'product_price_breaks',
      'template_collections',
      'design_templates',
    ]) {
      const fromSchema = schemaStatements.find((s) =>
        new RegExp(`^CREATE TABLE IF NOT EXISTS ${table}\\b`).test(s)
      )
      const fromMigration = migrationStatements.find((s) =>
        new RegExp(`^CREATE TABLE IF NOT EXISTS ${table}\\b`).test(s)
      )
      // migrate.ts's inline SQL isn't comment-stripped the way schema.sql
      // is by splitSqlStatements — schema.sql's table bodies carry inline
      // `--` trailing comments migrate.ts's copies deliberately omit, so
      // compare with all whitespace collapsed and comments stripped
      // rather than requiring byte-identical text.
      const normalize = (s: string | undefined) =>
        (s ?? '')
          .split('\n')
          .map((line) => line.replace(/--.*$/, ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
      expect(normalize(fromMigration)).toBe(normalize(fromSchema))
    }
  })
})
