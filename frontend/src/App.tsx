import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { shouldRetryQuery } from './lib/api'
import MobileBottomNav from './components/MobileBottomNav'
import { useCartStore } from './store/cartStore'
import HomePage from './pages/HomePage'
import ProductPage from './pages/ProductPage'
import CustomizePage from './pages/CustomizePage'
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

// Global retry policy — see lib/api.ts for the reasoning. A 404 (or any
// 4xx) is a permanent failure and must reach its error UI immediately; only
// 5xx and network failures are worth a couple of retries.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
    },
  },
})

function GlobalMobileNav() {
  const location = useLocation()
  const totalItems = useCartStore((s) => s.totalItems)
  const openCart = useCartStore((s) => s.openCart)
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/customize')) return null
  return <MobileBottomNav cartCount={totalItems()} onCartOpen={openCart} />
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
          <Route path="/customize/:productId" element={<CustomizePage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          {/* :orderId is optional — CheckoutPage always includes it now (Bug 3
              fix, so a hard refresh can still fetch preview art), but the
              bare path stays valid so nothing breaks if it's ever navigated
              to without one. */}
          <Route path="/order-success/:orderId?" element={<OrderSuccessPage />} />
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
