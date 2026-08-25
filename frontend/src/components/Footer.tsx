import { Link } from 'react-router-dom'
import type { NavItem } from '../lib/storeConfig'

interface FooterProps {
  storeName: string
  links?: NavItem[]
}

export default function Footer({ storeName, links = [] }: FooterProps) {
  return (
    <footer className="mt-20 border-t border-ink/10 bg-ink text-paper">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 sm:flex-row sm:justify-between sm:px-6">
        <div>
          <p className="font-display text-base font-semibold">{storeName}</p>
          <p className="mt-1 text-xs text-paper/50">Made to order, printed with care.</p>
        </div>
        {links.length > 0 && (
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {links.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-xs text-paper/60 transition-colors hover:text-paper"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
        <p className="text-xs text-paper/40">
          © {new Date().getFullYear()} {storeName}
        </p>
      </div>
    </footer>
  )
}
