import type { D1Database } from '@cloudflare/workers-types'

interface Migration {
  name: string
  sql: string
}

// Add future migrations here. The worker auto-applies any that aren't
// recorded in the _migrations table. Never remove or reorder entries.
const MIGRATIONS: Migration[] = [
  // Example — uncomment and fill in when you need a new migration:
  // {
  //   name: '0012_example.sql',
  //   sql: `ALTER TABLE products ADD COLUMN new_field TEXT DEFAULT '';`,
  // },
]

export async function runMigrations(db: D1Database): Promise<void> {
  // Ensure tracking table exists (safe to run on every cold start)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  if (MIGRATIONS.length === 0) return

  const { results } = await db
    .prepare('SELECT name FROM _migrations')
    .all<{ name: string }>()
  const applied = new Set(results.map((r) => r.name))

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue
    await db.exec(migration.sql)
    await db
      .prepare('INSERT INTO _migrations (name) VALUES (?)')
      .bind(migration.name)
      .run()
    console.log(`[migrate] applied ${migration.name}`)
  }
}
