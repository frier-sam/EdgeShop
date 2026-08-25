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
    <nav className="flex-1 p-3 overflow-y-auto space-y-1">
      {NAV_ITEMS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
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
    </nav>
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 bg-white border-r border-gray-200 min-h-screen shrink-0">
        <div className="p-4 border-b border-gray-100">
          <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 block mb-1">← Storefront</Link>
          <p className="font-semibold text-gray-800 text-sm">Admin Panel</p>
        </div>
        <SidebarNav />
        <div className="p-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-700 truncate">{adminName}</p>
          <p className="text-xs text-gray-400 capitalize mb-2">{adminRole.replace(/_/g, ' ')}</p>
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
        <SidebarNav onNavigate={() => setDrawerOpen(false)} />
        <div className="p-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-700 truncate">{adminName}</p>
          <p className="text-xs text-gray-400 capitalize mb-2">{adminRole.replace(/_/g, ' ')}</p>
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
