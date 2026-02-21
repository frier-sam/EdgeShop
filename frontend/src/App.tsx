import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './themes/ThemeProvider'
import PageTransition from './components/PageTransition'
import HomePage from './pages/HomePage'
import ProductPage from './pages/ProductPage'
import OrderSuccessPage from './pages/OrderSuccessPage'
import CheckoutPage from './pages/CheckoutPage'
import AdminLayout from './admin/AdminLayout'
import AdminLogin from './admin/pages/AdminLogin'
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
import AdminCustomers from './admin/pages/AdminCustomers'
import AdminStaff from './admin/pages/AdminStaff'
import AdminProductEdit from './admin/pages/AdminProductEdit'
import LoginPage from './pages/account/LoginPage'
import RegisterPage from './pages/account/RegisterPage'
import AccountOrdersPage from './pages/account/AccountOrdersPage'
import AccountProfilePage from './pages/account/AccountProfilePage'
import ForgotPasswordPage from './pages/account/ForgotPasswordPage'
import ResetPasswordPage from './pages/account/ResetPasswordPage'
import CollectionPage from './pages/CollectionPage'
import SearchPage from './pages/SearchPage'
import ShopPage from './pages/ShopPage'
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
            <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
            <Route path="/product/:id" element={<PageTransition><ProductPage /></PageTransition>} />
            <Route path="/checkout" element={<PageTransition><CheckoutPage /></PageTransition>} />
            <Route path="/order-success" element={<PageTransition><OrderSuccessPage /></PageTransition>} />
            <Route path="/pages/:slug" element={<PageTransition><StaticPage /></PageTransition>} />
            <Route path="/account/login" element={<PageTransition><LoginPage /></PageTransition>} />
            <Route path="/account/register" element={<PageTransition><RegisterPage /></PageTransition>} />
            <Route path="/account/orders" element={<PageTransition><AccountOrdersPage /></PageTransition>} />
            <Route path="/account/profile" element={<PageTransition><AccountProfilePage /></PageTransition>} />
            <Route path="/account/forgot-password" element={<PageTransition><ForgotPasswordPage /></PageTransition>} />
            <Route path="/account/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />
            <Route path="/collections/:slug" element={<PageTransition><CollectionPage /></PageTransition>} />
            <Route path="/search" element={<PageTransition><SearchPage /></PageTransition>} />
            <Route path="/shop" element={<PageTransition><ShopPage /></PageTransition>} />
            <Route path="/blog" element={<PageTransition><BlogListPage /></PageTransition>} />
            <Route path="/blog/:slug" element={<PageTransition><BlogPostPage /></PageTransition>} />
            <Route path="/admin/login" element={<PageTransition><AdminLogin /></PageTransition>} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/products" replace />} />
              <Route path="dashboard" element={<PageTransition><AdminDashboard /></PageTransition>} />
              <Route path="products" element={<PageTransition><AdminProducts /></PageTransition>} />
              <Route path="products/:id" element={<PageTransition><AdminProductEdit /></PageTransition>} />
              <Route path="orders" element={<PageTransition><AdminOrders /></PageTransition>} />
              <Route path="orders/:id" element={<PageTransition><AdminOrderDetail /></PageTransition>} />
              <Route path="settings" element={<PageTransition><AdminSettings /></PageTransition>} />
              <Route path="theme" element={<Navigate to="/admin/appearance" replace />} />
              <Route path="appearance" element={<PageTransition><AdminAppearance /></PageTransition>} />
              <Route path="footer" element={<PageTransition><AdminFooter /></PageTransition>} />
              <Route path="collections" element={<PageTransition><AdminCollections /></PageTransition>} />
              <Route path="pages" element={<PageTransition><AdminPages /></PageTransition>} />
              <Route path="navigation" element={<PageTransition><AdminNavigation /></PageTransition>} />
              <Route path="discounts" element={<PageTransition><AdminDiscounts /></PageTransition>} />
              <Route path="analytics" element={<PageTransition><AdminAnalytics /></PageTransition>} />
              <Route path="blog" element={<PageTransition><AdminBlog /></PageTransition>} />
              <Route path="shipping" element={<PageTransition><AdminShipping /></PageTransition>} />
              <Route path="reviews" element={<PageTransition><AdminReviews /></PageTransition>} />
              <Route path="import" element={<PageTransition><AdminImport /></PageTransition>} />
              <Route path="customers" element={<PageTransition><AdminCustomers /></PageTransition>} />
              <Route path="staff" element={<PageTransition><AdminStaff /></PageTransition>} />
            </Route>
            <Route path="/contact" element={<PageTransition><ContactPage /></PageTransition>} />
            <Route path="*" element={<PageTransition><NotFoundPage /></PageTransition>} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
