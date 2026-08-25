import { useEffect } from 'react'
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

export default function OrderSuccessPage() {
  useEffect(() => setNoIndex(), [])

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
        .fade-up-steps    { opacity: 0; animation: fade-up 0.6s ease forwards; animation-delay: 1.5s; }
        .fade-up-ctas     { opacity: 0; animation: fade-up 0.6s ease forwards; animation-delay: 1.7s; }
      `}</style>

      <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-16">
        <div className="w-full max-w-2xl text-center">
          <div className="mb-8 flex items-center justify-center">
            <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Order confirmed">
              <circle cx="50" cy="50" r="45" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" className="svg-circle" fill="none" />
              <polyline points="28,52 44,67 72,36" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" className="svg-check" />
            </svg>
          </div>

          <h1 className="fade-up-heading mb-3 font-display text-4xl font-semibold text-ink sm:text-5xl">Order Placed!</h1>
          <p className="fade-up-sub mb-12 text-sm text-ink-soft sm:text-base">
            Thank you for your purchase. We'll send a confirmation to your email shortly.
          </p>

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
            <Button variant="accent" size="lg" to="/shop">
              Continue Shopping
            </Button>
            <Button variant="outline" size="lg" to="/account/orders">
              View My Orders
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
