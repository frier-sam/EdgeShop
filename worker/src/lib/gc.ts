// worker/src/lib/gc.ts
//
// POD.md §9.1 / §11 ("R2 filling with abandoned designs") — daily orphan
// design garbage collection. A `designs` row is created at the START of
// add-to-cart (POST /api/designs, routes/designs.ts) but only gets
// `order_id` set if the shopper actually completes checkout
// (checkout.ts's linkDesignsToOrder). Every abandoned customize session
// therefore leaves behind one D1 row plus up to two ~150KB R2 preview
// objects (designs/<id>/front.webp, designs/<id>/back.webp) forever,
// unless something reaps them.
//
// This module is deliberately split into a pure SELECTION predicate
// (`isOrphanDesignExpired` / `selectOrphanDesignIdsFromRows`), which has
// zero dependency on D1 or R2 and is fully unit-testable, and the actual
// D1/R2-touching orchestration (`runOrphanDesignGC`), which the
// `scheduled()` handler in index.ts calls. Keeping the "which rows
// qualify" rule pure and separately testable is what let this ship with
// a real unit test instead of only being exercisable via a live cron —
// see gc.test.ts.

export const DEFAULT_DESIGN_RETENTION_DAYS = 30

export interface OrphanDesignCandidate {
  id: string
  order_id: string | null
  created_at: string
}

/**
 * D1's `DATETIME DEFAULT CURRENT_TIMESTAMP` (and the `datetime('now', …)`
 * SQL function used in the actual query below) both produce SQLite's
 * `'YYYY-MM-DD HH:MM:SS'` format — UTC, no timezone suffix. Handing that
 * string straight to `new Date(...)` makes JS parse it as LOCAL time, not
 * UTC, which would make "older than N days" silently depend on the
 * machine's timezone. Force UTC by treating it as an ISO string with a
 * trailing `Z`.
 */
function parseSqliteDatetimeUtcMs(value: string): number {
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const ms = new Date(iso).getTime()
  return ms
}

/**
 * The exact selection rule, expressed as a pure predicate so it can be
 * unit tested without a database: never touch a design that has been
 * linked to an order (`order_id IS NULL` is the whole point — a design
 * still referenced by a paid order must never be deleted), and only
 * reap ones whose `created_at` is strictly older than the retention
 * window.
 */
export function isOrphanDesignExpired(
  row: OrphanDesignCandidate,
  nowMs: number,
  retentionDays: number
): boolean {
  if (row.order_id !== null) return false
  const createdMs = parseSqliteDatetimeUtcMs(row.created_at)
  if (!Number.isFinite(createdMs)) return false // corrupt/unparseable row: never auto-delete
  const ageMs = nowMs - createdMs
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000
  return ageMs > retentionMs
}

/** Applies `isOrphanDesignExpired` across a row set and returns the ids that qualify. */
export function selectOrphanDesignIdsFromRows(
  rows: OrphanDesignCandidate[],
  now: Date,
  retentionDays: number
): string[] {
  const nowMs = now.getTime()
  return rows.filter((r) => isOrphanDesignExpired(r, nowMs, retentionDays)).map((r) => r.id)
}

export async function getDesignRetentionDays(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = 'design_retention_days'")
    .first<{ value: string }>()
  const n = Number(row?.value)
  // Same floor pattern as settings.ts's NUMERIC_KEYS: a 0-or-negative
  // retention would GC designs the same day they're created, plausibly
  // deleting a customer's in-progress "My Designs" re-edit.
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_DESIGN_RETENTION_DAYS
}

export interface DesignGCResult {
  retentionDays: number
  deletedDesigns: number
  deletedPreviewObjects: number
}

