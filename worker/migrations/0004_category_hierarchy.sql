-- Add parent_id to collections for multi-level category hierarchy (adjacency list)
ALTER TABLE collections ADD COLUMN parent_id INTEGER DEFAULT NULL REFERENCES collections(id) ON DELETE SET NULL;
