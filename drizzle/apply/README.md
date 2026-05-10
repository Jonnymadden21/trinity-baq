# Applying the schema overhaul to production

These two SQL blocks bring the production Supabase database in sync with `shared/schema.ts`. They replace the historical `drizzle-kit push` workflow with proper migration tracking.

**Run these once.** They are a one-time bootstrap of the migration system; from this point forward, schema changes go through `npm run db:generate` → review SQL → `npm run db:migrate`.

## Order of operations

### 1. Take a Supabase point-in-time snapshot

Supabase Dashboard → **Database** → **Backups** → note the timestamp. If anything goes wrong below, restore to this point.

### 2. Open the SQL Editor as the postgres role

Supabase Dashboard → **SQL Editor**. Confirm in the upper-right that the connection role is `postgres` (not `trinity_app`). The application role is correctly restricted from creating schemas — that's why we run migrations from the dashboard.

### 3. Run Block A — `01-baseline-marker.sql`

Paste the entire file. Click **Run**. Expected output:

- `BEGIN`
- `CREATE SCHEMA`
- `CREATE TABLE`
- `INSERT 0 1`
- A SELECT result with one row showing `hash_prefix = c85d7ec122459 4fb`
- `COMMIT`

If you see `INSERT 0 0` instead of `INSERT 0 1`, that's also fine — it means the row already existed (the script is idempotent).

### 4. Compute the hash for Block B

On your Mac, in the project root:

```bash
shasum -a 256 drizzle/0001_schema_overhaul.sql
```

Output looks like `<64-hex-chars>  drizzle/0001_schema_overhaul.sql`. Copy the hex part.

### 5. Patch `02-schema-overhaul.sql`

Open `drizzle/apply/02-schema-overhaul.sql`. Find both occurrences of the literal string `__OVERHAUL_HASH__` and replace them with the hash from step 4. **Do not commit this edit** — it's local-only for this one paste. (Alternatively, do the replacement in the SQL Editor's text area after pasting; the file in git keeps the placeholder.)

### 6. Run Block B — `02-schema-overhaul.sql`

Paste into the SQL Editor. Click **Run**. The whole block is wrapped in `BEGIN; ... COMMIT;` — if any statement fails, all changes roll back atomically.

Expected verification output:

- Money columns showing `data_type = numeric` (5 rows: machines.base_price, options.price, quotes.base_price, quotes.options_total, quotes.total_price).
- `quotes.created_at` with `data_type = timestamp with time zone`.
- `quotes.updated_at` with `data_type = timestamp with time zone`.
- 4 foreign key constraints listed.
- 3 indexes listed (`idx_option_categories_machine_id`, `idx_options_category_id`, `idx_options_machine_id`).
- 2 rows in `drizzle.__drizzle_migrations` (the 0000 baseline and the 0001 overhaul).

### 7. Sanity check from your Mac

```bash
npm run db:migrate
```

Expected: drizzle reports no pending migrations. Both 0000 and 0001 are recorded as applied.

If drizzle says `0001_schema_overhaul` is pending, the hash you pasted in Block B didn't match what drizzle computes locally. The fix: `DELETE FROM drizzle.__drizzle_migrations WHERE id = (SELECT max(id) FROM drizzle.__drizzle_migrations)` in the SQL Editor, recompute the hash, and re-run Block B.

### 8. Deploy

The application code is already updated for the new types (commit `f8fd68d`). Ship the next deploy:

```bash
git push origin hardening-plan-1
```

Vercel auto-builds. Once the deploy URL is up, run the Plan 1 Task 20 smoke checks (origin/honeypot/Turnstile/rate-limit reject paths).

## If something goes wrong

- **Block B fails partway:** the `BEGIN; ... COMMIT;` rolls back the whole transaction. No state changes. Investigate the error, fix locally, re-run.
- **You realize after Block B applied that something's off:** Supabase Dashboard → restore from the PITR snapshot taken in step 1.
- **Drizzle complains about hash mismatch later:** see the "Sanity check" troubleshooting in step 7.

## Why this is a one-time procedure

The historical `drizzle-kit push` workflow modified prod schema directly without a migrations table. This bootstrap creates that table and back-fills the baseline record so that going forward, `db:generate` + `db:migrate` is the canonical schema-change flow. After this runs successfully, the legacy `db:push` script (which we removed in Plan 1 Task 3) is permanently retired.
