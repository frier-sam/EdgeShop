import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { showToast } from '../Toast'

// RFC-4180 compliant CSV parser
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuote = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (inQuote) {
      if (ch === '"' && next === '"') { field += '"'; i++ }
      else if (ch === '"') inQuote = false
      else field += ch
    } else {
      if (ch === '"') inQuote = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++
        row.push(field); field = ''
        if (row.some(f => f !== '')) rows.push(row)
        row = []
      } else field += ch
    }
  }
  if (field || row.length) { row.push(field); if (row.some(f => f !== '')) rows.push(row) }
  return rows
}

type Platform = 'shopify' | 'woocommerce' | 'generic'

function detectPlatform(headers: string[]): Platform {
  const h = headers.map(x => x.toLowerCase())
  if (h.includes('handle') && h.some(x => x.includes('variant price'))) return 'shopify'
  if (h.includes('regular price') || h.some(x => x === 'sale price')) return 'woocommerce'
  return 'generic'
}

interface ImportedProduct {
  name: string
  description: string
  price: number
  compare_price: number | null
  image_url: string
  stock_count: number
  categoryPath: string[]
  tags: string
  status: 'active' | 'draft'
  seo_title: string
  seo_description: string
  variants: Array<{
    name: string
    options_json: string  // JSON string e.g. '{"Size":"M"}'
    price: number
    stock_count: number
    sku: string
  }>
}

function parseShopify(headers: string[], rows: string[][]): ImportedProduct[] {
  const col = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase())

  // Group rows by Handle
  const groups = new Map<string, string[][]>()
  for (const row of rows) {
    const handle = row[col('Handle')] ?? ''
    if (!handle) continue
    if (!groups.has(handle)) groups.set(handle, [])
    groups.get(handle)!.push(row)
  }

  const products: ImportedProduct[] = []
  for (const [, groupRows] of groups) {
    const first = groupRows[0]
    const get = (name: string) => (first[col(name)] ?? '').trim()

    const name = get('Title')
    if (!name) continue

    // Strip HTML from description
    const rawDesc = get('Body (HTML)')
    const description = rawDesc.replace(/<[^>]+>/g, '').trim()

    const status = get('Status').toLowerCase() === 'draft' ? 'draft' : 'active'

    // Build variants from all rows
    const variants: ImportedProduct['variants'] = []
    for (const vRow of groupRows) {
      const vGet = (name: string) => (vRow[col(name)] ?? '').trim()
      const vPrice = parseFloat(vGet('Variant Price'))
      if (isNaN(vPrice)) continue

      // Build options object from Option1..Option3 columns
      const opts: Record<string, string> = {}
      for (const n of ['1', '2', '3']) {
        const optName = vGet(`Option${n} Name`)
        const optVal = vGet(`Option${n} Value`)
        if (optName && optVal && optName.toLowerCase() !== 'title') {
          opts[optName] = optVal
        }
      }

      variants.push({
        name: Object.values(opts).join(' / ') || name,
        options_json: JSON.stringify(opts),
        price: vPrice,
        stock_count: parseInt(vGet('Variant Inventory Qty'), 10) || 0,
        sku: vGet('Variant SKU'),
      })
    }

    const basePrice = variants[0]?.price ?? 0
    const compareRaw = parseFloat(get('Variant Compare At Price') || (first[col('Variant Compare At Price')] ?? ''))

    products.push({
      name,
      description,
      price: basePrice,
      compare_price: isNaN(compareRaw) ? null : compareRaw,
      image_url: get('Image Src'),
      stock_count: variants.reduce((s, v) => s + v.stock_count, 0),
      categoryPath: (() => {
        const c = get('Product Category') || get('Type')
        return c ? [c] : []
      })(),
      tags: get('Tags'),
      status,
      seo_title: get('SEO Title'),
      seo_description: get('SEO Description'),
      variants: variants.length > 1 ? variants : [], // only save variants if there are multiple
    })
  }
  return products
}

