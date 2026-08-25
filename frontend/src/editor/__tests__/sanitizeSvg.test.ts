import { describe, it, expect } from 'vitest'
import { sanitizeSvg } from '../sanitizeSvg'

describe('sanitizeSvg', () => {
  it('passes through a benign SVG unchanged in substance', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>`
    const result = sanitizeSvg(svg)
    expect(result.ok).toBe(true)
    expect(result.removed).toEqual([])
    expect(result.svg).toContain('<rect')
    expect(result.svg).toContain('fill="red"')
  })

  it('strips a <script> element entirely', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script><rect width="5" height="5"/></svg>`
    const result = sanitizeSvg(svg)
    expect(result.ok).toBe(true)
    expect(result.svg).not.toContain('<script')
    expect(result.svg).not.toContain('alert')
    expect(result.removed.some((r) => r.includes('<script>'))).toBe(true)
  })

  it('strips a <foreignObject> (which can smuggle arbitrary HTML, including <script>)', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>evil()</script></body></foreignObject></svg>`
    const result = sanitizeSvg(svg)
    expect(result.ok).toBe(true)
    expect(result.svg).not.toContain('foreignObject')
    expect(result.svg).not.toContain('evil')
  })

  it('strips on* event-handler attributes from any element', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)" onload="steal()" width="5" height="5"/></svg>`
    const result = sanitizeSvg(svg)
    expect(result.ok).toBe(true)
    expect(result.svg).not.toContain('onclick')
    expect(result.svg).not.toContain('onload')
    expect(result.svg).not.toContain('alert')
  })

  it('strips a javascript: URI hiding in an href', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="5" height="5"/></a></svg>`
    const result = sanitizeSvg(svg)
    expect(result.ok).toBe(true)
    expect(result.svg.toLowerCase()).not.toContain('javascript:')
  })

  it('strips an external (http) href but keeps a same-document fragment reference', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient id="g"/></defs><a xlink:href="http://evil.example/steal"><rect width="5" height="5"/></a><use xlink:href="#g"/></svg>`
    const result = sanitizeSvg(svg)
    expect(result.ok).toBe(true)
    expect(result.svg).not.toContain('evil.example')
    expect(result.svg).toContain('xlink:href="#g"')
  })

  it('keeps a data: URI href/src (legitimate embedded image data)', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="data:image/png;base64,AAAA" width="5" height="5"/></svg>`
    const result = sanitizeSvg(svg)
    expect(result.ok).toBe(true)
    expect(result.svg).toContain('data:image/png;base64,AAAA')
  })

  it('strips a DOCTYPE (XXE / entity-expansion vector)', () => {
    const svg = `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe "pwned">]><svg xmlns="http://www.w3.org/2000/svg"><rect width="5" height="5"/></svg>`
    const result = sanitizeSvg(svg)
    expect(result.ok).toBe(true)
    expect(result.removed).toContain('DOCTYPE')
  })

  it('strips an external @import / url() reference inside a <style> block but keeps inline rules', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(http://evil.example/x.css); rect { fill: blue; } .bg { background: url(https://evil.example/track.png); }</style><rect class="bg" width="5" height="5"/></svg>`
    const result = sanitizeSvg(svg)
    expect(result.ok).toBe(true)
    expect(result.svg).not.toContain('evil.example')
    expect(result.svg).toContain('fill: blue')
  })

  it('rejects markup with no <svg> root element', () => {
    const result = sanitizeSvg(`<div>not an svg</div>`)
    expect(result.ok).toBe(false)
    expect(result.svg).toBe('')
  })

  it('rejects unparseable garbage input', () => {
    const result = sanitizeSvg(`<svg><rect width="5" height="5"</svg`)
    expect(result.ok).toBe(false)
  })
})
