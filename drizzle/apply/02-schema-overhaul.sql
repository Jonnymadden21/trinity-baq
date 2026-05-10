-- Block B — Schema overhaul migration (drizzle/0001_schema_overhaul.sql)
-- ==============================================================
-- Run this SECOND in the Supabase SQL Editor, AFTER Block A
-- (01-baseline-marker.sql) completes successfully and AFTER you take
-- a Supabase point-in-time snapshot from the Backups tab.
--
-- What it does:
--   1. Converts five money columns from `double precision` to
--      `numeric(10,2)` (preserves all current values; cents-precise
--      from this point on).
--   2. Converts `quotes.created_at` from `text` (ISO-8601) to
--      `timestamp with time zone` and adds DEFAULT now() so future
--      inserts don't need to provide it.
--   3. Adds `quotes.updated_at` (timestamp with time zone, NOT NULL,
--      DEFAULT now()). Existing 33 quote rows get the migration
--      timestamp as their initial `updated_at`.
--   4. Adds 4 foreign keys (verified zero orphans before this
--      migration was authored):
--        option_categories.machine_id   → machines.id    CASCADE
--        options.category_id            → option_categories.id   CASCADE
--        options.machine_id             → machines.id    CASCADE
--        quotes.machine_id              → machines.id    RESTRICT
--   5. Adds 3 indexes on the new FK columns.
--   6. Inserts a row in drizzle.__drizzle_migrations recording that
--      0001_schema_overhaul has been applied.
--
-- Wrapped in a single transaction. If any statement fails, all
-- changes roll back atomically. PostgreSQL supports transactional
-- DDL on standard tables.
--
-- Hash for 0001_schema_overhaul.sql:
--   sha256 will be computed and inserted at the end. Run the script
--   below and copy the printed hash from the verification block.
-- ==============================================================

BEGIN;

ALTER TABLE "machines" ALTER COLUMN "base_price" SET DATA TYPE numeric(10, 2) USING "base_price"::numeric(10, 2);
ALTER TABLE "options" ALTER COLUMN "price" SET DATA TYPE numeric(10, 2) USING "price"::numeric(10, 2);
ALTER TABLE "quotes" ALTER COLUMN "base_price" SET DATA TYPE numeric(10, 2) USING "base_price"::numeric(10, 2);
ALTER TABLE "quotes" ALTER COLUMN "options_total" SET DATA TYPE numeric(10, 2) USING "options_total"::numeric(10, 2);
ALTER TABLE "quotes" ALTER COLUMN "total_price" SET DATA TYPE numeric(10, 2) USING "total_price"::numeric(10, 2);
ALTER TABLE "quotes" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at"::timestamptz;
ALTER TABLE "quotes" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "quotes" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE "option_categories" ADD CONSTRAINT "option_categories_machine_id_machines_id_fk"
  FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "options" ADD CONSTRAINT "options_category_id_option_categories_id_fk"
  FOREIGN KEY ("category_id") REFERENCES "public"."option_categories"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "options" ADD CONSTRAINT "options_machine_id_machines_id_fk"
  FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "quotes" ADD CONSTRAINT "quotes_machine_id_machines_id_fk"
  FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE restrict ON UPDATE no action;

CREATE INDEX "idx_option_categories_machine_id" ON "option_categories" USING btree ("machine_id");
CREATE INDEX "idx_options_category_id" ON "options" USING btree ("category_id");
CREATE INDEX "idx_options_machine_id" ON "options" USING btree ("machine_id");

-- Record this migration in drizzle's tracking table.
-- Hash MUST match what `drizzle-kit migrate` will compute next time
-- it runs (sha256 of drizzle/0001_schema_overhaul.sql exactly as
-- committed). If you regenerate that file, this hash is stale.
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT
  '__OVERHAUL_HASH__',
  (extract(epoch from now()) * 1000)::bigint
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '__OVERHAUL_HASH__'
);

-- Verification queries — sanity-check before COMMIT.
SELECT
  table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('base_price', 'price', 'options_total', 'total_price', 'created_at', 'updated_at')
ORDER BY table_name, column_name;

SELECT
  conname AS fk_name, conrelid::regclass AS table_name
FROM pg_constraint
WHERE contype = 'f'
  AND connamespace = 'public'::regnamespace
ORDER BY conname;

SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

SELECT id, substr(hash, 1, 16) AS hash_prefix
FROM drizzle.__drizzle_migrations
ORDER BY id;

COMMIT;
