-- Add structured shipping address fields to orders
-- shipping_address remains as the street/address line for backward compatibility

ALTER TABLE orders ADD COLUMN shipping_city TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN shipping_state TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN shipping_pincode TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN shipping_country TEXT DEFAULT 'India';