function parseWooCommerce(headers: string[], rows: string[][]): ImportedProduct[] {
  const col = (name: string) => headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase())
  const products: ImportedProduct[] = []

  for (const row of rows) {
    const get = (name: string) => (row[col(name)] ?? '').trim()
    const name = get('name')
    if (!name) continue
    // Skip variation rows (they're children of variable products)
    const type = get('type').toLowerCase()
    if (type === 'variation') continue

    const regularPrice = parseFloat(get('regular price'))
    const salePrice = parseFloat(get('sale price'))
    const price = !isNaN(salePrice) && salePrice > 0 ? salePrice : regularPrice
    if (isNaN(price)) continue

    const rawDesc = get('description') || get('short description')
    const description = rawDesc.replace(/<[^>]+>/g, '').trim()

    // Images: WooCommerce puts comma-separated image URLs
    const imageRaw = get('images')
    const image_url = imageRaw.split(',')[0].trim()

    // Categories: pipe-separated list; take first entry, split on " > " for hierarchy
    const catRaw = get('categories')
    const firstCat = catRaw.split('|')[0].trim()
    const categoryPath = firstCat ? firstCat.split(' > ').map(s => s.trim()).filter(Boolean) : []

    products.push({
      name,
      description,
      price,
      compare_price: (!isNaN(salePrice) && salePrice > 0 && !isNaN(regularPrice)) ? regularPrice : null,
      image_url,
      stock_count: parseInt(get('stock'), 10) || 0,
      categoryPath,
      tags: get('tags').replace(/[|]/g, ','),
      status: get('published') === '1' ? 'active' : 'draft',
      seo_title: '',
      seo_description: '',
      variants: [],
    })
  }
  return products
}

function parseGeneric(headers: string[], rows: string[][]): ImportedProduct[] {
  // Build a best-guess column map
  function findCol(...names: string[]): number {
    for (const name of names) {
      const idx = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
      if (idx >= 0) return idx
    }
    return -1
  }

  const nameCol = findCol('name', 'title', 'product name', 'product title')
  const priceCol = findCol('price', 'regular price', 'sale price', 'cost')
  const descCol = findCol('description', 'body', 'details')
  const imageCol = findCol('image', 'image url', 'image src', 'photo')
  const stockCol = findCol('stock', 'quantity', 'qty', 'inventory')
  const categoryCol = findCol('category', 'type', 'product type')
  const tagsCol = findCol('tags')

  const products: ImportedProduct[] = []
  for (const row of rows) {
    const name = (nameCol >= 0 ? row[nameCol] : '').trim()
    if (!name) continue
    const price = parseFloat(priceCol >= 0 ? row[priceCol] : '0')
    if (isNaN(price)) continue

    const rawDesc = descCol >= 0 ? row[descCol] : ''
    const description = rawDesc.replace(/<[^>]+>/g, '').trim()

    products.push({
      name,
      description,
      price,
      compare_price: null,
      image_url: imageCol >= 0 ? row[imageCol].trim() : '',
      stock_count: stockCol >= 0 ? (parseInt(row[stockCol], 10) || 0) : 0,
      categoryPath: (() => {
        const c = categoryCol >= 0 ? row[categoryCol].trim() : ''
        return c ? c.split(' > ').map(s => s.trim()).filter(Boolean) : []
      })(),
      tags: tagsCol >= 0 ? row[tagsCol].trim() : '',
      status: 'active',
      seo_title: '',
      seo_description: '',
      variants: [],
    })
  }
  return products
}

interface CollectionCache {
  id: number
  slug: string
}

