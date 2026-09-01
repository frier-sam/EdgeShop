# EdgeShop v2 — Full E-commerce Feature Design

**Date:** 2026-02-19
**Status:** Approved for planning

---

## Goal

Extend EdgeShop from a basic product-listing + checkout app into a fully featured e-commerce platform at Shopify-feature parity, running entirely on Cloudflare's free tier.

---

## Phase 1 — Make It Usable (highest priority)

### 1. Product Variants + Image Gallery
Each product can have variants (e.g. Size: S/M/L, Color: Red/Blue). Each variant has its own price, stock, and optionally its own image. Products can have multiple images (gallery).

**Schema additions:**
- `product_variants` (id, product_id, name, options_json, price, stock_count, image_url, sku)
- `product_images` (id, product_id, url, sort_order)
- `products` gains: `compare_price`, `status` (active/draft), `tags`, `product_type` (physical/digital), `digital_file_key` (R2 key for downloads), `weight`, `seo_title`, `seo_description`

### 2. Collections / Categories
Products belong to collections. Collections have their own storefront page.

**Schema additions:**
- `collections` (id, name, slug, description, image_url, sort_order, seo_title, seo_description)
- `product_collections` (product_id, collection_id) — many-to-many

### 3. Search, Filter, Sort
Full-text search using D1's FTS5 extension. Filter by collection, price range, tags. Sort by price/newest/best-selling.

**Schema additions:**
- `CREATE VIRTUAL TABLE products_fts USING fts5(name, description, tags, content=products)`
- Orders table gains `items_sold_json` aggregation via a trigger or computed on read

### 4. Theme Customizer
Store per-theme overrides (colors, fonts, logo URL, tagline, hero image) as JSON in the settings table. ThemeProvider injects them as CSS custom properties. Admin has a live-preview customizer panel.

**Settings additions:** `theme_overrides_json` (JSON blob keyed by theme id)

### 5. Page Templates (Collection, About, Policy, 404)
- Collection page: header + description + product grid with filter/sort
- Static pages: About, Contact, Refund Policy, Privacy Policy, Shipping Policy, Terms
- Custom 404 page

**Schema additions:** `pages` (id, slug, title, content_html, meta_title, meta_description, is_visible)

### 6. Navigation Menu Editor
Merchant builds the storefront nav (links to collections, pages, external URLs) in admin. Stored as JSON in settings.

**Settings addition:** `navigation_json`

### 7. Email Notifications (Resend / HTTP SMTP)
Workers can't use raw TCP SMTP. Use Resend API (free tier: 3,000 emails/month, HTTP-based).
Configurable: merchant enters Resend API key in admin.

**Emails to send:**
- Order confirmation → customer
- New order alert → merchant
- Shipping update (with tracking) → customer
- Password reset (when customer accounts added)

**Settings additions:** `email_provider` (resend/mailgun), `email_api_key`, `email_from_name`, `email_from_address`, `merchant_email`

### 8. Admin Dashboard with Stats
Home screen of admin shows: total revenue (all time + today), total orders, pending orders count, low-stock products, recent 5 orders.

---

## Phase 2 — Make It Complete

### 9. Discount Codes
`discount_codes` table (code, type: percent/fixed/free_shipping, value, min_order_amount, max_uses, uses_count, expires_at, is_active). Applied at checkout, validated server-side.

### 10. Customer Accounts
`customers` table (id, email, password_hash via PBKDF2 Web Crypto, name, phone, created_at). JWT auth (stateless, stored in localStorage). Pages: /account/login, /account/register, /account/orders, /account/profile.

### 11. Digital Products
`product_type = 'digital'`. On order paid/placed, worker generates a time-limited R2 signed URL for the file. Sent via email. Download page at `/orders/:id/download`.

### 12. Order Detail Page (admin)
Full order view: customer info, line items with variant, payment status, order status, tracking number input, internal notes.

### 13. Tracking Numbers
Admin inputs tracking number + carrier on an order. Triggers shipping email to customer.

### 14. Announcement Bar
Sitewide top banner. `announcement_bar_text`, `announcement_bar_enabled`, `announcement_bar_color` in settings. Rendered by ThemeProvider.

### 15. SEO Fields
Meta title + description editable per product, collection, and static page. OG image. Auto-generated sitemap at `/sitemap.xml`.

### 16. Shipping Zones + Flat Rates
`shipping_zones` (name, countries_json), `shipping_rates` (zone_id, name, min_weight, max_weight, price, free_above_cart_total). Applied at checkout.

---

## Phase 3 — Make It Competitive

### 17. Blog / Articles
`blog_posts` (slug, title, content_html, cover_image, author, published_at, tags, seo fields).

### 18. Product Reviews
`reviews` (product_id, customer_name, rating 1-5, body, is_approved, created_at). Shown on product page. Admin moderation.

### 19. Refunds
Admin can mark payment_status = 'refunded' with optional notes. (Actual Razorpay refund via API call.)

### 20. Analytics Charts
Revenue over time (30d/90d), orders per day — computed via SQL GROUP BY on D1, rendered with a tiny chart (CSS bars or Chart.js).

### 21. Abandoned Cart Recovery
Store cart in D1 when customer enters email at checkout. Worker cron job (Cloudflare Cron Trigger) sends reminder email after 2h if order not placed.

---

## Key Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Email | Resend HTTP API | Workers can't do TCP SMTP; Resend has 3k free emails/month |
| Auth | PBKDF2 (Web Crypto) + JWT | Edge-compatible, no Node.js crypto needed |
| Full-text search | D1 FTS5 virtual table | Built into SQLite, no extra service |
| Theme customizer | CSS custom properties injected from D1 settings | Zero-cost, hot-swappable per theme |
| Digital products | R2 presigned URLs (time-limited) | Files stay private, downloads expire |
| Discounts | Server-side validation only | Prevents client-side tampering |
| Charts | Pure CSS or lightweight Chart.js | No analytics SaaS needed |

---

## New D1 Tables Summary

```
product_variants    — variant options, price, stock per variant
product_images      — gallery images per product
collections         — category groups
product_collections — many-to-many join
customers           — registered customer accounts
customer_addresses  — saved shipping addresses
discount_codes      — promo/coupon codes
pages               — static CMS pages (about, policy, etc.)
shipping_zones      — geographic zones
shipping_rates      — rates per zone
blog_posts          — articles/news
reviews             — product reviews
```

## Columns added to existing tables

```
products  +  compare_price, status, tags, product_type,
             digital_file_key, weight, seo_title, seo_description
orders    +  discount_code, discount_amount, shipping_amount,
             tax_amount, tracking_number, customer_notes, internal_notes, customer_id
settings  +  ~20 new keys (email, navigation, announcement bar, theme overrides)
```
