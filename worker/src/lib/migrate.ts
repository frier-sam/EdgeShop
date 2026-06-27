import type { D1Database } from '@cloudflare/workers-types'

interface Migration {
  name: string
  sql: string
}

// Add future migrations here. The worker auto-applies any that aren't
// recorded in the _migrations table. Never remove or reorder entries.
const NAV_DEFAULT = JSON.stringify([
  { label: 'New Arrivals', href: '/shop', type: 'link' },
  { label: 'Rings', href: '/collections/rings', type: 'link' },
  { label: 'Necklaces', href: '/collections/necklaces', type: 'link' },
  { label: 'Earrings', href: '/collections/earrings', type: 'link' },
  { label: 'Blog', href: '/blog', type: 'link' },
  { label: 'Contact', href: '/contact', type: 'link' },
])

const FOOTER_DEFAULT = JSON.stringify({
  tagline: 'Crafted with love, worn with pride.',
  columns: [
    { title: 'Shop', links: [
      { label: 'All Jewellery', href: '/shop' },
      { label: 'Rings', href: '/collections/rings' },
      { label: 'Necklaces', href: '/collections/necklaces' },
      { label: 'Earrings', href: '/collections/earrings' },
      { label: 'Bracelets', href: '/collections/bracelets' },
    ]},
    { title: 'Help', links: [
      { label: 'Contact Us', href: '/contact' },
      { label: 'Shipping Info', href: '/pages/shipping' },
      { label: 'Returns', href: '/pages/returns' },
      { label: 'FAQ', href: '/pages/faq' },
    ]},
    { title: 'About', links: [
      { label: 'Our Story', href: '/pages/about' },
      { label: 'Blog', href: '/blog' },
    ]},
  ],
  socials: { instagram: '', facebook: '', whatsapp: '' },
})

const HOMEPAGE_DEFAULT = JSON.stringify({
  heroTagline: 'Discover pieces made to be treasured',
  uspEnabled: true,
  bannerEnabled: true,
  bannerTitle: 'The Gold Edit',
  bannerSubtitle: 'Timeless pieces for every occasion — curated with love.',
  bannerImage: '',
  bannerHref: '/shop',
  bannerCtaLabel: 'Explore the Collection',
  collectionsEnabled: true,
  collectionItems: [
    { label: 'Rings', href: '/collections/rings' },
    { label: 'Necklaces', href: '/collections/necklaces' },
    { label: 'Earrings', href: '/collections/earrings' },
    { label: 'Bracelets', href: '/collections/bracelets' },
    { label: 'Sets', href: '/collections/sets' },
  ],
  testimonialsEnabled: true,
  testimonialHeading: 'What Our Customers Say',
  testimonials: [
    { name: 'Priya S.', location: 'Mumbai', rating: 5, text: 'Absolutely beautiful craftsmanship. The necklace I ordered exceeded every expectation.' },
    { name: 'Meera R.', location: 'Bangalore', rating: 5, text: 'Fast shipping and the packaging was stunning. The ring fits perfectly.' },
    { name: 'Ananya K.', location: 'Delhi', rating: 5, text: 'The quality is unreal for the price. My go-to for gifting.' },
  ],
})

const MIGRATIONS: Migration[] = [
  {
    name: '0012_homepage_nav_defaults.sql',
    sql: `
      UPDATE settings SET value = '${NAV_DEFAULT.replace(/'/g, "''")}' WHERE key = 'navigation_json' AND value = '[]';
      UPDATE settings SET value = '${FOOTER_DEFAULT.replace(/'/g, "''")}' WHERE key = 'footer_json' AND value = '{}';
      INSERT OR IGNORE INTO settings (key, value) VALUES ('homepage_json', '${HOMEPAGE_DEFAULT.replace(/'/g, "''")}');
    `,
  },
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
