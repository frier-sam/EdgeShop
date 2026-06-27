import { useEffect } from 'react'
import { Link } from 'react-router-dom'

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

const steps = [
  {
    icon: '📦',
    title: 'Order Confirmed',
    description: 'Your order is being prepared',
    delay: '0.8s',
  },
  {
    icon: '🚚',
    title: 'Dispatched',
    description: "We'll send a tracking link to your email",
    delay: '1.0s',
  },
  {
    icon: '✓',
    title: 'Delivered',
    description: 'Enjoy your new piece!',
    delay: '1.2s',
  },
]

export default function OrderSuccessPage() {
  useEffect(() => setNoIndex(), [])

  return (
    <>
      <style>{`
        @keyframes draw-circle {
          from { stroke-dashoffset: 283; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes draw-check {
          from { stroke-dashoffset: 60; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes success-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes step-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .svg-circle {
          stroke-dasharray: 283;
          stroke-dashoffset: 283;
          animation: draw-circle 1s ease forwards;
        }
        .svg-check {
          stroke-dasharray: 60;
          stroke-dashoffset: 60;
          animation: draw-check 0.6s ease forwards;
          animation-delay: 0.9s;
        }
        .fade-up-heading {
          opacity: 0;
          animation: success-fade-up 0.6s ease forwards;
          animation-delay: 1.2s;
        }
        .fade-up-sub {
          opacity: 0;
          animation: success-fade-up 0.6s ease forwards;
          animation-delay: 1.4s;
        }
        .fade-up-steps {
          opacity: 0;
          animation: success-fade-up 0.6s ease forwards;
          animation-delay: 1.5s;
        }
        .fade-up-ctas {
          opacity: 0;
          animation: success-fade-up 0.6s ease forwards;
          animation-delay: 1.7s;
        }
        .step-item {
          opacity: 0;
          animation: step-fade-in 0.5s ease forwards;
        }
      `}</style>

      <div
        className="min-h-screen flex items-center justify-center px-4 py-16"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <div className="w-full max-w-2xl text-center">

          {/* Animated SVG checkmark */}
          <div className="flex items-center justify-center mb-8">
            <svg
              width="100"
              height="100"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="Order confirmed"
            >
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="var(--color-accent)"
                strokeWidth="3"
                strokeLinecap="round"
                className="svg-circle"
                fill="none"
              />
              <polyline
                points="28,52 44,67 72,36"
                stroke="var(--color-primary)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                className="svg-check"
              />
            </svg>
          </div>

          {/* Heading */}
          <h1
            className="text-4xl sm:text-5xl font-semibold mb-3 fade-up-heading"
            style={{
              fontFamily: "'Playfair Display', serif",
              color: 'var(--color-primary)',
            }}
          >
            Order Placed!
          </h1>

          {/* Subtext */}
          <p
            className="text-sm sm:text-base mb-12 fade-up-sub"
            style={{ color: 'var(--color-primary)', opacity: 0.55 }}
          >
            Thank you for your purchase. We'll send a confirmation to your email shortly.
          </p>

          {/* Steps timeline */}
          <div className="fade-up-steps mb-12">
            {/* Desktop: horizontal row */}
            <div className="hidden sm:flex items-start justify-center gap-0">
              {steps.map((step, i) => (
                <div key={step.title} className="flex items-start">
                  <div
                    className="flex flex-col items-center w-40 step-item"
                    style={{ animationDelay: step.delay }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-xl mb-3 border"
                      style={{
                        borderColor: 'var(--color-accent)',
                        backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
                      }}
                    >
                      {step.icon}
                    </div>
                    <p
                      className="text-sm font-semibold mb-1"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {step.title}
                    </p>
                    <p
                      className="text-xs leading-relaxed px-2"
                      style={{ color: 'var(--color-primary)', opacity: 0.55 }}
                    >
                      {step.description}
                    </p>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className="flex-1 mt-6 mx-1"
                      style={{
                        borderTop: '2px dotted',
                        borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)',
                        minWidth: '32px',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Mobile: vertical stack */}
            <div className="flex sm:hidden flex-col items-center gap-0">
              {steps.map((step, i) => (
                <div key={step.title} className="flex flex-col items-center">
                  <div
                    className="flex flex-col items-center text-center w-64 step-item"
                    style={{ animationDelay: step.delay }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-xl mb-2 border"
                      style={{
                        borderColor: 'var(--color-accent)',
                        backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
                      }}
                    >
                      {step.icon}
                    </div>
                    <p
                      className="text-sm font-semibold mb-0.5"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {step.title}
                    </p>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: 'var(--color-primary)', opacity: 0.55 }}
                    >
                      {step.description}
                    </p>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className="my-3"
                      style={{
                        borderLeft: '2px dotted',
                        borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)',
                        height: '28px',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 fade-up-ctas">
            <Link
              to="/"
              className="inline-block px-8 py-3 text-sm tracking-widest uppercase transition-opacity hover:opacity-80"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-bg)',
                fontFamily: "'Playfair Display', serif",
                letterSpacing: '0.12em',
              }}
            >
              Continue Shopping
            </Link>
            <Link
              to="/account/orders"
              className="inline-block px-8 py-3 text-sm tracking-widest uppercase transition-opacity hover:opacity-70"
              style={{
                border: '1.5px solid var(--color-accent)',
                color: 'var(--color-accent)',
                fontFamily: "'Playfair Display', serif",
                letterSpacing: '0.12em',
              }}
            >
              View My Orders
            </Link>
          </div>

        </div>
      </div>
    </>
  )
}
