import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { HeroProps } from '../types'

const DIAMONDS = [
  { size: 7,  top: '14%', left: '7%',   delay: '0s',   duration: '4.4s', opacity: 0.30 },
  { size: 4,  top: '26%', left: '87%',  delay: '0.9s', duration: '5.2s', opacity: 0.22 },
  { size: 9,  top: '63%', left: '12%',  delay: '1.6s', duration: '3.9s', opacity: 0.18 },
  { size: 5,  top: '72%', left: '80%',  delay: '0.4s', duration: '4.8s', opacity: 0.28 },
  { size: 3,  top: '42%', left: '94%',  delay: '2.2s', duration: '3.6s', opacity: 0.18 },
  { size: 6,  top: '88%', left: '44%',  delay: '1.1s', duration: '4.2s', opacity: 0.14 },
  { size: 4,  top: '18%', left: '55%',  delay: '0.6s', duration: '5.0s', opacity: 0.12 },
]

export default function Hero({ storeName, tagline, heroImage }: HeroProps) {
  const words = tagline ? tagline.split(' ') : []
  const bgRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (bgRef.current && sectionRef.current) {
            const rect = sectionRef.current.getBoundingClientRect()
            if (rect.bottom > 0) {
              bgRef.current.style.transform = `translateY(${window.scrollY * 0.22}px)`
            }
          }
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const totalWordDelay = 0.22 + words.length * 0.14

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[92vh] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <style>{`
        @keyframes diamond-pulse {
          0%   { transform: rotate(45deg) scale(1);     opacity: var(--d-op); }
          40%  { transform: rotate(45deg) scale(1.35) translateY(-14px); opacity: calc(var(--d-op) * 2.8); }
          70%  { transform: rotate(45deg) scale(0.9)  translateY(-7px);  opacity: calc(var(--d-op) * 1.6); }
          100% { transform: rotate(45deg) scale(1);     opacity: var(--d-op); }
        }
        @keyframes hero-word-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hero-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes scroll-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50%      { transform: translateY(8px); opacity: 1; }
        }
        @keyframes line-grow-r {
          from { transform: scaleX(0); transform-origin: right center; }
          to   { transform: scaleX(1); transform-origin: right center; }
        }
        @keyframes line-grow-l {
          from { transform: scaleX(0); transform-origin: left center; }
          to   { transform: scaleX(1); transform-origin: left center; }
        }
      `}</style>

      {/* Parallax background layer */}
      <div
        ref={bgRef}
        className="absolute inset-0 will-change-transform"
        aria-hidden="true"
      >
        {heroImage ? (
          <div
            className="absolute inset-[-25%] bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImage})`, opacity: 0.22 }}
          />
        ) : (
          /* Subtle diamond lattice pattern */
          <svg
            className="absolute inset-0 w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
            style={{ opacity: 0.035 }}
          >
            <defs>
              <pattern id="heroDiamondGrid" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
                <polygon
                  points="24,2 46,24 24,46 2,24"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="0.6"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#heroDiamondGrid)" />
          </svg>
        )}
      </div>

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background: 'linear-gradient(155deg, color-mix(in srgb, var(--color-accent) 9%, transparent) 0%, transparent 50%, color-mix(in srgb, var(--color-primary) 5%, transparent) 100%)',
        }}
      />

      {/* Floating diamond shapes */}
      {DIAMONDS.map((d, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: d.top,
            left: d.left,
            width: d.size,
            height: d.size,
            backgroundColor: 'var(--color-accent)',
            transform: 'rotate(45deg)',
            '--d-op': d.opacity,
            animation: `diamond-pulse ${d.duration} ${d.delay} ease-in-out infinite`,
            pointerEvents: 'none',
            zIndex: 1,
          } as React.CSSProperties}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        {/* Brand label */}
        <p
          className="text-[11px] tracking-[0.55em] uppercase mb-8 font-light"
          style={{
            color: 'var(--color-accent)',
            opacity: 0,
            animation: 'hero-fade 0.9s ease forwards',
          }}
        >
          {storeName}
        </p>

        {/* Headline */}
        <h2
          style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
          className="text-5xl sm:text-7xl font-semibold mb-8 leading-[1.06]"
        >
          {words.map((word, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                opacity: 0,
                animation: 'hero-word-up 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                animationDelay: `${0.22 + i * 0.14}s`,
                marginRight: i < words.length - 1 ? '0.28em' : 0,
              }}
            >
              {word}
            </span>
          ))}
        </h2>

        {/* Ornament — diamond flanked by growing lines */}
        <div
          className="flex items-center justify-center gap-4 mb-10"
          style={{
            opacity: 0,
            animation: `hero-fade 0.7s ease forwards`,
            animationDelay: `${totalWordDelay + 0.1}s`,
          }}
        >
          <div
            className="h-px w-20 origin-right"
            style={{
              backgroundColor: 'var(--color-accent)',
              opacity: 0.55,
              animation: `line-grow-r 0.8s ease forwards`,
              animationDelay: `${totalWordDelay + 0.25}s`,
              transform: 'scaleX(0)',
              transformOrigin: 'right center',
            }}
          />
          <span
            className="w-2 h-2 rotate-45 shrink-0"
            style={{ backgroundColor: 'var(--color-accent)' }}
          />
          <div
            className="h-px w-20"
            style={{
              backgroundColor: 'var(--color-accent)',
              opacity: 0.55,
              animation: `line-grow-l 0.8s ease forwards`,
              animationDelay: `${totalWordDelay + 0.25}s`,
              transform: 'scaleX(0)',
              transformOrigin: 'left center',
            }}
          />
        </div>

        {/* CTAs */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
          style={{
            opacity: 0,
            animation: 'hero-fade 0.7s ease forwards',
            animationDelay: `${totalWordDelay + 0.45}s`,
          }}
        >
          <Link
            to="/search"
            className="inline-flex items-center gap-2.5 px-8 py-3.5 text-xs tracking-[0.25em] uppercase transition-all duration-300 hover:opacity-80 hover:gap-4"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-bg)',
            }}
          >
            Shop Collection
            <svg
              width="13"
              height="13"
              viewBox="0 0 13 13"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="1" y1="6.5" x2="11" y2="6.5" />
              <polyline points="7.5 2.5 11 6.5 7.5 10.5" />
            </svg>
          </Link>
          <Link
            to="/search?q="
            className="inline-flex items-center px-8 py-3.5 text-xs tracking-[0.25em] uppercase border transition-all duration-300 hover:opacity-70"
            style={{
              borderColor: 'color-mix(in srgb, var(--color-primary) 40%, transparent)',
              color: 'var(--color-primary)',
              backgroundColor: 'transparent',
            }}
          >
            View All Pieces
          </Link>
        </div>

        {/* Trust badges */}
        <div
          className="flex flex-wrap items-center justify-center gap-3 mt-7"
          style={{
            opacity: 0,
            animation: 'hero-fade 0.7s ease forwards',
            animationDelay: `${totalWordDelay + 0.65}s`,
          }}
        >
          {['Free Shipping', 'Certified Quality', 'Easy Returns'].map((label) => (
            <span
              key={label}
              className="px-3 py-1 text-[10px] tracking-[0.18em] uppercase font-medium rounded-full border"
              style={{
                color: 'var(--color-accent)',
                borderColor: 'color-mix(in srgb, var(--color-accent) 35%, transparent)',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        aria-hidden="true"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        style={{
          color: 'var(--color-accent)',
          opacity: 0,
          animation: 'hero-fade 0.6s ease forwards',
          animationDelay: `${totalWordDelay + 0.9}s`,
        }}
      >
        <span className="text-[9px] tracking-[0.38em] uppercase font-light">Scroll</span>
        <svg
          width="16"
          height="10"
          viewBox="0 0 16 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: 'scroll-bounce 1.8s ease-in-out infinite' }}
        >
          <polyline points="1 1 8 9 15 1" />
        </svg>
      </div>
    </section>
  )
}
