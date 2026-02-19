Project: "EdgeShop" - Zero-Cost Serverless E-commerce
1. Application Overview
EdgeShop is a lightweight, high-performance e-commerce engine designed to run entirely on the Cloudflare Free Tier. It serves a storefront to customers and an admin panel to the merchant.

Target: Small businesses/independent sellers.

Primary Goal: Zero monthly hosting costs (using Cloudflare Workers, Pages, D1, and R2).

Key Innovation: Offloading all heavy image processing to the merchant's browser to keep serverless functions within the 10ms CPU limit.

2. Technical Stack
Frontend: React (Vite) hosted on Cloudflare Pages.

Routing/API: Hono framework running on Cloudflare Workers.

Database: Cloudflare D1 (Serverless SQL).

File Storage: Cloudflare R2 (S3-compatible) for product images.

Payments: Razorpay (UPI, Cards, Netbanking) + Cash on Delivery (COD).

Auth: Cloudflare Access (Zero Trust) to protect the /admin route.

3. Architecture Overview
The application follows an Edge-First Architecture.

Request Flow: User hits the Cloudflare Global Network -> Pages serves the React App.

API Flow: React App calls the Hono Worker (API) for dynamic data (products, cart, orders).

Data Persistence: Worker reads/writes to D1 SQL.

Asset Flow: Large assets (images) are served directly from R2 via a public bucket URL.

4. Detailed Component Breakdown
A. The Storefront (Customer Facing)
Home/Product Grid: Fetches products from /api/products.

Cart System: Managed in localStorage to keep the backend stateless.

Checkout Page: Collects shipping info and offers "Razorpay" or "COD".

B. The Admin Dashboard (Merchant Facing)
Order Management: Table view of all orders in D1. Status toggles: Pending, Paid, Shipped, Delivered.

Product Management: CRUD operations for items.

Settings: Update Razorpay API Keys, Store Name, and COD preferences.

C. The "Zero-CPU" Image Upload Logic
To avoid Cloudflare's paid image resizing or hitting Worker CPU limits:

Admin selects a raw image (PNG/JPG).

Browser JS uses the Canvas API to resize the image to max 1000px width.

Browser JS converts the result to a WebP blob.

Worker generates a Presigned URL for R2.

Browser uploads the optimized WebP directly to R2.

5. Integration Flows
Razorpay Webhook Flow
Worker sends order details to Razorpay to create an order_id.

Customer pays via Razorpay Modal.

Razorpay Webhook: Hits /api/webhook/razorpay.

Worker Validation: Uses crypto.subtle (Web Crypto API) to verify the Razorpay signature.

Database Update: If valid, updates Order status in D1 to PAID.

6. Database Schema (D1 SQL)
SQL
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  image_url TEXT,
  stock_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY, -- Use a NanoID or Razorpay Order ID
  customer_name TEXT,
  customer_email TEXT,
  shipping_address TEXT,
  total_amount REAL,
  payment_method TEXT, -- 'razorpay' or 'cod'
  payment_status TEXT DEFAULT 'pending',
  order_status TEXT DEFAULT 'placed',
  items_json TEXT, -- Stringified JSON of ordered items
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
7. Instructions for Claude Code
"Build a full-stack e-commerce application using the following structure:

Use Vite + React for the frontend and Hono for the backend Workers.

Implement a wrangler.toml that binds a D1 database (binding: DB) and an R2 bucket (binding: BUCKET).

Create a client-side ImageUploader component that resizes images to WebP before R2 upload.

Implement a POST /api/checkout that handles both COD and Razorpay order creation.

Implement a /api/webhook/razorpay endpoint that verifies HMAC signatures using the Web Crypto API.

Ensure the /admin/* routes on the frontend are separate and simple enough to be guarded by Cloudflare Access.

Prioritize 'edge-compatibility'—avoid any Node.js specific libraries that aren't supported by the Workers runtime."