-- Track every email sent in relation to an order
CREATE TABLE IF NOT EXISTS order_emails (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   TEXT    NOT NULL,
  type       TEXT    NOT NULL, -- 'order_confirmation', 'new_order_alert', 'shipping_update'
  recipient  TEXT    NOT NULL,
  subject    TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'sent', -- 'sent' | 'failed'
  sent_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_order_emails_order_id ON order_emails(order_id);
