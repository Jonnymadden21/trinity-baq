-- Block A — Baseline migration marker
-- ==============================================================
-- Run this FIRST in the Supabase SQL Editor against the production
-- database. Idempotent — safe to re-run.
--
-- What it does: creates the `drizzle.__drizzle_migrations` tracking
-- table that Drizzle uses to know which migration files have been
-- applied, and records that `drizzle/0000_init.sql` is already
-- applied (because the schema it describes already exists in prod —
-- that's our current state from the historical `drizzle-kit push`
-- workflow).
--
-- After this runs, `drizzle/0001_schema_overhaul.sql` (Block B) is
-- the next pending migration.
--
-- Hash below MUST be the SHA-256 of `drizzle/0000_init.sql` exactly
-- as committed at f8fd68d. If the file changes, the hash changes and
-- this won't match what `drizzle-kit migrate` computes at runtime.
--   computed locally: sha256('drizzle/0000_init.sql') =
--   c85d7ec1224594fbe870b04345bebd24cd37efabd131da140688cbad80088163
-- ==============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS drizzle;

CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id         serial PRIMARY KEY,
  hash       text   NOT NULL,
  created_at bigint
);

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT
  'c85d7ec1224594fbe870b04345bebd24cd37efabd131da140688cbad80088163',
  (extract(epoch from now()) * 1000)::bigint
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations
  WHERE hash = 'c85d7ec1224594fbe870b04345bebd24cd37efabd131da140688cbad80088163'
);

-- Verification — should show exactly one row
SELECT id, substr(hash, 1, 16) AS hash_prefix, created_at
FROM drizzle.__drizzle_migrations
ORDER BY id;

COMMIT;