async function resolveCategory(
  path: string[],
  existingCollections: Array<{ id: number; name: string; slug: string; parent_id: number | null }>,
  cache: Map<string, CollectionCache>
): Promise<number | null> {
  if (!path.length) return null
  let parentId: number | null = null
  let parentSlug = ''

  for (const segment of path) {
    const cacheKey: string = `${parentId ?? 'root'}:${segment.toLowerCase()}`
    if (cache.has(cacheKey)) {
      const cached: CollectionCache = cache.get(cacheKey)!
      parentId = cached.id
      parentSlug = cached.slug
      continue
    }
    // Check existing collections (pre-import snapshot) and the in-session cache (tracks newly created collections)
    const existing = existingCollections.find(
      c => c.name.toLowerCase() === segment.toLowerCase() && c.parent_id === parentId
    )
    if (existing) {
      cache.set(cacheKey, { id: existing.id, slug: existing.slug })
      parentId = existing.id
      parentSlug = existing.slug
      continue
    }
    // Create the collection
    const segSlug = segment.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const slug = parentSlug ? `${parentSlug}-${segSlug}` : segSlug
    const res = await fetch('/api/admin/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: segment, slug, parent_id: parentId }),
    })
    if (res.ok) {
      const { id } = await res.json() as { id: number }
      cache.set(cacheKey, { id, slug })
      parentId = id
      parentSlug = slug
    } else {
      // Slug conflict — try with timestamp suffix
      const slug2 = `${slug}-${Date.now()}`
      const res2 = await fetch('/api/admin/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: segment, slug: slug2, parent_id: parentId }),
      })
      if (!res2.ok) return parentId  // Best effort: use last successfully resolved level
      const { id } = await res2.json() as { id: number }
      cache.set(cacheKey, { id, slug: slug2 })
      parentId = id
      parentSlug = slug2
    }
  }
  return parentId
}

