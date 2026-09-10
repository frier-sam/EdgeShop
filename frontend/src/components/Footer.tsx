import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { NavItem } from '../lib/storeConfig'
import { FOOTER_COLUMNS } from '../lib/storeConfig'
import Icon from './ui/Icon'
import type { IconName } from './ui/iconNames'

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
    <span className="flex h-7 items-center rounded-sm border border-line bg-surface px-2 text-[11px] font-semibold tracking-wide text-ink-soft">
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

// Brand marks (POD-UI4.md §5 A.5): Material Symbols has no Instagram/
// Facebook/X glyphs, so these three stay hand-rolled inline SVG — the one
// deliberate exception to "everything through <Icon>" this round.
const BRAND_SOCIAL_LINKS = [
  { label: 'Instagram', href: '#', Svg: InstagramIcon },
  { label: 'Facebook', href: '#', Svg: FacebookIcon },
  { label: 'X (Twitter)', href: '#', Svg: XIcon },
]

// The one Material Symbol that *does* exist for the social row: a generic
// "visit our site" glyph pointing at the real homepage route, alongside
// the brand marks above — the comp's own footer pairs a `language` glyph
// with the brand icons the same way.
const SITE_LINK = { label: 'Visit our homepage', href: '/', iconName: 'public' as const }

const PAYMENT_METHODS = ['Visa', 'Mastercard', 'RuPay', 'UPI', 'Cash on Delivery']

// 44px floor (POD-UI4.md §6) — was a 36px box; these are real interactive
// controls (even if a couple are `href="#"` placeholders), not decoration.
const SOCIAL_ICON_CLASSES =
  'flex h-11 w-11 items-center justify-center rounded-pill border border-line text-ink-soft transition-colors duration-fast hover:border-ink/30 hover:text-ink'

/** `mailto:`/`tel:` need a real browser navigation, not client-side routing — see the comment on the Contact column below. Doubles as which entries earn an icon prefix. */
function externalContactIcon(href: string): IconName | null {
  if (href.startsWith('tel:')) return 'phone_in_talk'
  if (href.startsWith('mailto:')) return 'mail'
  return null
}

/**
 * One footer column of links. `href="#"` entries render as inert text
 * (POD-UI2.md §3/E6 note) instead of a dead link. `mailto:`/`tel:` entries
 * (the Contact column, plus "Contact Us" under Help) render as a plain
 * `<a>` rather than react-router's `Link` — `Link`'s `to` prop resolves
 * scheme-prefixed strings as an in-app relative path (there is no
 * "mailto:…" route), which silently turned every email/phone entry into a
 * broken client-side navigation instead of opening the mail/dial handler.
 * Those two get a small `mail`/`phone_in_talk` glyph (POD-UI4.md §5 A.5).
 */
function FooterColumn({ title, links }: { title: string; links: NavItem[] }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">{title}</h3>
      <ul className="flex flex-col gap-2.5">
        {links.map((link) => {
          if (link.href === '#') {
            return (
              <li key={link.label} title="Coming soon" className="text-sm text-ink-faint">
                {link.label}
              </li>
            )
          }
          const iconName = externalContactIcon(link.href)
          const rowClasses = 'flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink'
          const content = (
            <>
              {iconName && <Icon name={iconName} size={16} className="shrink-0 text-ink-faint" />}
              <span>{link.label}</span>
            </>
          )
          return (
            <li key={link.label}>
              {iconName ? (
                <a href={link.href} className={rowClasses}>
                  {content}
                </a>
              ) : (
                <Link to={link.href} className={rowClasses}>
                  {content}
                </Link>
              )}
            </li>
          )
        })}
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
      <p className="rounded-btn border border-line bg-surface px-3.5 py-2.5 text-sm text-ink-soft">
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
        className="h-11 min-w-0 flex-1 rounded-btn border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-faint transition-colors duration-fast focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      <button
        type="submit"
        className="h-11 shrink-0 rounded-btn bg-primary px-4 text-sm font-semibold text-on-primary transition-colors duration-fast hover:bg-primary-container active:scale-95"
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
    // POD-UI4.md §3.1 C5 / §5 A.5 — the comp's footer is a light, heavy
    // surface (`surface-container-highest`), not ESPOD's old dark
    // ink-on-ink treatment, so this swaps to `surface-5` (the heaviest
    // neutral) with ordinary `ink`/`ink-soft`/`ink-faint` text instead of
    // opacity-thinned `paper/NN`.
    <footer className="mt-20 border-t border-line bg-surface-5 text-ink">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-10 md:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <p className="font-display text-lg font-bold uppercase tracking-tight text-ink">{storeName}</p>
            <p className="mt-2 max-w-[22ch] text-sm text-ink-soft">Made to order, printed with care.</p>
            <div className="mt-5 flex items-center gap-2">
              {BRAND_SOCIAL_LINKS.map(({ label, href, Svg }) => (
                <a key={label} href={href} aria-label={label} className={SOCIAL_ICON_CLASSES}>
                  <Svg />
                </a>
              ))}
              <Link to={SITE_LINK.href} aria-label={SITE_LINK.label} className={SOCIAL_ICON_CLASSES}>
                <Icon name={SITE_LINK.iconName} size={18} />
              </Link>
            </div>
          </div>

          {columns.map((col) => (
            <FooterColumn key={col.title} title={col.title} links={col.links} />
          ))}
        </div>

        <div className="mt-12 border-t border-line pt-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Stay in the loop</h3>
              <div className="max-w-sm">
                <NewsletterForm />
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint md:text-right">We accept</h3>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {PAYMENT_METHODS.map((m) => (
                  <PaymentBadge key={m} label={m} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-10 text-xs text-ink-faint">
          © {new Date().getFullYear()} {storeName}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
