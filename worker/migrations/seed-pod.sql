-- ────────────────────────────────────────────────────────────
-- EdgeShop POD — demo catalog seed
-- ────────────────────────────────────────────────────────────
-- Two demo products exercising both shapes: a sized, two-sided
-- garment (Classic Tee) and a single-side, sizeless item
-- (Ceramic Mug). Mockup URLs are placeholders — replace them by
-- uploading real mockups through the admin (they land under
-- /img/mockups/<uuid>.webp) and updating these rows, or just
-- delete these demo products once real ones exist.
--
-- Run against a database that already has worker/migrations/schema.sql
-- applied:
--   npx wrangler d1 execute edgeshop-db --local --file=worker/migrations/seed-pod.sql
-- ────────────────────────────────────────────────────────────

-- ── Classic Tee — sized, front + back print ───────────────────
INSERT INTO products (name, slug, description, base_price, compare_price, category, status, is_customizable, stock_count, seo_title, seo_description)
VALUES (
  'Classic Tee',
  'classic-tee',
  'A soft, breathable 100% cotton tee. Add your own artwork to the front, the back, or both.',
  499,
  NULL,
  'Apparel',
  'active',
  1,
  0,
  'Classic Tee — Custom Printed',
  'Design your own Classic Tee. Soft 100% cotton, custom front and back print, sizes S–XL.'
);

INSERT INTO product_sides (product_id, side, image_url, image_w, image_h, customizable, print_x, print_y, print_w, print_h, print_width_in, print_fee, sort_order)
VALUES (
  (SELECT id FROM products WHERE slug = 'classic-tee'),
  'front',
  '/img/mockups/classic-tee-front.webp',
  1200, 1500,
  1,
  0.30, 0.28, 0.40, 0.34,
  12,
  99,
  0
);

INSERT INTO product_sides (product_id, side, image_url, image_w, image_h, customizable, print_x, print_y, print_w, print_h, print_width_in, print_fee, sort_order)
VALUES (
  (SELECT id FROM products WHERE slug = 'classic-tee'),
  'back',
  '/img/mockups/classic-tee-back.webp',
  1200, 1500,
  1,
  0.30, 0.24, 0.40, 0.36,
  12,
  79,
  1
);

INSERT INTO product_sizes (product_id, label, price_delta, stock_count, sort_order) VALUES
  ((SELECT id FROM products WHERE slug = 'classic-tee'), 'S',  0,  50, 0),
  ((SELECT id FROM products WHERE slug = 'classic-tee'), 'M',  0,  50, 1),
  ((SELECT id FROM products WHERE slug = 'classic-tee'), 'L',  0,  50, 2),
  ((SELECT id FROM products WHERE slug = 'classic-tee'), 'XL', 50, 30, 3);

-- ── Ceramic Mug — sizeless, front print only ──────────────────
INSERT INTO products (name, slug, description, base_price, compare_price, category, status, is_customizable, stock_count, seo_title, seo_description)
VALUES (
  'Ceramic Mug',
  'ceramic-mug',
  'An 11oz ceramic mug, dishwasher and microwave safe. Wrap it in your own design.',
  349,
  NULL,
  'Drinkware',
  'active',
  1,
  100,
  'Ceramic Mug — Custom Printed',
  'Design your own 11oz ceramic mug. Dishwasher and microwave safe.'
);

INSERT INTO product_sides (product_id, side, image_url, image_w, image_h, customizable, print_x, print_y, print_w, print_h, print_width_in, print_fee, sort_order)
VALUES (
  (SELECT id FROM products WHERE slug = 'ceramic-mug'),
  'front',
  '/img/mockups/ceramic-mug-front.webp',
  1200, 1200,
  1,
  0.28, 0.32, 0.44, 0.36,
  3.5,
  79,
  0
);