async function importProducts(
  products: ImportedProduct[],
  onProgress: (done: number, errors: number) => void
): Promise<{ imported: number; failed: number }> {
  let imported = 0
  let failed = 0

  // Pre-fetch all existing collections for category resolution
  const collRes = await fetch('/api/admin/collections')
  const { collections: existingCollections = [] } = collRes.ok
    ? await collRes.json() as { collections: Array<{ id: number; name: string; slug: string; parent_id: number | null }> }
    : { collections: [] }
  const collectionCache = new Map<string, CollectionCache>()

  for (const p of products) {
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: p.name,
          description: p.description,
          price: p.price,
          compare_price: p.compare_price,
          image_url: p.image_url,
          stock_count: p.stock_count,
          tags: p.tags,
          status: p.status,
          seo_title: p.seo_title,
          seo_description: p.seo_description,
          product_type: 'physical',
        }),
      })
      if (!res.ok) throw new Error('API error')
      const { id } = await res.json() as { id: number }

      // Assign to collection hierarchy
      if (p.categoryPath.length > 0) {
        const collectionId = await resolveCategory(p.categoryPath, existingCollections, collectionCache)
        if (collectionId !== null) {
          await fetch(`/api/admin/products/${id}/collections`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collection_ids: [collectionId] }),
          })
        }
      }

      // Import variants
      if (p.variants.length > 0) {
        for (const v of p.variants) {
          await fetch(`/api/admin/products/${id}/variants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(v),
          })
        }
      }

      imported++
    } catch {
      failed++
    }
    onProgress(imported + failed, failed)
  }

  return { imported, failed }
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'done'

export default function AdminImport() {
  const [step, setStep] = useState<ImportStep>('upload')
  const [platform, setPlatform] = useState<Platform>('generic')
  const [products, setProducts] = useState<ImportedProduct[]>([])
  const [progress, setProgress] = useState({ done: 0, errors: 0, total: 0 })
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null)
  const [fileName, setFileName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      if (rows.length < 2) {
        showToast('CSV appears to be empty or invalid', 'error')
        return
      }
      const headers = rows[0]
      const dataRows = rows.slice(1)
      const detected = detectPlatform(headers)
      setPlatform(detected)
      let parsed: ImportedProduct[] = []
      if (detected === 'shopify') parsed = parseShopify(headers, dataRows)
      else if (detected === 'woocommerce') parsed = parseWooCommerce(headers, dataRows)
      else parsed = parseGeneric(headers, dataRows)
      setProducts(parsed)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  async function startImport() {
    setProgress({ done: 0, errors: 0, total: products.length })
    setStep('importing')
    try {
      const res = await importProducts(products, (done, errors) => {
        setProgress({ done, errors, total: products.length })
      })
      setResult(res)
      setStep('done')
      if (res.failed === 0) showToast(`Imported ${res.imported} products`, 'success')
      else showToast(`${res.imported} imported, ${res.failed} failed`, 'error')
    } catch {
      setStep('upload')
      showToast('Import failed unexpectedly. Please try again.', 'error')
    }
  }

  const platformLabel: Record<Platform, string> = {
    shopify: 'Shopify',
    woocommerce: 'WooCommerce',
    generic: 'Generic CSV',
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Import Products</h1>
        <Link to="/admin/products" className="text-sm text-gray-500 hover:text-gray-800">← Back to Products</Link>
      </div>

      {/* Supported platforms info */}
      {step === 'upload' && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-medium text-gray-800 mb-3">Supported formats</h2>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { name: 'Shopify', hint: 'Products › Export from Shopify admin' },
                { name: 'WooCommerce', hint: 'Products › Export from WP admin' },
                { name: 'Generic CSV', hint: 'Any CSV with name + price columns' },
              ].map(p => (
                <div key={p.name} className="border border-gray-100 rounded-lg p-3 text-center">
                  <p className="text-sm font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{p.hint}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400">Format is auto-detected from the column headers.</p>
          </div>

          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
          >
            <p className="text-gray-500 text-sm mb-2">Drop your CSV file here or click to browse</p>
            <p className="text-xs text-gray-400">Exported from Shopify, WooCommerce, or any CSV</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>
        </div>
      )}

      {/* Preview */}
      {step === 'preview' && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-medium text-gray-800">Ready to import</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {fileName} — detected as <span className="font-medium text-gray-700">{platformLabel[platform]}</span>
                </p>
              </div>
              <span className="text-2xl font-bold text-gray-900">{products.length}</span>
            </div>
            <div className="text-xs text-gray-400 mb-4">{products.length} product{products.length !== 1 ? 's' : ''} found</div>

            {/* Preview table — first 6 */}
            {products.length > 0 && (
              <div className="border border-gray-100 rounded-lg overflow-hidden mb-4">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Name</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Price</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Stock</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium hidden sm:table-cell">Category</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Variants</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.slice(0, 6).map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-800 font-medium truncate max-w-[160px]">{p.name}</td>
                        <td className="px-3 py-2 text-gray-600">&#8377;{p.price.toFixed(2)}</td>
                        <td className="px-3 py-2 text-gray-600">{p.stock_count}</td>
                        <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">{p.categoryPath.join(' > ') || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{p.variants.length || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {products.length > 6 && (
                  <p className="text-xs text-gray-400 px-3 py-2 border-t border-gray-100">
                    + {products.length - 6} more products not shown
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep('upload'); setProducts([]) }}
                className="px-4 py-2 border border-gray-300 text-sm rounded text-gray-600 hover:bg-gray-50"
              >
                Choose different file
              </button>
              <button
                onClick={startImport}
                disabled={products.length === 0}
                className="flex-1 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
              >
                Import {products.length} product{products.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Importing progress */}
      {step === 'importing' && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm font-medium text-gray-800 mb-4">Importing products…</p>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
            <div
              className="bg-gray-900 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {progress.done} of {progress.total} done
            {progress.errors > 0 && <span className="text-red-500 ml-2">({progress.errors} errors)</span>}
          </p>
        </div>
      )}

      {/* Done */}
      {step === 'done' && result && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">
            {result.failed === 0 ? '✓' : '⚠'}
          </div>
          <p className="text-lg font-semibold text-gray-900 mb-1">
            {result.failed === 0 ? 'Import complete' : 'Import finished with errors'}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {result.imported} product{result.imported !== 1 ? 's' : ''} imported
            {result.failed > 0 && `, ${result.failed} failed`}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setStep('upload'); setProducts([]); setResult(null) }}
              className="px-4 py-2 border border-gray-300 text-sm rounded text-gray-600 hover:bg-gray-50"
            >
              Import another file
            </button>
            <Link
              to="/admin/products"
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
            >
              View products
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
