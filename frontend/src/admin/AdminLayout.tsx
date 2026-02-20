import { useState, useEffect } from 'react'
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { ToastContainer } from './Toast'
import { useAdminAuthStore } from '../store/adminAuthStore'

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
function IconFolder() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  )
}
function IconPencil() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
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
function IconTag() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
function IconStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  )
}
function IconDocument() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  )
}
function IconMenu() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}
function IconLayout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="15" x2="9" y2="21" />
    </svg>
  )
}
function IconSwatch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 010 20" fill="currentColor" fillOpacity="0.12" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function IconTruck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" /><path d="M16 8h4l3 5v4h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
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
function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
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
function IconChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

interface NavSection {
  title: string
  items: { to: string; label: string; icon: React.ReactNode; permission?: string }[]
}

const sections: NavSection[] = [
  {
    title: 'Catalog',
    items: [
      { to: '/admin/products', label: 'Products', icon: <IconBox />, permission: 'products' },
      { to: '/admin/collections', label: 'Collections', icon: <IconFolder />, permission: 'products' },
      { to: '/admin/import', label: 'Import', icon: <IconUpload />, permission: 'products' },
    ],
  },
  {
    title: 'Content',
    items: [
      { to: '/admin/blog', label: 'Blog', icon: <IconPencil />, permission: 'content' },
      { to: '/admin/pages', label: 'Pages', icon: <IconDocument />, permission: 'content' },
      { to: '/admin/navigation', label: 'Navigation', icon: <IconMenu />, permission: 'content' },
      { to: '/admin/footer', label: 'Footer', icon: <IconLayout />, permission: 'content' },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: <IconCart />, permission: 'orders' },
      { to: '/admin/customers', label: 'Customers', icon: <IconUsers />, permission: 'customers' },
      { to: '/admin/discounts', label: 'Discounts', icon: <IconTag />, permission: 'discounts' },
      { to: '/admin/reviews', label: 'Reviews', icon: <IconStar />, permission: 'reviews' },
      { to: '/admin/analytics', label: 'Analytics', icon: <IconChart />, permission: 'analytics' },
    ],
  },
  {
    title: 'Store',
    items: [
      { to: '/admin/appearance', label: 'Appearance', icon: <IconSwatch />, permission: 'appearance' },
      { to: '/admin/shipping', label: 'Shipping', icon: <IconTruck />, permission: 'shipping' },
      { to: '/admin/settings', label: 'Settings', icon: <IconCog />, permission: 'settings' },
      { to: '/admin/staff', label: 'Staff', icon: <IconUsers />, permission: '__super_admin__' },
    ],
  },
]

function canAccess(permission: string | undefined, role: string, perms: Record<string, boolean>): boolean {
  if (!permission) return true
  if (permission === '__super_admin__') return role === 'super_admin'
  if (role === 'super_admin') return true
  return !!perms[permission]
}

function SidebarSection({
  section,
  defaultOpen = false,
  role,
  permissions,
}: {
  section: NavSection
  defaultOpen?: boolean
  role: string
  permissions: Record<string, boolean>
}) {
  const [open, setOpen] = useState(defaultOpen)
  const visibleItems = section.items.filter(item => canAccess(item.permission, role, permissions))
  if (visibleItems.length === 0) return null

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
      >
        {section.title}
        <span className={`transition-transform duration-200 text-gray-400 ${open ? 'rotate-180' : ''}`}>
          <IconChevronDown />
        </span>
      </button>
      {open && (
        <div className="space-y-0.5 mt-0.5">
          {visibleItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span className="shrink-0">{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const adminToken = useAdminAuthStore(s => s.adminToken)
  const adminName = useAdminAuthStore(s => s.adminName)
  const adminRole = useAdminAuthStore(s => s.adminRole)
  const adminPermissions = useAdminAuthStore(s => s.adminPermissions)
  const adminLogout = useAdminAuthStore(s => s.adminLogout)
  const navigate = useNavigate()

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!adminToken) navigate('/admin/login', { replace: true })
  }, [adminToken, navigate])

  if (!adminToken) return null

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 bg-white border-r border-gray-200 min-h-screen shrink-0">
        <div className="p-4 border-b border-gray-100">
          <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 block mb-1">← Storefront</Link>
          <p className="font-semibold text-gray-800 text-sm">Admin Panel</p>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors mb-3 ${
                isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <span className="shrink-0"><IconHome /></span>
            Dashboard
          </NavLink>
          <div className="border-t border-gray-100 pt-3 space-y-1">
            {sections.map(section => (
              <SidebarSection key={section.title} section={section} role={adminRole} permissions={adminPermissions} />
            ))}
          </div>
        </nav>
        <div className="p-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-700 truncate">{adminName}</p>
          <p className="text-xs text-gray-400 capitalize mb-2">{adminRole.replace('_', ' ')}</p>
          <button
            onClick={() => { adminLogout(); navigate('/admin/login') }}
            className="w-full text-left text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-40">
        <div>
          <Link to="/" className="text-xs text-gray-400">← Storefront</Link>
          <p className="font-semibold text-gray-800 text-sm leading-none mt-0.5">Admin</p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col gap-1.5 p-2 rounded hover:bg-gray-100"
          aria-label="Open menu"
        >
          <span className="w-5 h-px bg-gray-700 block" />
          <span className="w-5 h-px bg-gray-700 block" />
          <span className="w-5 h-px bg-gray-700 block" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer panel */}
      <div className={`md:hidden fixed left-0 top-0 h-full w-72 bg-white z-50 transform transition-transform duration-300 flex flex-col shadow-xl ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <Link to="/" className="text-xs text-gray-400">← Storefront</Link>
            <p className="font-semibold text-gray-800 text-sm">Admin Panel</p>
          </div>
          <button onClick={() => setDrawerOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl p-1">×</button>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors mb-3 ${
                isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
            onClick={() => setDrawerOpen(false)}
          >
            <span className="shrink-0"><IconHome /></span>
            Dashboard
          </NavLink>
          <div className="border-t border-gray-100 pt-3 space-y-1">
            {sections.map(section => (
              <SidebarSection key={section.title} section={section} role={adminRole} permissions={adminPermissions} />
            ))}
          </div>
        </nav>
        <div className="p-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-700 truncate">{adminName}</p>
          <p className="text-xs text-gray-400 capitalize mb-2">{adminRole.replace('_', ' ')}</p>
          <button
            onClick={() => { adminLogout(); navigate('/admin/login') }}
            className="w-full text-left text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 overflow-auto min-h-screen">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  )
}
