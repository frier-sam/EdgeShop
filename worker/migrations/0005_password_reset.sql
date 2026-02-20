-- worker/migrations/0005_password_reset.sql
ALTER TABLE customers ADD COLUMN reset_token TEXT DEFAULT NULL;
ALTER TABLE customers ADD COLUMN reset_token_expires_at INTEGER DEFAULT NULL;
