// worker/src/routes/admin/templates.test.ts
//
// POD-V2.md §6.1/§11 Phase 4.2 — validation for the two admin "create"
// endpoints, POST /template-collections and POST /templates. Same split as
// ../admin/products.test.ts: the DB-touching route handlers stay thin, the
// actual validation rules live in plain, D1-free functions exercised
// directly here — there is no D1/SQLite test harness in this repo (see
// products.test.ts's header).
import { describe, it, expect } from 'vitest'
import { validateCollectionCreatePayload, validateTemplateCreatePayload } from './templates'

const VALID_DESIGN_JSON = JSON.stringify({ version: '6.0', objects: [{ type: 'text', text: 'Hi' }] })

describe('validateCollectionCreatePayload', () => {
  it('accepts a normal payload, trimming name/category and defaulting status/sort_order', () => {
    const result = validateCollectionCreatePayload({ name: '  Birthday  ', category: '  Party  ' })
    expect(result).toEqual({
      clean: { name: 'Birthday', category: 'Party', status: 'active', sort_order: 0 },
    })
  })

  it('accepts an explicit "" category — the documented wildcard, not a missing value', () => {
    const result = validateCollectionCreatePayload({ name: 'Corporate', category: '' })
    expect(result).toEqual({ clean: { name: 'Corporate', category: '', status: 'active', sort_order: 0 } })
  })

  it('defaults category to "" when omitted entirely', () => {
    const result = validateCollectionCreatePayload({ name: 'Minimal' })
    expect('error' in result).toBe(false)
    expect((result as { clean: { category: string } }).clean.category).toBe('')
  })

  it('rejects an empty or whitespace-only name', () => {
    expect(validateCollectionCreatePayload({ name: '' })).toEqual({ error: 'name is required' })
    expect(validateCollectionCreatePayload({ name: '   ' })).toEqual({ error: 'name is required' })
    expect(validateCollectionCreatePayload({})).toEqual({ error: 'name is required' })
  })

  it('accepts an explicit valid status', () => {
    const result = validateCollectionCreatePayload({ name: 'Draft Collection', status: 'draft' })
    expect('error' in result).toBe(false)
    expect((result as { clean: { status: string } }).clean.status).toBe('draft')
  })

  it('silently falls back to "active" for an invalid status, rather than erroring (mirrors POST /products)', () => {
    const result = validateCollectionCreatePayload({ name: 'Whatever', status: 'not-a-status' })
    expect('error' in result).toBe(false)
    expect((result as { clean: { status: string } }).clean.status).toBe('active')
  })

  it('respects an explicit integer sort_order and ignores a non-integer one', () => {
    expect((validateCollectionCreatePayload({ name: 'X', sort_order: 5 }) as { clean: { sort_order: number } }).clean.sort_order).toBe(5)
    expect((validateCollectionCreatePayload({ name: 'X', sort_order: 1.5 }) as { clean: { sort_order: number } }).clean.sort_order).toBe(0)
    expect((validateCollectionCreatePayload({ name: 'X', sort_order: 'nope' }) as { clean: { sort_order: number } }).clean.sort_order).toBe(0)
  })
})

describe('validateTemplateCreatePayload', () => {
  const base = { collection_id: 1, name: 'Balloons', design_json: VALID_DESIGN_JSON, canvas_w: 300, canvas_h: 200 }

  it('accepts a well-formed payload, defaulting tags/status/sort_order', () => {
    const result = validateTemplateCreatePayload(base)
    expect(result).toEqual({
      clean: {
        collection_id: 1,
        name: 'Balloons',
        design_json: VALID_DESIGN_JSON,
        canvas_w: 300,
        canvas_h: 200,
        tags: '',
        status: 'active',
        sort_order: 0,
      },
    })
  })

  it('trims tags and accepts an explicit status/sort_order', () => {
    const result = validateTemplateCreatePayload({ ...base, tags: '  fun, party  ', status: 'draft', sort_order: 3 })
    expect('error' in result).toBe(false)
    const clean = (result as { clean: { tags: string; status: string; sort_order: number } }).clean
    expect(clean.tags).toBe('fun, party')
    expect(clean.status).toBe('draft')
    expect(clean.sort_order).toBe(3)
  })

  it('rejects a missing/non-integer/zero/negative collection_id', () => {
    for (const bad of [undefined, 'x', 1.5, 0, -1, null]) {
      expect(validateTemplateCreatePayload({ ...base, collection_id: bad })).toEqual({ error: 'collection_id is required' })
    }
  })

  it('rejects an empty or whitespace-only name', () => {
    expect(validateTemplateCreatePayload({ ...base, name: '' })).toEqual({ error: 'name is required' })
    expect(validateTemplateCreatePayload({ ...base, name: '   ' })).toEqual({ error: 'name is required' })
  })

  it('rejects a missing design_json, surfacing validateDesignJsonPayload\'s own error', () => {
    const result = validateTemplateCreatePayload({ ...base, design_json: undefined })
    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toMatch(/design_json is required/)
  })

  it('rejects malformed (non-JSON) design_json', () => {
    const result = validateTemplateCreatePayload({ ...base, design_json: 'not json at all' })
    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toMatch(/not valid JSON/)
  })

  it('rejects design_json that parses to a non-object (array/string/number)', () => {
    expect('error' in validateTemplateCreatePayload({ ...base, design_json: '[1,2,3]' })).toBe(true)
    expect('error' in validateTemplateCreatePayload({ ...base, design_json: '"just a string"' })).toBe(true)
  })

  it('rejects an oversized design_json', () => {
    const huge = JSON.stringify({ blob: 'x'.repeat(600 * 1024) })
    const result = validateTemplateCreatePayload({ ...base, design_json: huge })
    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toMatch(/too large/)
  })

  it('rejects a zero/negative/non-finite canvas_w or canvas_h', () => {
    for (const bad of [0, -10, NaN, Infinity, 'x', undefined]) {
      expect(validateTemplateCreatePayload({ ...base, canvas_w: bad })).toEqual({ error: 'canvas_w must be a positive number' })
    }
    for (const bad of [0, -10, NaN, Infinity, 'x', undefined]) {
      expect(validateTemplateCreatePayload({ ...base, canvas_h: bad })).toEqual({ error: 'canvas_h must be a positive number' })
    }
  })

  it('silently falls back to "active" for an invalid status', () => {
    const result = validateTemplateCreatePayload({ ...base, status: 'nonsense' })
    expect('error' in result).toBe(false)
    expect((result as { clean: { status: string } }).clean.status).toBe('active')
  })
})
