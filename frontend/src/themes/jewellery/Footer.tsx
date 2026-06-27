import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { FooterProps } from '../types'

export default function Footer({ storeName, footerData = {} }: FooterProps) {
  const { tagline, columns = [], socials, copyright } = footerData
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const hasColumns = columns.length > 0
  const hasSocials = socials && (socials.instagram || socials.facebook || socials.whatsapp)

  return (
    <footer className="border-t border-stone-200 mt-16" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Newsletter */}
        <div className="text-center mb-10">
          <h3
            className="text-xl font-semibold mb-2"
            style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-bg)' }}
          >
            Stay in the know
          </h3>
          <p className="text-xs tracking-wider mb-5" style={{ color: 'var(--color-accent)' }}>
            New arrivals, exclusive offers, stories from our craftspeople
          </p>
          {subscribed ? (
            <p className="text-sm" style={{ color: 'var(--color-accent)' }}>Thank you for subscribing! ✨</p>
          ) : (
            <form
              onSubmit={e => { e.preventDefault(); if (email.trim()) setSubscribed(true) }}
              className="flex flex-col sm:flex-row items-center justify-center gap-2 max-w-sm mx-auto"
            >
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="flex-1 w-full px-4 py-2 text-sm rounded-full focus:outline-none bg-transparent"
                style={{ border: '1px solid', borderColor: 'color-mix(in srgb, var(--color-bg) 40%, transparent)', color: 'var(--color-bg)' }}
              />
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold tracking-wider uppercase rounded-full transition-opacity hover:opacity-80 whitespace-nowrap"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}
              >
                Subscribe
              </button>
            </form>
          )}
        </div>
        <div className="w-full h-px mb-10" style={{ backgroundColor: 'var(--color-accent)', opacity: 0.2 }} />

        {/* Top: brand + columns */}
        <div className={`grid gap-10 mb-10 ${hasColumns ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`}>
          {/* Brand column */}
          <div>
            <p
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-bg)' }}
              className="text-lg tracking-widest uppercase font-semibold mb-2"
            >
              {storeName}
            </p>
            <p className="text-xs tracking-wider" style={{ color: 'var(--color-accent)' }}>
              {tagline || 'Crafted with care'}
            </p>
          </div>
          {/* Link columns */}
          {columns.map((col, i) => (
            <div key={i}>
              <p
                className="text-xs tracking-widest uppercase font-semibold mb-4"
                style={{ color: 'var(--color-bg)', opacity: 0.6 }}
              >
                {col.title}
              </p>
              <ul className="space-y-2">
                {col.links.map((link, j) => (
                  <li key={j}>
                    {link.href.startsWith('http') ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs tracking-wider transition-opacity hover:opacity-70"
                        style={{ color: 'var(--color-bg)' }}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-xs tracking-wider transition-opacity hover:opacity-70"
                        style={{ color: 'var(--color-bg)' }}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="w-full h-px mb-6" style={{ backgroundColor: 'var(--color-accent)', opacity: 0.3 }} />

        {/* Bottom: socials + copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {hasSocials && (
            <div className="flex items-center gap-4">
              {socials?.instagram && (
                <a href={socials.instagram} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs tracking-wider transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-accent)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><circle cx="12" cy="12" r="5" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                  Instagram
                </a>
              )}
              {socials?.facebook && (
                <a href={socials.facebook} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs tracking-wider transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-accent)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                  </svg>
                  Facebook
                </a>
              )}
              {socials?.whatsapp && (
                <a href={socials.whatsapp} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs tracking-wider transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-accent)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  WhatsApp
                </a>
              )}
            </div>
          )}
          <p className="text-xs" style={{ color: 'var(--color-bg)', opacity: 0.4 }}>
            {copyright || `© ${new Date().getFullYear()} ${storeName}`}
          </p>
        </div>
      </div>
    </footer>
  )
}
