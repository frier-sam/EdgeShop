import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, Link } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MobileBottomNav from './components/MobileBottomNav'
import { useCartStore } from './store/cartStore'
import HomePage from './pages/HomePage'
import ProductPage from './pages/ProductPage'
import OrderSuccessPage from './pages/OrderSuccessPage'
import CheckoutPage from './pages/CheckoutPage'
import ShopPage from './pages/ShopPage'
import NotFoundPage from './pages/NotFoundPage'
import AdminLayout from './admin/AdminLayout'
import AdminLogin from './admin/pages/AdminLogin'
import AdminProducts from './admin/pages/AdminProducts'
import AdminOrders from './admin/pages/AdminOrders'
import AdminSettings from './admin/pages/AdminSettings'
import AdminDashboard from './admin/pages/AdminDashboard'
import AdminOrderDetail from './admin/pages/AdminOrderDetail'
import AdminCustomers from './admin/pages/AdminCustomers'
import AdminProductEdit from './admin/pages/AdminProductEdit'
import LoginPage from './pages/account/LoginPage'
import RegisterPage from './pages/account/RegisterPage'
import AccountOrdersPage from './pages/account/AccountOrdersPage'
import AccountProfilePage from './pages/account/AccountProfilePage'
import ForgotPasswordPage from './pages/account/ForgotPasswordPage'
import ResetPasswordPage from './pages/account/ResetPasswordPage'
import Toaster from './components/Toaster'

const queryClient = new QueryClient()

function GlobalMobileNav() {
  const location = useLocation()
  const totalItems = useCartStore((s) => s.totalItems)
  const openCart = useCartStore((s) => s.openCart)
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/customize')) return null
  return <MobileBottomNav cartCount={totalItems()} onCartOpen={openCart} />
}

// Phase 6 (POD.md §10) replaces this with the full canvas design editor.
// This placeholder exists only so /customize/:productId doesn't 404.
function CustomizePlaceholder() {
  const { productId } = useParams<{ productId: string }>()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Coming soon</p>
      <h1 className="font-display text-2xl font-semibold text-ink">Design editor for product #{productId}</h1>
      <p className="max-w-sm text-sm text-ink-soft">
        The customizer is under construction. Check back soon to design your own print.
      </p>
      <Link to="/shop" className="mt-2 text-sm font-semibold text-accent underline underline-offset-4">
        Back to shop
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <BrowserRouter>
        <GlobalMobileNav />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/customize/:productId" element={<CustomizePlaceholder />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-success" element={<OrderSuccessPage />} />
          <Route path="/account/login" element={<LoginPage />} />
          <Route path="/account/register" element={<RegisterPage />} />
          <Route path="/account/orders" element={<AccountOrdersPage />} />
          <Route path="/account/profile" element={<AccountProfilePage />} />
          <Route path="/account/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/account/reset-password" element={<ResetPasswordPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/products" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/:id" element={<AdminProductEdit />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<AdminOrderDetail />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
