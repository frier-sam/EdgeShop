import { Outlet, NavLink, Link } from 'react-router-dom'

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/collections', label: 'Collections' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/settings', label: 'Settings' },
  { to: '/admin/theme', label: 'Theme' },
  { to: '/admin/pages', label: 'Pages' },
  { to: '/admin/navigation', label: 'Navigation' },
  { to: '/admin/discounts', label: 'Discounts' },
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/blog', label: 'Blog' },
  { to: '/admin/shipping', label: 'Shipping' },
  { to: '/admin/reviews', label: 'Reviews' },
]

export default function AdminLayout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex md:flex-col w-56 bg-white border-r border-gray-200 min-h-screen">
        <div className="p-5 border-b border-gray-100">
          <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 block mb-1">← Storefront</Link>
          <p className="font-semibold text-gray-800 text-sm">Admin Panel</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Bottom nav — mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-40">
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 py-3 text-xs font-medium text-center transition-colors ${
                isActive ? 'text-gray-900 bg-gray-50' : 'text-gray-500'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
