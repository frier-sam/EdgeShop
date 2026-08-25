import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Button from '../components/Button'

function setNoIndex() {
  let el = document.querySelector('meta[name="robots"]')
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', 'robots')
    document.head.appendChild(el)
  }
  el.setAttribute('content', 'noindex, nofollow')
  return () => el!.setAttribute('content', '')
}

const STEPS = [
  { icon: '📦', title: 'Order Confirmed', description: 'Your order is being prepared' },
  { icon: '🖨️', title: 'Printed to order', description: "We'll send a tracking link to your email" },
  { icon: '✓', title: 'Delivered', description: 'Enjoy your new print!' },
]

interface OrderPreviewLine {
  key: string
  name: string
  size: string | null
  quantity: number
  preview_url: string | null
  design_id: string | null
}

interface OrderPreviewState {
  orderId?: string
  lines?: OrderPreviewLine[]
}

export default function OrderSuccessPage() {
  useEffect(() => setNoIndex(), [])

  // Passed from CheckoutPage right before the cart is cleared (POD-UI.md
  // §B7) — there's no dedicated "fetch this order" endpoint for a fresh
  // guest checkout, so the line snapshot travels through router state
  // instead of a refetch. Falls back to just the celebratory copy if the
  // page was reached directly (refresh, bookmarked link, etc.).
  const location = useLocation()
  const state = (location.state ?? {}) as OrderPreviewState
  const orderLines = state.lines ?? []
  const previewLines = orderLines.filter((l) => l.preview_url)

  return (
    <>
      <style>{`
        @keyframes draw-circle { from { stroke-dashoffset: 283; } to { stroke-dashoffset: 0; } }
        @keyframes draw-check  { from { stroke-dashoffset: 60; }  to { stroke-dashoffset: 0; } }
        @keyframes fade-up     { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .svg-circle { stroke-dasharray: 283; stroke-dashoffset: 283; animation: draw-circle 1s ease forwards; }
        .svg-check  { stroke-dasharray: 60; stroke-dashoffset: 60; animation: draw-check 0.6s ease forwards; animation-delay: 0.9s; }
        .fade-up-heading { opacity: 0; animation: fade-up 0.6s ease forwards; animation-delay: 1.2s; }
        .fade-up-sub      { opacity: 0; animation: fade-up 0.6s ease forwards; animation-delay: 1.4s; }
        .fade-up-previews { opacity: 0; animation: fade-up 0.6s ease forwards; animation-delay: 1.55s; }
        .fade-up-steps    { opacity: 0; animation: fade-up 0.6s ease forwards; animation-delay: 1.65s; }
        .fade-up-ctas     { opacity: 0; animation: fade-up 0.6s ease forwards; animation-delay: 1.8s; }
        @media (prefers-reduced-motion: reduce) {
          .svg-circle, .svg-check, .fade-up-heading, .fade-up-sub, .fade-up-previews, .fade-up-steps, .fade-up-ctas {
            animation-duration: 0.01ms !important;
            animation-delay: 0ms !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-16">
        <div className="w-full max-w-2xl text-center">
          <div className="mb-8 flex items-center justify-center">
            <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Order confirmed">
              <circle cx="50" cy="50" r="45" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" className="svg-circle" fill="none" />
              <polyline points="28,52 44,67 72,36" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" className="svg-check" />
            </svg>
          </div>

          <h1 className="fade-up-heading mb-3 font-display text-[2.5rem] font-bold text-ink sm:text-[3rem]">Order Placed!</h1>
          <p className="fade-up-sub mb-10 text-sm text-ink-soft sm:text-base">
            {state.orderId ? (
              <>
                Order <span className="font-medium text-ink">#{state.orderId}</span> is confirmed. We'll send a confirmation to your email shortly.
              </>
            ) : (
              "Thank you for your purchase. We'll send a confirmation to your email shortly."
            )}
          </p>

          {previewLines.length > 0 && (
            <div className="fade-up-previews mb-10">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Your designs</p>
              <div className="flex flex-wrap justify-center gap-3">
                {previewLines.map((line) => (
                  <div key={line.key} className="w-24 rounded-card border border-line bg-surface p-2 shadow-card sm:w-28">
                    <div className="aspect-square overflow-hidden rounded-btn bg-surface-2">
                      <img src={line.preview_url!} alt={line.name} className="h-full w-full object-cover" />
                    </div>
                    <p className="mt-1.5 truncate text-[11px] text-ink-soft">
                      {line.name}
                      {line.size ? ` (${line.size})` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="fade-up-steps mb-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.title} className="flex flex-col items-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-accent-soft text-xl">
                  {step.icon}
                </div>
                <p className="mb-1 text-sm font-semibold text-ink">{step.title}</p>
                <p className="max-w-[12rem] text-xs leading-relaxed text-ink-soft">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="fade-up-ctas flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button as={Link} to="/shop" variant="primary" size="lg">
              Continue Shopping
            </Button>
            <Button as={Link} to="/account/orders" variant="secondary" size="lg">
              View My Orders
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
