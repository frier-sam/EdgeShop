import { useState } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'

interface NavSection {
  title: string
  items: { to: string; label: string; icon: string }[]
}

const sections: NavSection[] = [
  {
    title: 'Catalog',
    items: [
      { to: '/admin/products', label: 'Products', icon: '📦' },
      { to: '/admin/collections', label: 'Collections', icon: '🗂️' },
      { to: '/admin/blog', label: 'Blog', icon: '✍️' },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: '🛒' },
      { to: '/admin/discounts', label: 'Discounts', icon: '🏷️' },
      { to: '/admin/reviews', label: 'Reviews', icon: '⭐' },
      { to: '/admin/analytics', label: 'Analytics', icon: '📊' },
    ],
  },
  {
    title: 'Content',
    items: [
      { to: '/admin/pages', label: 'Pages', icon: '📄' },
      { to: '/admin/navigation', label: 'Navigation', icon: '🔗' },
      { to: '/admin/footer', label: 'Footer', icon: '🦶' },
    ],
  },
  {
    title: 'Store',
    items: [
      { to: '/admin/appearance', label: 'Appearance', icon: '🎨' },
      { to: '/admin/shipping', label: 'Shipping', icon: '🚚' },
      { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
    ],
  },
]

function SidebarSection({ section, defaultOpen = true }: { section: NavSection; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
      >
        {section.title}
        <span className={`transition-transform duration-200 text-gray-300 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="space-y-0.5 mt-0.5">
          {section.items.map(({ to, label, icon }) => (
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
              <span className="text-base leading-none">{icon}</span>
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
            <span className="text-base leading-none">🏠</span>
            Dashboard
          </NavLink>
          <div className="border-t border-gray-100 pt-3 space-y-1">
            {sections.map(section => (
              <SidebarSection key={section.title} section={section} />
            ))}
          </div>
        </nav>
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
            <span className="text-base leading-none">🏠</span>
            Dashboard
          </NavLink>
          <div className="border-t border-gray-100 pt-3 space-y-1">
            {sections.map(section => (
              <SidebarSection key={section.title} section={section} />
            ))}
          </div>
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 overflow-auto min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
