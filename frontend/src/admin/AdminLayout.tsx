import { useState, useEffect } from 'react'
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { ToastContainer } from './Toast'
import { useAdminAuthStore } from '../store/adminAuthStore'
import { useSettings } from '../lib/useSettings'
import IconButton from '../components/ui/IconButton'
import Icon from '../components/ui/Icon'
import type { IconName } from '../components/ui/iconNames'

// POD-UI4.md §5 D.1 (A1) — six nav rows, each a fixed (route, label, icon)
// tuple. Replaces the six hand-rolled inline SVGs that used to live in
// this file with the shared <Icon> glyph set.
const NAV_ITEMS: { to: string; label: string; icon: IconName }[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/admin/products', label: 'Products', icon: 'inventory_2' },
  { to: '/admin/templates', label: 'Templates', icon: 'layers' },
  { to: '/admin/orders', label: 'Orders', icon: 'receipt_long' },
  { to: '/admin/customers', label: 'Customers', icon: 'group' },
  { to: '/admin/vendors', label: 'Vendors', icon: 'storefront' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
]

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {NAV_ITEMS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            // Mint active state (POD-UI4.md §2.2's accent-soft) vs. the
            // rest in ink-soft with a surface-3 hover — the comp's
            // `sidebar-active` treatment.
            `flex items-center gap-3 rounded-pill px-4 py-3 font-label text-label-md transition-colors duration-fast ${
              isActive ? 'bg-accent-soft text-on-accent-soft' : 'text-ink-soft hover:bg-surface-3'
            }`
          }
        >
          <Icon name={icon} size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function BrandBlock() {
  // Public /api/settings — same source Header.tsx/Footer.tsx already read
  // the storefront's own store_name from, cached by TanStack Query so
  // mounting this alongside the storefront's own useSettings() call costs
  // nothing extra.
  const { store_name: storeName } = useSettings()
  return (
    <div className="p-4">
      <Link
        to="/"
        className="mb-2 inline-block font-label text-label-sm text-ink-faint transition-colors duration-fast hover:text-ink-soft"
      >
        ← Storefront
      </Link>
      <p className="truncate font-display text-headline-md text-primary">{storeName}</p>
      <p className="font-label text-label-sm text-ink-faint">Print-on-demand storefront</p>
    </div>
  )
}

function AccountFooter({ adminName, adminRole, onSignOut }: { adminName: string; adminRole: string; onSignOut: () => void }) {
  return (
    <div className="border-t border-line p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-primary-container text-on-primary">
          <Icon name="person" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-label text-label-md text-ink">{adminName || 'Admin'}</p>
          <p className="truncate text-xs capitalize text-ink-faint">{adminRole.replace(/_/g, ' ')}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className="flex min-h-11 items-center gap-1.5 text-xs font-medium text-danger transition-colors duration-fast hover:text-danger/80"
      >
        <Icon name="logout" size={16} />
        Sign out
      </button>
    </div>
  )
}

// POD-UI4.md §5 D.1 (A11) — the comp's slim admin footer bar. `href: '#'`
// entries render as inert text rather than dead links, mirroring the
// storefront Footer's own convention (components/Footer.tsx) — there is
// no admin support page or docs site behind these yet.
const FOOTER_LINKS: { label: string; href: string }[] = [
  { label: 'Support', href: '#' },
  { label: 'Documentation', href: '#' },
]

function AdminFooter() {
  const { store_name: storeName } = useSettings()
  return (
    <footer className="border-t border-line bg-surface-5 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-ink-soft">
          © {new Date().getFullYear()} {storeName}. All rights reserved.
        </p>
        <div className="flex gap-4">
          {FOOTER_LINKS.map((link) =>
            link.href === '#' ? (
              <span key={link.label} title="Coming soon" className="text-body-sm text-ink-faint">
                {link.label}
              </span>
            ) : (
              <Link key={link.label} to={link.href} className="text-body-sm text-ink-soft transition-colors duration-fast hover:text-ink">
                {link.label}
              </Link>
            ),
          )}
        </div>
      </div>
    </footer>
  )
}

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const adminToken = useAdminAuthStore(s => s.adminToken)
  const adminName = useAdminAuthStore(s => s.adminName)
  const adminRole = useAdminAuthStore(s => s.adminRole)
  const adminLogout = useAdminAuthStore(s => s.adminLogout)
  const navigate = useNavigate()

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!adminToken) navigate('/admin/login', { replace: true })
  }, [adminToken, navigate])

  if (!adminToken) return null

  const signOut = () => { adminLogout(); navigate('/admin/login') }

  return (
    <div className="flex min-h-screen flex-col bg-paper md:flex-row">
      {/* Desktop sidebar — 280px, POD-UI4.md §5 D.1 (A1) */}
      <aside className="hidden min-h-screen w-[280px] shrink-0 flex-col border-r border-line bg-surface-2 md:flex">
        <BrandBlock />
        <SidebarNav />
        <AccountFooter adminName={adminName} adminRole={adminRole} onSignOut={signOut} />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <div>
          <Link to="/" className="font-label text-label-sm text-ink-faint">← Storefront</Link>
          <p className="mt-0.5 font-display text-sm font-semibold leading-none text-ink">Admin</p>
        </div>
        <IconButton variant="ghost" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <Icon name="menu" />
        </IconButton>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-ink/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer panel */}
      <div
        className={`fixed left-0 top-0 z-50 flex h-full w-72 transform flex-col bg-surface-2 shadow-lift transition-transform duration-base ease-out-soft md:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative border-b border-line">
          <BrandBlock />
          <IconButton
            variant="ghost"
            size="sm"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="absolute right-2 top-2"
          >
            <Icon name="close" size={18} />
          </IconButton>
        </div>
        <SidebarNav onNavigate={() => setDrawerOpen(false)} />
        <AccountFooter adminName={adminName} adminRole={adminRole} onSignOut={signOut} />
      </div>

      {/* Main content column */}
      <main className="flex min-h-screen flex-1 flex-col overflow-auto">
        <div className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
          <Outlet />
        </div>
        <AdminFooter />
      </main>
      <ToastContainer />
    </div>
  )
}
