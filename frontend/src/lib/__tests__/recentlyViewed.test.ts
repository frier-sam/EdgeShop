// POD-UI4.md §4.3/H7 — cap, dedup, ordering, and the two failure modes a
// real browser can hand this module: corrupt stored content, and storage
// that throws on access at all (not just on write).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { recordView, readRecentlyViewed } from '../recentlyViewed'

const STORAGE_KEY = 'espod:recently-viewed'

beforeEach(() => {
  localStorage.clear()
})

describe('recentlyViewed', () => {
  it('reads an empty list when nothing has been recorded', () => {
    expect(readRecentlyViewed()).toEqual([])
  })

  it('records a view and reads it back, most-recent-first', () => {
    recordView(1)
    recordView(2)
    recordView(3)
    expect(readRecentlyViewed()).toEqual([3, 2, 1])
  })

  it('dedupes: re-viewing an id moves it to the front instead of adding a second entry', () => {
    recordView(1)
    recordView(2)
    recordView(3)
    recordView(1)
    expect(readRecentlyViewed()).toEqual([1, 3, 2])
  })

  it('caps at 12 entries, dropping the oldest', () => {
    for (let id = 1; id <= 13; id++) recordView(id)
    const ids = readRecentlyViewed()
    expect(ids).toHaveLength(12)
    expect(ids[0]).toBe(13)
    expect(ids).not.toContain(1) // the oldest view fell off the cap
  })

  it('ignores non-positive or non-integer ids', () => {
    recordView(0)
    recordView(-5)
    recordView(1.5)
    expect(readRecentlyViewed()).toEqual([])
  })

  it('degrades to an empty list when storage holds corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    expect(readRecentlyViewed()).toEqual([])
  })

  it('degrades to an empty list when storage holds a non-array value', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 1 }))
    expect(readRecentlyViewed()).toEqual([])
  })

  it('filters out garbage entries within an otherwise valid array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 'two', null, 3.5, -1, 0, 4]))
    expect(readRecentlyViewed()).toEqual([1, 4])
  })

  it('reading never throws even when localStorage.getItem itself throws (e.g. private browsing)', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('access denied')
    })
    expect(() => readRecentlyViewed()).not.toThrow()
    expect(readRecentlyViewed()).toEqual([])
    spy.mockRestore()
  })

  it('recording never throws even when localStorage.setItem itself throws (e.g. quota exceeded)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded')
    })
    expect(() => recordView(1)).not.toThrow()
    spy.mockRestore()
  })
})
