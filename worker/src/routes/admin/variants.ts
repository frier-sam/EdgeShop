import { Hono } from 'hono'
import type { Env } from '../../index'
import type { ProductVariant } from '../../types'

const variants = new Hono<{ Bindings: Env }>()

// List all variants for a product
variants.get('/', async (c) => {
  const productId = Number(c.req.param('productId'))
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC'
  ).bind(productId).all<ProductVariant>()
  return c.json({ variants: results })
})

// Create a variant
variants.post('/', async (c) => {
  const productId = Number(c.req.param('productId'))
  const body = await c.req.json<{
    name: string; options_json?: string; price: number
    stock_count?: number; image_url?: string; sku?: string
  }>()
  const result = await c.env.DB.prepare(`
    INSERT INTO product_variants (product_id, name, options_json, price, stock_count, image_url, sku)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    productId,
    body.name,
    body.options_json ?? '{}',
    body.price,
    body.stock_count ?? 0,
    body.image_url ?? '',
    body.sku ?? ''
  ).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

// Update a variant
variants.put('/:variantId', async (c) => {
  const variantId = Number(c.req.param('variantId'))
  const body = await c.req.json<Partial<ProductVariant>>()
  const allowed = ['name', 'options_json', 'price', 'stock_count', 'image_url', 'sku']
  const entries = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!entries.length) return c.json({ error: 'Nothing to update' }, 400)
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE product_variants SET ${fields} WHERE id = ?`)
    .bind(...entries.map(([, v]) => v), variantId).run()
  return c.json({ ok: true })
})

// Delete a variant
variants.delete('/:variantId', async (c) => {
  const variantId = Number(c.req.param('variantId'))
  await c.env.DB.prepare('DELETE FROM product_variants WHERE id = ?').bind(variantId).run()
  return c.json({ ok: true })
})

export default variants
