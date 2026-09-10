// POD-V2.md §6.4 / §11 Phase 4.3. Covers what's reachable without ever
// mounting the real (lazy, Fabric-backed) CustomizerEditor: the
// collection_id guard, the auth guard this route needs because it lives
// outside AdminLayout (see the header comment in AdminTemplateEdit.tsx),
// the reference-product picker filtering to customizable products only,
// and the name-required gate on "Start drawing". Actually reaching the
// draw step is deliberately out of scope here — that's Fabric/canvas
// territory the editor agent's own tests (previewMode.test.tsx etc.)
// already own; this file only has to prove this page hands off to it
// correctly, which adminBundleComposition.test.ts pins from the bundling
// side and firstCustomizableSide's unit tests pin from the logic side.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AdminTemplateEdit, { firstCustomizableSide } from '../AdminTemplateEdit'
import { useAdminAuthStore } from '../../../store/adminAuthStore'
import type { ProductDetail, ProductSide } from '../../../lib/types'

vi.mock('../../lib/adminFetch', () => ({ adminFetch: vi.fn() }))
import { adminFetch } from '../../lib/adminFetch'

const mockedAdminFetch = vi.mocked(adminFetch)

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response
}

function side(partial: Partial<ProductSide>): ProductSide {
  return {
    id: 1, product_id: 1, side: 'front', label: 'Front', image_url: '/img/mock.png', image_w: 1000, image_h: 1000,
    customizable: 1, print_x: 0.1, print_y: 0.1, print_w: 0.8, print_h: 0.4, print_width_in: 4,
    print_fee: 99, sort_order: 0, ...partial,
  }
}

function product(partial: Partial<ProductDetail>): ProductDetail {
  return {
    id: 1, name: 'Mock Mug', slug: 'mock-mug', description: '', base_price: 100, compare_price: null,
    category: 'Mugs', status: 'active', is_customizable: 1, stock_count: 0, seo_title: '', seo_description: '',
    sides: [side({})], sizes: [], axis1_label: 'Size', axis2_label: 'Colour', min_order_qty: 1,
    variants: [], price_breaks: [], highlights: '', ...partial,
  }
}

beforeEach(() => {
  useAdminAuthStore.setState({ adminToken: 'test-token', adminId: 1, adminName: 'Test', adminRole: 'staff', adminPermissions: {} })
})

afterEach(() => {
  vi.restoreAllMocks()
  useAdminAuthStore.setState({ adminToken: null, adminId: null, adminName: '', adminRole: '', adminPermissions: {} })
})

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/templates/new" element={<AdminTemplateEdit />} />
          <Route path="/admin/templates" element={<p>Templates list</p>} />
          <Route path="/admin/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('firstCustomizableSide', () => {
  it('picks the first side flagged customizable', () => {
    const p = product({ sides: [side({ side: 'front', customizable: 0 }), side({ id: 2, side: 'back', customizable: 1 })] })
    expect(firstCustomizableSide(p)?.side).toBe('back')
  })

  it('returns null when no side is customizable', () => {
    const p = product({ sides: [side({ customizable: 0 })] })
    expect(firstCustomizableSide(p)).toBeNull()
  })

  it('returns null for a product with no sides at all', () => {
    expect(firstCustomizableSide(product({ sides: [] }))).toBeNull()
  })
})

describe('AdminTemplateEdit — guards', () => {
  it('redirects to the templates list when collection_id is missing', async () => {
    renderAt('/admin/templates/new')
    expect(await screen.findByText('Templates list')).toBeInTheDocument()
  })

  it('redirects to the templates list when collection_id is not a positive integer', async () => {
    renderAt('/admin/templates/new?collection_id=not-a-number')
    expect(await screen.findByText('Templates list')).toBeInTheDocument()
  })

  it('redirects to admin login when there is no admin session', async () => {
    useAdminAuthStore.setState({ adminToken: null })
    renderAt('/admin/templates/new?collection_id=1')
    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })
})

describe('AdminTemplateEdit — reference product picker and confirm step', () => {
  beforeEach(() => {
    mockedAdminFetch.mockImplementation((url: string) => {
      if (url.startsWith('/api/admin/template-collections')) {
        return Promise.resolve(jsonResponse({ collections: [{ id: 1, name: 'Birthday', category: 'Mugs', status: 'active', sort_order: 0 }] }))
      }
      if (url.startsWith('/api/admin/products/')) {
        return Promise.resolve(jsonResponse(product({ id: 42, name: 'Ceramic Mug' })))
      }
      if (url.startsWith('/api/admin/products')) {
        return Promise.resolve(
          jsonResponse({
            products: [
              { id: 42, name: 'Ceramic Mug', category: 'Mugs', is_customizable: 1, has_print_area: 1, front_image: null },
              { id: 43, name: 'Plain Sticker', category: 'Stickers', is_customizable: 0, has_print_area: 0, front_image: null },
              // Customizable, but its print rect was never set up — offering
              // this would be a card that can only fail on click (POD-V2.md §6.4).
              { id: 44, name: 'Unconfigured Tote', category: 'Bags', is_customizable: 1, has_print_area: 0, front_image: null },
            ],
            pages: 1,
          })
        )
      }
      return Promise.resolve(jsonResponse({}, false))
    })
  })

  it('lists only products that can actually be drawn on — excluding both non-customizable ones and those with no print area set up', async () => {
    renderAt('/admin/templates/new?collection_id=1')
    expect(await screen.findByText('Ceramic Mug')).toBeInTheDocument()
    expect(screen.queryByText('Plain Sticker')).not.toBeInTheDocument()
    expect(screen.queryByText('Unconfigured Tote')).not.toBeInTheDocument()
  })

  it('picking a product advances to the confirm step and shows its print-area shape', async () => {
    const user = userEvent.setup()
    renderAt('/admin/templates/new?collection_id=1')
    await user.click(await screen.findByRole('button', { name: /use this product/i }))
    // "Ceramic Mug" legitimately appears twice on the confirm step (once
    // in the explanatory sentence, once in the recap card) — assert
    // presence via findAllByText rather than the single-match findByText.
    expect((await screen.findAllByText(/ceramic mug/i)).length).toBeGreaterThan(0)
    // side({ print_w: 0.8, print_h: 0.4, image_w: 1000, image_h: 1000 }) ->
    // physical print area 800 x 400 -> landscape, 2.00:1.
    expect(await screen.findByText(/print area shape: landscape, 2\.00:1/i)).toBeInTheDocument()
  })

  it('blocks "Start drawing" until a template name is entered', async () => {
    const user = userEvent.setup()
    renderAt('/admin/templates/new?collection_id=1')
    await user.click(await screen.findByRole('button', { name: /use this product/i }))
    await user.click(await screen.findByRole('button', { name: /start drawing/i }))
    expect(await screen.findByText(/give this template a name/i)).toBeInTheDocument()
  })
})
