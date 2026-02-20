import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './themes/ThemeProvider'
import HomePage from './pages/HomePage'
import ProductPage from './pages/ProductPage'
import OrderSuccessPage from './pages/OrderSuccessPage'
import CheckoutPage from './pages/CheckoutPage'
import AdminLayout from './admin/AdminLayout'
import AdminProducts from './admin/pages/AdminProducts'
import AdminOrders from './admin/pages/AdminOrders'
import AdminSettings from './admin/pages/AdminSettings'
import AdminThemeCustomizer from './admin/pages/AdminThemeCustomizer'
import AdminAppearance from './admin/pages/AdminAppearance'
import AdminFooter from './admin/pages/AdminFooter'
import StaticPage from './pages/StaticPage'
import AdminPages from './admin/pages/AdminPages'
import AdminNavigation from './admin/pages/AdminNavigation'
import AdminCollections from './admin/pages/AdminCollections'
import AdminDashboard from './admin/pages/AdminDashboard'
import AdminDiscounts from './admin/pages/AdminDiscounts'
import AdminAnalytics from './admin/pages/AdminAnalytics'
import AdminBlog from './admin/pages/AdminBlog'
import AdminOrderDetail from './admin/pages/AdminOrderDetail'
import AdminShipping from './admin/pages/AdminShipping'
import AdminReviews from './admin/pages/AdminReviews'
import AdminImport from './admin/pages/AdminImport'
import LoginPage from './pages/account/LoginPage'
import RegisterPage from './pages/account/RegisterPage'
import AccountOrdersPage from './pages/account/AccountOrdersPage'
import ForgotPasswordPage from './pages/account/ForgotPasswordPage'
import ResetPasswordPage from './pages/account/ResetPasswordPage'
import CollectionPage from './pages/CollectionPage'
import SearchPage from './pages/SearchPage'
import BlogListPage from './pages/BlogListPage'
import BlogPostPage from './pages/BlogPostPage'
import NotFoundPage from './pages/NotFoundPage'
import ContactPage from './pages/ContactPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-success" element={<OrderSuccessPage />} />
            <Route path="/pages/:slug" element={<StaticPage />} />
            <Route path="/account/login" element={<LoginPage />} />
            <Route path="/account/register" element={<RegisterPage />} />
            <Route path="/account/orders" element={<AccountOrdersPage />} />
            <Route path="/account/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/account/reset-password" element={<ResetPasswordPage />} />
            <Route path="/collections/:slug" element={<CollectionPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/products" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="orders/:id" element={<AdminOrderDetail />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="theme" element={<Navigate to="/admin/appearance" replace />} />
              <Route path="appearance" element={<AdminAppearance />} />
              <Route path="footer" element={<AdminFooter />} />
              <Route path="collections" element={<AdminCollections />} />
              <Route path="pages" element={<AdminPages />} />
              <Route path="navigation" element={<AdminNavigation />} />
              <Route path="discounts" element={<AdminDiscounts />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="blog" element={<AdminBlog />} />
              <Route path="shipping" element={<AdminShipping />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="import" element={<AdminImport />} />
            </Route>
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
