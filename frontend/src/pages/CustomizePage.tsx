import { lazy, Suspense } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
 * `/customize/:productId` — POD.md §3.3 / §10 Phase 6. Fetches the
 * product, guards that it's actually customizable, and hands off to the
 * lazy-loaded editor. Redirects back to the product page for anything
 * that isn't customizable (bad URL, back-side-only product edited before
 * a mockup existed, etc.) rather than rendering a broken editor.
 */
export default function CustomizePage() {
  const { productId } = useParams<{ productId: string }>()
  const [searchParams] = useSearchParams()
  const size = searchParams.get('size')

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

  if (isLoading) return <FullScreenLoader />
  if (error || !product) return <Navigate to="/shop" replace />

  const hasCustomizableSide = (product.sides ?? []).some((s) => !!s.customizable)
  if (!product.is_customizable || !hasCustomizableSide) {
    return <Navigate to={`/product/${product.id}`} replace />
  }

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <CustomizerEditor product={product} initialSize={size} />
    </Suspense>
  )
}
