-- Add role and permissions to customers for staff management

ALTER TABLE customers ADD COLUMN role TEXT NOT NULL DEFAULT 'customer';
-- values: 'customer' | 'staff' | 'super_admin'

ALTER TABLE customers ADD COLUMN permissions_json TEXT NOT NULL DEFAULT '{}';
-- e.g. {"products":true,"orders":true,"customers":false,...}
