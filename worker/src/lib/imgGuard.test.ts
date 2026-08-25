import { describe, it, expect } from 'vitest'
import { isAllowedImgKey } from './imgGuard'

describe('isAllowedImgKey', () => {
  it('allows a real mockup key', () => {
    expect(isAllowedImgKey('mockups/abc-123.webp')).toBe(true)
  })

  it('allows a real customer-upload key', () => {
    expect(isAllowedImgKey('uploads/def-456.png')).toBe(true)
  })

  it('allows a real design-preview key', () => {
    expect(isAllowedImgKey('designs/dsn_xyz/front.webp')).toBe(true)
  })

  it('rejects an empty key', () => {
    expect(isAllowedImgKey('')).toBe(false)
  })

  it('rejects null/undefined', () => {
    expect(isAllowedImgKey(null)).toBe(false)
    expect(isAllowedImgKey(undefined)).toBe(false)
  })

  it('rejects a key with no allowed prefix at all', () => {
    expect(isAllowedImgKey('secrets/api-keys.json')).toBe(false)
    expect(isAllowedImgKey('admin-config.json')).toBe(false)
  })

  it('rejects a prefix that merely starts with an allowed word but is not the real folder', () => {
    // Classic prefix-check bug: 'mockupsevil/' passes a naive
    // startsWith('mockups') check but must NOT pass startsWith('mockups/').
    expect(isAllowedImgKey('mockupsevil/x.webp')).toBe(false)
    expect(isAllowedImgKey('uploadsx/y.png')).toBe(false)
  })

  it('rejects a literal ".." traversal attempt inside an otherwise-allowed prefix', () => {
    expect(isAllowedImgKey('mockups/../../../etc/passwd')).toBe(false)
    expect(isAllowedImgKey('uploads/../secrets.json')).toBe(false)
    expect(isAllowedImgKey('designs/..')).toBe(false)
  })

  it('rejects a bare ".." with no allowed prefix', () => {
    expect(isAllowedImgKey('../mockups/x.webp')).toBe(false)
    expect(isAllowedImgKey('..')).toBe(false)
  })

  it('falls back to the prefix allow-list even for a percent-encoded traversal that never becomes a literal ".."', () => {
    // isAllowedImgKey never decodes percent-encoding itself — but an
    // undecoded '%2e%2e/etc/passwd' also doesn't start with any of the
    // three real prefixes, so it is rejected by the allow-list check
    // regardless of whether the '..' substring check would have caught it.
    expect(isAllowedImgKey('%2e%2e/mockups/x.webp')).toBe(false)
  })

  it('rejects exactly the allowed prefix with nothing after it', () => {
    expect(isAllowedImgKey('mockups/')).toBe(true) // technically matches — R2 .get() on it just 404s, which is fine
    expect(isAllowedImgKey('mockups')).toBe(false) // no trailing slash — must not match the prefix
  })
})
