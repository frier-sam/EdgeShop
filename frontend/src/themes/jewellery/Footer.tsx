import { Link } from 'react-router-dom'
import type { FooterProps } from '../types'

export default function Footer({ storeName, footerData = {} }: FooterProps) {
  const { tagline, columns = [], socials, copyright } = footerData
  const hasColumns = columns.length > 0
  const hasSocials = socials && (socials.instagram || socials.facebook || socials.whatsapp)

  return (
    <footer className="border-t border-stone-200 mt-16" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
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
                  className="text-xs tracking-wider transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-accent)' }}>
                  Instagram
                </a>
              )}
              {socials?.facebook && (
                <a href={socials.facebook} target="_blank" rel="noopener noreferrer"
                  className="text-xs tracking-wider transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-accent)' }}>
                  Facebook
                </a>
              )}
              {socials?.whatsapp && (
                <a href={socials.whatsapp} target="_blank" rel="noopener noreferrer"
                  className="text-xs tracking-wider transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-accent)' }}>
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