// ── Upload GC: deliberately NOT implemented here ───────────────────────
//
// POD.md §9.1 also asks to delete `uploads/<uuid>.<ext>` art objects that
// no surviving design references — but only when NO remaining design's
// `design_json` references them. An asset can legitimately be referenced
// by more than one design (a customer duplicating a design via "Edit a
// copy" — see the Phase 7 decisions log entry on `/customize/:id?design=`
// always creating a NEW `designs` row — keeps the same uploads/ URL
// inside the new row's design_json).
//
// A reliable reference scan needs to answer, for every uploads/ key:
// "does ANY row currently in `designs` — including ones already linked
// to a PAID order, which must never be touched — contain this URL
// anywhere inside its design_json blob?" `design_json` is Fabric's own
// object graph; the URL can appear nested inside an object's `src`
// property at arbitrary depth, inside either side's object array, and
// D1 has no index into JSON blob contents. The only way to answer it at
// the D1 level is a `design_json LIKE '%' || url || '%'` scan of the
// ENTIRE designs table (not just orphans) for every single upload key —
// real CPU cost on every GC run, in a Worker whose whole design
// philosophy is staying inside the free-tier CPU budget (POD.md's
// "Zero-CPU image logic" founding constraint) — and if that scan is
// wrong in even one case, the failure mode is silent, permanent
// deletion of either a customer's in-progress artwork or, far worse, a
// PAID ORDER'S print-file source image. That is exactly the asymmetric
// risk this task calls out: deleting art still referenced by a paid
// order is worse than leaving an orphan file forever.
//
// So this GC ships design+preview cleanup only (provably safe: it never
// touches a design with a non-null order_id, full stop) and defers
// upload GC until there is a cheap, provably-correct reference index —
// e.g. a `design_assets(design_id, upload_key)` join table populated at
// design-create time, so "is this key referenced" becomes an indexed
// lookup instead of a full-table string scan. In the meantime,
// `uploads/` growth is bounded by the `max_art_upload_mb` cap and the
// per-IP rate limit already enforced in routes/designs.ts — it costs R2
// storage, but it is not the specific "abandoned cart fills R2 with
// multi-megabyte previews" risk POD.md §11 describes, which is the
// preview WebPs this GC does reap.
export const UPLOAD_GC_DEFERRED_REASON =
  'Upload GC is deferred: no cheap, provably-correct way yet exists to confirm an uploads/ key is unreferenced by ANY design (including paid ones) without a full-table design_json scan. See the comment above runOrphanDesignGC in worker/src/lib/gc.ts.'

/**
 * Runs the actual GC against D1 + R2: selects orphan design ids with the
 * exact same rule as `isOrphanDesignExpired` (expressed in SQL via
 * `datetime('now', '-N days')` — the same pattern already proven against
 * D1 in routes/admin/dashboard.ts's "orders today" query), deletes each
 * one's R2 preview objects under `designs/<id>/`, then deletes the D1
 * rows themselves.
 */
export async function runOrphanDesignGC(db: D1Database, bucket: R2Bucket): Promise<DesignGCResult> {
  const retentionDays = await getDesignRetentionDays(db)

  const { results } = await db
    .prepare(
      `SELECT id FROM designs
       WHERE order_id IS NULL
         AND created_at < datetime('now', '-' || ? || ' days')`
    )
    .bind(retentionDays)
    .all<{ id: string }>()

  const ids = results.map((r) => r.id)
  let deletedPreviewObjects = 0

  for (const id of ids) {
    // At most two objects per design (front.webp, back.webp) — well
    // under R2's default list page size, so no pagination needed.
    const listed = await bucket.list({ prefix: `designs/${id}/` })
    if (listed.objects.length > 0) {
      await bucket.delete(listed.objects.map((o) => o.key))
      deletedPreviewObjects += listed.objects.length
    }
  }

  if (ids.length > 0) {
    // Chunk the DELETE so a very large backlog doesn't exceed D1's
    // per-statement bound-variable limit.
    const CHUNK = 100
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      const placeholders = chunk.map(() => '?').join(',')
      await db
        .prepare(`DELETE FROM designs WHERE id IN (${placeholders})`)
        .bind(...chunk)
        .run()
    }
  }

  return { retentionDays, deletedDesigns: ids.length, deletedPreviewObjects }
}
