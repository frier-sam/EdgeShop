import { describe, it, expect } from 'vitest'
import {
  isOrphanDesignExpired,
  selectOrphanDesignIdsFromRows,
  DEFAULT_DESIGN_RETENTION_DAYS,
  type OrphanDesignCandidate,
} from './gc'

// A fixed "now" so every test is deterministic regardless of when it runs.
const NOW = new Date('2026-08-25T12:00:00Z')
const NOW_MS = NOW.getTime()
const DAY_MS = 24 * 60 * 60 * 1000

function sqliteTimestamp(date: Date): string {
  // Mirrors D1's CURRENT_TIMESTAMP format: 'YYYY-MM-DD HH:MM:SS', no
  // timezone suffix, always UTC.
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function candidate(overrides: Partial<OrphanDesignCandidate>): OrphanDesignCandidate {
  return { id: 'dsn_test', order_id: null, created_at: sqliteTimestamp(NOW), ...overrides }
}

describe('isOrphanDesignExpired', () => {
  it('never expires a design linked to an order, no matter how old', () => {
    const row = candidate({
      order_id: 'ORD-123',
      created_at: sqliteTimestamp(new Date(NOW_MS - 365 * DAY_MS)),
    })
    expect(isOrphanDesignExpired(row, NOW_MS, DEFAULT_DESIGN_RETENTION_DAYS)).toBe(false)
  })

  it('does not expire an orphan design created today', () => {
    const row = candidate({ order_id: null, created_at: sqliteTimestamp(NOW) })
    expect(isOrphanDesignExpired(row, NOW_MS, DEFAULT_DESIGN_RETENTION_DAYS)).toBe(false)
  })

  it('does not expire an orphan design exactly at the retention boundary', () => {
    const row = candidate({ created_at: sqliteTimestamp(new Date(NOW_MS - 30 * DAY_MS)) })
    // Strictly older-than, not older-than-or-equal — exactly 30 days is not yet expired.
    expect(isOrphanDesignExpired(row, NOW_MS, 30)).toBe(false)
  })

  it('expires an orphan design one millisecond past the retention boundary', () => {
    const row = candidate({ created_at: sqliteTimestamp(new Date(NOW_MS - 30 * DAY_MS - 1000)) })
    expect(isOrphanDesignExpired(row, NOW_MS, 30)).toBe(true)
  })

  it('expires a 90-day-old orphan design under the default 30-day retention', () => {
    const row = candidate({ created_at: sqliteTimestamp(new Date(NOW_MS - 90 * DAY_MS)) })
    expect(isOrphanDesignExpired(row, NOW_MS, DEFAULT_DESIGN_RETENTION_DAYS)).toBe(true)
  })

  it('respects a custom (non-default) retention window from settings', () => {
    const row = candidate({ created_at: sqliteTimestamp(new Date(NOW_MS - 10 * DAY_MS)) })
    expect(isOrphanDesignExpired(row, NOW_MS, 7)).toBe(true) // 10 days old, 7-day retention
    expect(isOrphanDesignExpired(row, NOW_MS, 14)).toBe(false) // 10 days old, 14-day retention
  })

  it('never auto-deletes a row with an unparseable created_at rather than treating it as infinitely old', () => {
    const row = candidate({ created_at: 'not-a-real-timestamp' })
    expect(isOrphanDesignExpired(row, NOW_MS, DEFAULT_DESIGN_RETENTION_DAYS)).toBe(false)
  })

  it('parses the SQLite CURRENT_TIMESTAMP format as UTC, not local time', () => {
    // A design created 31 days ago in UTC must read as expired
    // regardless of the machine's local timezone offset.
    const createdUtc = new Date(NOW_MS - 31 * DAY_MS)
    const row = candidate({ created_at: sqliteTimestamp(createdUtc) })
    expect(isOrphanDesignExpired(row, NOW_MS, 30)).toBe(true)
  })
})

describe('selectOrphanDesignIdsFromRows', () => {
  it('selects only the expired, order-less rows out of a mixed batch', () => {
    const rows: OrphanDesignCandidate[] = [
      // expired orphan — should be selected
      candidate({ id: 'dsn_old_orphan', order_id: null, created_at: sqliteTimestamp(new Date(NOW_MS - 45 * DAY_MS)) }),
      // fresh orphan — not old enough yet
      candidate({ id: 'dsn_fresh_orphan', order_id: null, created_at: sqliteTimestamp(new Date(NOW_MS - 2 * DAY_MS)) }),
      // old but purchased — must NEVER be selected, this is the critical guard
      candidate({ id: 'dsn_old_but_paid', order_id: 'ORD-999', created_at: sqliteTimestamp(new Date(NOW_MS - 200 * DAY_MS)) }),
      // another expired orphan — should be selected
      candidate({ id: 'dsn_another_old_orphan', order_id: null, created_at: sqliteTimestamp(new Date(NOW_MS - 31 * DAY_MS)) }),
    ]

    const selected = selectOrphanDesignIdsFromRows(rows, NOW, DEFAULT_DESIGN_RETENTION_DAYS)

    expect(selected.sort()).toEqual(['dsn_another_old_orphan', 'dsn_old_orphan'])
    expect(selected).not.toContain('dsn_old_but_paid')
    expect(selected).not.toContain('dsn_fresh_orphan')
  })

  it('returns an empty array when nothing qualifies', () => {
    const rows: OrphanDesignCandidate[] = [
      candidate({ order_id: 'ORD-1' }),
      candidate({ order_id: null, created_at: sqliteTimestamp(NOW) }),
    ]
    expect(selectOrphanDesignIdsFromRows(rows, NOW, DEFAULT_DESIGN_RETENTION_DAYS)).toEqual([])
  })

  it('returns an empty array for an empty input', () => {
    expect(selectOrphanDesignIdsFromRows([], NOW, DEFAULT_DESIGN_RETENTION_DAYS)).toEqual([])
  })
})
