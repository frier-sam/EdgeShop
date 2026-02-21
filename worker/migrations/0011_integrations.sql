-- worker/migrations/0011_integrations.sql
-- Seed integration settings keys

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('shiprocket_email', ''),
  ('shiprocket_password', ''),
  ('shiprocket_pickup_location', 'Primary'),
  ('shiprocket_enabled', 'false'),
  ('shiprocket_token', ''),
  ('shiprocket_token_expires_at', '');
