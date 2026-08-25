import { lazy, Suspense } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchDesign } from '../editor/designApi'
import type { ProductDetail } from '../lib/types'

// POD.md §6.1 — Fabric (~90KB gz) must stay out of the main bundle. Both
// the editor component itself AND its `import('fabric')` (see
// editor/fabric/loadFabric.ts) are dynamic, so this route's JS — and
// Fabric specifically — only ever downloads when a shopper opens
// /customize/:productId.
const CustomizerEditor = lazy(() => import('../editor/CustomizerEditor'))

function FullScreenLoader() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-paper">
      <p className="text-sm text-ink-soft">Loading the design editor…</p>
    </div>
  )
}

/**
 * `/customize/:productId` — POD.md §3.3 / §10 Phase 6-7. Fetches the
 * product, guards that it's actually customizable, and hands off to the
 * lazy-loaded editor. Redirects back to the product page for anything
 * that isn't customizable (bad URL, back-side-only product edited before
 * a mockup existed, etc.) rather than rendering a broken editor.
 *
 * `?design=<id>` (POD.md §7.3 — the cart drawer's "Edit design" link, or a
 * future "My Designs" re-edit) also loads that design via
 * `GET /api/designs/:id` and hands it to the editor to rehydrate both
 * sides before the shopper sees anything. `?size=` still works alongside
 * it, since size lives on the cart line / order, not on the design row.
 */
export default function CustomizePage() {
  const { productId } = useParams<{ productId: string }>()
  const [searchParams] = useSearchParams()
  const size = searchParams.get('size')
  const designId = searchParams.get('design')

  const {
    data: product,
    isLoading,
    error,
  } = useQuery<ProductDetail>({
    queryKey: ['product', productId],
    queryFn: () =>
      fetch(`/api/products/${productId}`).then((r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      }),
    enabled: !!productId,
  })

  const {
    data: design,
    isLoading: designLoading,
    isError: designError,
  } = useQuery({
    queryKey: ['design', designId],
    queryFn: () => fetchDesign(designId!),
    enabled: !!designId,
    retry: false,
  })

  if (isLoading || (designId && designLoading)) return <FullScreenLoader />
  if (error || !product) return <Navigate to="/shop" replace />

  const hasCustomizableSide = (product.sides ?? []).some((s) => !!s.customizable)
  if (!product.is_customizable || !hasCustomizableSide) {
    return <Navigate to={`/product/${product.id}`} replace />
  }

  // A design that failed to load, or belongs to a different product
  // (stale/garbage link), is silently ignored — the shopper still gets a
  // usable blank editor rather than a dead end.
  const usableDesign = design && !designError && design.product_id === product.id ? design : null

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <CustomizerEditor product={product} initialSize={size} initialDesign={usableDesign} />
    </Suspense>
  )
}
