import { Link } from 'react-router-dom'
import type { NavItem } from '../lib/storeConfig'

interface FooterProps {
  storeName: string
  links?: NavItem[]
}

export default function Footer({ storeName, links = [] }: FooterProps) {
  return (
    <footer className="border-t border-gray-200 bg-gray-900 mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm font-semibold text-white">{storeName}</p>
        {links.length > 0 && (
          <nav className="flex items-center gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
        <p className="text-xs text-gray-500">© {new Date().getFullYear()} {storeName}</p>
      </div>
    </footer>
  )
}
