import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { NavItem } from '../lib/storeConfig'
import { FOOTER_COLUMNS } from '../lib/storeConfig'

interface FooterProps {
  storeName: string
  /**
   * Kept for backward compatibility with existing callers (HomePage,
   * ShopPage, ProductPage all pass `FOOTER_LINKS` here) — folded into the
   * "Shop" column below rather than duplicated as a fifth column, since
   * `FOOTER_COLUMNS.Shop` already covers the same ground plus categories.
   */
  links?: NavItem[]
}

function PaymentBadge({ label }: { label: string }) {
  return (
    <span className="flex h-7 items-center rounded-[4px] border border-paper/15 bg-paper/5 px-2 text-[11px] font-semibold tracking-wide text-paper/70">
      {label}
    </span>
  )
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M15 3h-2a4 4 0 0 0-4 4v3H6v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3z" strokeLinejoin="round" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 2H22l-7.6 8.7L23.3 22H16.7l-5.2-6.8L5.5 22H2.3l8.1-9.3L1.5 2h6.8l4.7 6.2L18.9 2Zm-1.2 18.2h1.7L7.4 3.7H5.6l12.1 16.5Z" />
    </svg>
  )
}

const SOCIAL_LINKS = [
  { label: 'Instagram', href: '#', Icon: InstagramIcon },
  { label: 'Facebook', href: '#', Icon: FacebookIcon },
  { label: 'X (Twitter)', href: '#', Icon: XIcon },
]

const PAYMENT_METHODS = ['Visa', 'Mastercard', 'RuPay', 'UPI', 'Cash on Delivery']

/** One footer column of links — `href="#"` entries render as inert text (POD-UI2.md §3/E6 note) instead of a dead link. */
function FooterColumn({ title, links }: { title: string; links: NavItem[] }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-paper/50">{title}</h3>
      <ul className="flex flex-col gap-2.5">
        {links.map((link) =>
          link.href === '#' ? (
            <li key={link.label} title="Coming soon" className="text-sm text-paper/40">
              {link.label}
            </li>
          ) : (
            <li key={link.label}>
              <Link to={link.href} className="text-sm text-paper/70 transition-colors hover:text-paper">
                {link.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}

type NewsletterState = 'idle' | 'submitted'

/**
 * There is no newsletter/subscriber endpoint anywhere in `worker/**` — a
 * form that quietly "succeeded" here would be lying about having stored
 * the email. Submitting instead shows an honest inline acknowledgement
 * and never issues a network request (POD-UI2.md §3/E4).
 */
function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<NewsletterState>('idle')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setState('submitted')
  }

  if (state === 'submitted') {
    return (
      <p className="rounded-btn border border-paper/15 bg-paper/5 px-3.5 py-2.5 text-sm text-paper/80">
        Thanks — newsletter signups are coming soon. We haven&apos;t saved your email anywhere yet.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <label htmlFor="footer-newsletter-email" className="sr-only">
        Email address
      </label>
      <input
        id="footer-newsletter-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="h-11 min-w-0 flex-1 rounded-btn border border-paper/20 bg-paper/5 px-3.5 text-sm text-paper placeholder:text-paper/40 focus:outline-none focus:ring-2 focus:ring-paper/30"
      />
      <button
        type="submit"
        className="h-11 shrink-0 rounded-btn bg-paper px-4 text-sm font-semibold text-ink transition-colors duration-fast hover:bg-paper/90 active:bg-paper/80"
      >
        Sign up
      </button>
    </form>
  )
}

export default function Footer({ storeName, links = [] }: FooterProps) {
  const columns = FOOTER_COLUMNS.map((col) =>
    col.title === 'Shop' && links.length > 0
      ? { ...col, links: [...col.links, ...links.filter((l) => !col.links.some((c) => c.href === l.href))] }
      : col,
  )

  return (
    <footer className="mt-20 border-t border-ink/10 bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8 md:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <p className="font-display text-lg font-bold uppercase tracking-tight">{storeName}</p>
            <p className="mt-2 max-w-[22ch] text-sm text-paper/50">Made to order, printed with care.</p>
            <div className="mt-5 flex items-center gap-2">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-paper/15 text-paper/70 transition-colors duration-fast hover:border-paper/40 hover:text-paper"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <FooterColumn key={col.title} title={col.title} links={col.links} />
          ))}
        </div>

        <div className="mt-12 border-t border-paper/10 pt-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-paper/50">Stay in the loop</h3>
              <div className="max-w-sm">
                <NewsletterForm />
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-paper/50 md:text-right">We accept</h3>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {PAYMENT_METHODS.map((m) => (
                  <PaymentBadge key={m} label={m} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-10 text-xs text-paper/40">
          © {new Date().getFullYear()} {storeName}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
