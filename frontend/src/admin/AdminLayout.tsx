import { useState, useEffect } from 'react'
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { ToastContainer } from './Toast'
import { useAdminAuthStore } from '../store/adminAuthStore'
import IconButton from '../components/ui/IconButton'

// Minimal inline SVG icons — single color, stroke-based, 16×16 viewBox
function IconHome() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 3l9 9" /><path d="M9 21V12h6v9" /><path d="M3 12v9h18V12" />
    </svg>
  )
}
function IconBox() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v8" />
    </svg>
  )
}
function IconCart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
    </svg>
  )
}
function IconCog() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}
function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: <IconHome /> },
  { to: '/admin/products', label: 'Products', icon: <IconBox /> },
  { to: '/admin/orders', label: 'Orders', icon: <IconCart /> },
  { to: '/admin/customers', label: 'Customers', icon: <IconUsers /> },
  { to: '/admin/settings', label: 'Settings', icon: <IconCog /> },
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
            `flex items-center gap-2.5 rounded-btn px-3 py-2.5 text-sm font-medium transition-colors duration-fast ${
              isActive
                ? 'bg-accent-soft text-accent-dark'
                : 'text-ink-soft hover:bg-surface-2 hover:text-ink'
            }`
          }
        >
          <span className="shrink-0">{icon}</span>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function AccountFooter({ adminName, adminRole, onSignOut }: { adminName: string; adminRole: string; onSignOut: () => void }) {
  return (
    <div className="border-t border-line p-3">
      <p className="truncate text-xs font-medium text-ink">{adminName}</p>
      <p className="mb-2 text-xs capitalize text-ink-faint">{adminRole.replace(/_/g, ' ')}</p>
      <button
        onClick={onSignOut}
        className="text-left text-xs font-medium text-danger transition-colors duration-fast hover:text-danger/80"
      >
        Sign out
      </button>
    </div>
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
      {/* Desktop sidebar */}
      <aside className="hidden min-h-screen w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="border-b border-line p-4">
          <Link to="/" className="mb-1 block text-xs text-ink-faint transition-colors duration-fast hover:text-ink-soft">← Storefront</Link>
          <p className="font-display text-sm font-semibold text-ink">Admin Panel</p>
        </div>
        <SidebarNav />
        <AccountFooter adminName={adminName} adminRole={adminRole} onSignOut={signOut} />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <div>
          <Link to="/" className="text-xs text-ink-faint">← Storefront</Link>
          <p className="mt-0.5 font-display text-sm font-semibold leading-none text-ink">Admin</p>
        </div>
        <IconButton variant="ghost" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
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
        className={`fixed left-0 top-0 z-50 flex h-full w-72 transform flex-col bg-surface shadow-lift transition-transform duration-base ease-out-soft md:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line p-4">
          <div>
            <Link to="/" className="text-xs text-ink-faint">← Storefront</Link>
            <p className="font-display text-sm font-semibold text-ink">Admin Panel</p>
          </div>
          <IconButton variant="ghost" size="sm" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </IconButton>
        </div>
        <SidebarNav onNavigate={() => setDrawerOpen(false)} />
        <AccountFooter adminName={adminName} adminRole={adminRole} onSignOut={signOut} />
      </div>

      {/* Main content */}
      <main className="min-h-screen flex-1 overflow-auto p-4 sm:p-6">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  )
}
