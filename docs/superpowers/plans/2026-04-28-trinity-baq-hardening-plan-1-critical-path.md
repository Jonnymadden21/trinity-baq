# Trinity BAQ — Hardening Plan 1 (Critical Path) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate every CRITICAL audit finding for `POST /api/quotes` and the schema, in production, without changing the public lead-gen UX.

**Architecture:** Layered server-side protection (origin allowlist → honeypot → Turnstile → rate limit → ID validation → server-recomputed pricing → DB write → async Resend notification). Drizzle migrations replace `push`. Schema gains FKs, indexes, `numeric(10,2)` money, real timestamps. Errors narrow to generic 400/500 with details logged server-side.

**Tech Stack:** TypeScript, Vercel Functions, Drizzle ORM + drizzle-kit, postgres-js, Supabase Postgres, Cloudflare Turnstile, Upstash Redis (REST), Resend, Zod, Vitest.

**Companion docs:**

- Spec: `docs/superpowers/specs/2026-04-28-trinity-baq-hardening-design.md`
- SEO spec (separate effort): `docs/superpowers/specs/2026-04-28-trinity-baq-seo-design.md`
- Plan 2 (Reliability, Performance & Cleanup): to be written after Plan 1 ships

**Conventions:**

- Project root: `/Users/jmadden/Desktop/selway/Trinity/trinity-quote-vercel`
- All paths in tasks are relative to project root.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`, `docs:`).
- Each task ends in a commit. Branch off `main`; merge after each task or batch when CI is green.

---

## Task 0: Prerequisites (manual, ~30 min)

Before running any subsequent task, the following external services must be provisioned. **Do these once. Capture the values into a temporary text scratchpad, then transfer to Vercel env in Task 4.**

- [ ] **Step 0.1: Cloudflare Turnstile**
  1. Go to https://dash.cloudflare.com/?to=/:account/turnstile
  2. Click **Add site**. Domain: `trinitybaq.com`. Widget mode: **Managed**.
  3. Copy the **Site Key** (public, will appear in client) and the **Secret Key** (server-only).

- [ ] **Step 0.2: Upstash Redis (for rate limiting)**
  1. Go to https://console.upstash.com/ → **Create Database** → Redis → Region nearest the Supabase region (`us-west-1`).
  2. Database name: `trinity-baq-ratelimit`.
  3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from the database details page.

- [ ] **Step 0.3: Resend (transactional email)**
  1. Go to https://resend.com/ → **API Keys** → **Create API Key** with `Sending access` only.
  2. Copy `RESEND_API_KEY` (`re_...`).
  3. **Domains** → **Add Domain** → enter `mail.trinitybaq.com` (or `trinityautomation.com` if Trinity HQ owns DNS). Add the printed DKIM, SPF, and DMARC records to the domain registrar. Verification can take 0–48 h. Until verified, sends will go from `onboarding@resend.dev`.

- [ ] **Step 0.4: Rotate the Supabase database password**
  1. Supabase dashboard → **Project Settings → Database → Reset database password**. Generate a new strong password.
  2. Update `.env.local` locally with the new connection string.
  3. Update Vercel env (Production + Preview) → `DATABASE_URL` to the new value. Redeploy production to pick it up.
  4. Verify: `curl -I https://trinitybaq.com/api/machines` returns 200 after the redeploy.

---

## Task 1: Stop shipping `.vercel/project.json` from `client/public/brochures/`

**Files:**

- Delete: `client/public/brochures/.vercel/` (directory)
- Modify: `.gitignore`

- [ ] **Step 1.1: Delete the leaking directory**

```bash
rm -rf client/public/brochures/.vercel
```

- [ ] **Step 1.2: Strengthen `.gitignore`**

Replace the contents of `.gitignore` with:

```
node_modules/
dist/
.env
.env.local
*.db
*.db-journal
.vercel
**/.vercel/
.DS_Store
*.log
npm-debug.log
coverage/
.idea/
.vscode/settings.json
*.swp
*.swo
*~
```

- [ ] **Step 1.3: Verify build no longer ships the leak**

Run:

```bash
DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" npm run build
ls dist/brochures/.vercel 2>&1 | head -1
```

Expected: `ls: dist/brochures/.vercel: No such file or directory`.

- [ ] **Step 1.4: Commit**

```bash
git add .gitignore client/public/brochures
git commit -m "chore: stop shipping .vercel project metadata in build output"
```

---

## Task 2: Restore `.env.example` and document new env vars

**Files:**

- Create: `.env.example`
- Modify: `README.md`

- [ ] **Step 2.1: Create `.env.example`**

```
# Supabase Postgres (Transaction pooler, port 6543)
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# Cloudflare Turnstile (https://dash.cloudflare.com/?to=/:account/turnstile)
VITE_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=

# Upstash Redis REST (https://console.upstash.com/) — used for per-IP rate limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Resend (https://resend.com/) — transactional email for lead notifications
RESEND_API_KEY=
RESEND_FROM_EMAIL=quotes@mail.trinitybaq.com
LEAD_NOTIFICATION_TO=jonnymadden21@icloud.com

# Allowlist for POST /api/quotes Origin/Referer header (comma-separated, no trailing slashes)
ALLOWED_ORIGINS=https://trinitybaq.com,https://www.trinitybaq.com
```

- [ ] **Step 2.2: Fix README step 2 to reference `.env.example`**

Open `README.md`. Replace lines 21–31 (the "Configure Environment" section) with:

````markdown
### 2. Configure Environment

```bash
cp .env.example .env.local
```
````

Fill in every blank in `.env.local`. See `docs/deployment.md` (TODO in Plan 2) for where to obtain each value. At minimum, `DATABASE_URL` must be set before running `npm run db:migrate` or `npm run db:seed`.

````

- [ ] **Step 2.3: Commit**

```bash
git add .env.example README.md
git commit -m "docs: restore .env.example with all required hardening env vars"
````

---

## Task 3: Add Node engines and the missing tooling scripts

**Files:**

- Modify: `package.json`

- [ ] **Step 3.1: Update `package.json` scripts and add engines**

Replace the `scripts` block in `package.json` with:

```json
"scripts": {
  "dev": "vite --config vite.config.ts",
  "build": "vite build --config vite.config.ts",
  "typecheck": "tsc --noEmit",
  "typecheck:api": "tsc --noEmit -p tsconfig.api.json",
  "check": "npm run typecheck && npm run typecheck:api",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:seed": "tsx scripts/seed.ts",
  "vercel-build": "npm run build"
}
```

Note: `db:push` is intentionally removed.

Add at the top level (after `"type": "module"`):

```json
"engines": {
  "node": ">=18.17.0",
  "npm": ">=9.0.0"
},
```

- [ ] **Step 3.2: Add new dev dependencies**

Run:

```bash
npm install --save-dev eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh prettier vitest @vitest/ui
```

- [ ] **Step 3.3: Add Cloudflare Turnstile and runtime libs we need**

Run:

```bash
npm install @upstash/redis resend
```

- [ ] **Step 3.4: Verify clean install**

```bash
rm -rf node_modules
npm install
```

Expected: completes without error.

- [ ] **Step 3.5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add engines, scripts, and runtime/dev deps for hardening"
```

---

## Task 4: Push all secrets to Vercel env

**Files:** none (external action)

- [ ] **Step 4.1: Add each env var to Vercel**

```bash
# from project root
vercel env add VITE_TURNSTILE_SITE_KEY production
vercel env add VITE_TURNSTILE_SITE_KEY preview
vercel env add TURNSTILE_SECRET_KEY production
vercel env add TURNSTILE_SECRET_KEY preview
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_URL preview
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add UPSTASH_REDIS_REST_TOKEN preview
vercel env add RESEND_API_KEY production
vercel env add RESEND_API_KEY preview
vercel env add RESEND_FROM_EMAIL production
vercel env add RESEND_FROM_EMAIL preview
vercel env add LEAD_NOTIFICATION_TO production
vercel env add LEAD_NOTIFICATION_TO preview
vercel env add ALLOWED_ORIGINS production
vercel env add ALLOWED_ORIGINS preview
```

For each, paste the value from the Task 0 scratchpad. `ALLOWED_ORIGINS` value: `https://trinitybaq.com,https://www.trinitybaq.com`.

- [ ] **Step 4.2: Pull env to local**

```bash
vercel env pull .env.local
```

Verify `.env.local` now contains all entries from `.env.example`.

- [ ] **Step 4.3: No commit (all secrets are out-of-tree)**

---

## Task 5: Set up ESLint + Prettier

**Files:**

- Create: `eslint.config.js`
- Create: `.prettierrc.json`
- Create: `.prettierignore`

- [ ] **Step 5.1: Create `eslint.config.js`**

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "drizzle", ".vercel", "client/src/components/ui/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
);
```

- [ ] **Step 5.2: Create `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "arrowParens": "always"
}
```

- [ ] **Step 5.3: Create `.prettierignore`**

```
dist
node_modules
drizzle
package-lock.json
client/src/components/ui
```

- [ ] **Step 5.4: Run lint to surface initial issues**

```bash
npm run lint 2>&1 | head -40
```

Note: errors here are expected; we'll fix them progressively in later tasks. Do **not** mass-fix in this commit.

- [ ] **Step 5.5: Format the codebase**

```bash
npm run format
```

- [ ] **Step 5.6: Commit**

```bash
git add eslint.config.js .prettierrc.json .prettierignore .
git commit -m "chore: add ESLint + Prettier configs and format codebase"
```

---

## Task 6: Split TypeScript config (client vs api)

**Files:**

- Modify: `tsconfig.json`
- Create: `tsconfig.api.json`

- [ ] **Step 6.1: Narrow `tsconfig.json` to client + shared**

Replace `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "paths": {
      "@/*": ["./client/src/*"],
      "@shared/*": ["./shared/*"]
    },
    "baseUrl": ".",
    "noEmit": true
  },
  "include": ["client/src/**/*", "shared/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 6.2: Create `tsconfig.api.json` for server-side code**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ES2022"],
    "types": ["node"],
    "paths": {
      "@shared/*": ["./shared/*"],
      "@server/*": ["./server/*"]
    },
    "baseUrl": ".",
    "noEmit": true
  },
  "include": ["api/**/*", "scripts/**/*", "shared/**/*", "server/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 6.3: Verify both pass**

```bash
npm run check
```

Expected: exit 0.

- [ ] **Step 6.4: Commit**

```bash
git add tsconfig.json tsconfig.api.json
git commit -m "build: split tsconfig into client and api scopes"
```

---

## Task 7: Add CI (GitHub Actions)

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 7.1: Create the workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run check
      - run: npm run lint
      - run: npm test
      - run: DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

- [ ] **Step 7.2: Verify locally**

```bash
npm ci && npm run check && npm run lint && npm test && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

Note: `npm test` will pass with zero tests on first run (Vitest treats no-tests as success unless configured otherwise).

Lint may report warnings; that's OK. Treat errors as blocking — fix or `eslint-disable-next-line` with justification.

- [ ] **Step 7.3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for typecheck + lint + test + build"
```

---

## Task 8: Generate baseline migration from current schema

This snapshots the existing production schema as migration `0000_init.sql` so future migrations are diffs against a known starting point.

**Files:**

- Modify: `drizzle.config.ts`
- Create: `drizzle/0000_init.sql` (auto-generated)
- Create: `drizzle/meta/0000_snapshot.json` (auto-generated)

- [ ] **Step 8.1: Update `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

- [ ] **Step 8.2: Generate baseline migration**

```bash
npm run db:generate -- --name init
```

Expected: creates `drizzle/0000_init.sql` and `drizzle/meta/0000_snapshot.json` matching the current `shared/schema.ts`.

- [ ] **Step 8.3: Mark as applied on production without running it**

The schema in production already matches; we must tell drizzle the baseline is applied.

```bash
psql "$DATABASE_URL" -c "
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id serial PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
"

# Capture the hash drizzle expects:
HASH=$(node -e "
const fs = require('fs');
const crypto = require('crypto');
const sql = fs.readFileSync('drizzle/0000_init.sql', 'utf8');
console.log(crypto.createHash('sha256').update(sql).digest('hex'));
")

psql "$DATABASE_URL" -c "
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('$HASH', extract(epoch from now()) * 1000);
"
```

Expected: `INSERT 0 1`.

- [ ] **Step 8.4: Verify subsequent `npm run db:migrate` is a no-op**

```bash
npm run db:migrate
```

Expected: "No migrations to apply" or equivalent.

- [ ] **Step 8.5: Commit**

```bash
git add drizzle drizzle.config.ts
git commit -m "chore(db): seed drizzle migrations baseline matching current prod schema"
```

---

## Task 9: Schema overhaul (FKs, indexes, money, timestamps, JSON Zod)

**Files:**

- Modify: `shared/schema.ts`
- Create: `shared/zodTypes.ts`

- [ ] **Step 9.1: Create Zod schemas for the JSON columns**

Create `shared/zodTypes.ts`:

```ts
import { z } from "zod";

export const MachineSpecsSchema = z
  .object({
    palletStations: z.number().int().nonnegative().optional(),
    maxPartDiameter: z.string().optional(),
    maxPartHeight: z.string().optional(),
    maxWeight: z.string().optional(),
    palletDiameter: z.string().optional(),
    palletThickness: z.string().optional(),
    zeroPointPullStuds: z.number().int().nonnegative().optional(),
    rotaryLoad: z.string().optional(),
    activeDryingStation: z.string().optional(),
    loadDirection: z.string().optional(),
    voltage: z.string().optional(),
    secondMachine: z.string().optional(),
    robotPayload: z.string().optional(),
  })
  .passthrough();
export type MachineSpecs = z.infer<typeof MachineSpecsSchema>;

export const SelectedOptionsSchema = z.array(
  z.object({
    id: z.number().int().positive(),
    categoryId: z.number().int().positive(),
    name: z.string(),
    price: z.number().nonnegative(),
  }),
);
export type SelectedOptions = z.infer<typeof SelectedOptionsSchema>;

export const FinancingParamsSchema = z
  .object({
    downPayment: z.number().nonnegative(),
    termMonths: z.number().int().positive(),
    apr: z.number().nonnegative(),
    monthlyPayment: z.number().nonnegative().optional(),
  })
  .strict();
export type FinancingParams = z.infer<typeof FinancingParamsSchema>;

export const RoiParamsSchema = z
  .object({
    shopRate: z.number().nonnegative(),
    hrsPerShift: z.number().nonnegative(),
    operatorWage: z.number().nonnegative(),
    workingDays: z.number().nonnegative(),
    mannedShifts: z.number().int().nonnegative(),
    unmannedShifts: z.number().int().nonnegative(),
    mannedUtilBefore: z.number().min(0).max(100),
    mannedUtilAfter: z.number().min(0).max(100),
    unmannedUtilBefore: z.number().min(0).max(100),
    unmannedUtilAfter: z.number().min(0).max(100),
  })
  .strict();
export type RoiParams = z.infer<typeof RoiParamsSchema>;
```

- [ ] **Step 9.2: Rewrite `shared/schema.ts`**

```ts
import { pgTable, serial, text, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const machines = pgTable("machines", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  series: text("series").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  specs: text("specs").notNull(),
  features: text("features").notNull(),
  compatibleMachines: text("compatible_machines").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const optionCategories = pgTable(
  "option_categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
    machineId: integer("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
  },
  (t) => ({ machineIdx: index("idx_option_categories_machine_id").on(t.machineId) }),
);

export const options = pgTable(
  "options",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => optionCategories.id, { onDelete: "cascade" }),
    machineId: integer("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => ({
    categoryIdx: index("idx_options_category_id").on(t.categoryId),
    machineIdx: index("idx_options_machine_id").on(t.machineId),
  }),
);

export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  quoteNumber: text("quote_number").notNull().unique(),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machines.id, { onDelete: "restrict" }),
  machineName: text("machine_name").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerCompany: text("customer_company"),
  customerPhone: text("customer_phone"),
  selectedOptions: text("selected_options").notNull(),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  optionsTotal: numeric("options_total", { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  financingParams: text("financing_params"),
  roiParams: text("roi_params"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Machine = typeof machines.$inferSelect;
export type Option = typeof options.$inferSelect;
export type OptionCategory = typeof optionCategories.$inferSelect;
export type Quote = typeof quotes.$inferSelect;

export const insertQuoteSchema = createInsertSchema(quotes, {
  customerEmail: z.string().email(),
  basePrice: z.string(),
  optionsTotal: z.string(),
  totalPrice: z.string(),
}).omit({ id: true, createdAt: true, updatedAt: true });
```

Note: `numeric` columns are returned and inserted as **strings** by `postgres-js` to preserve precision. The pricing module (Task 11) treats prices as strings until the final calculation, then converts using a money helper.

- [ ] **Step 9.3: Generate the migration diff**

```bash
npm run db:generate -- --name schema_overhaul
```

Expected: creates `drizzle/0001_schema_overhaul.sql` containing the float→numeric casts, FKs, indexes, and timestamp column changes.

- [ ] **Step 9.4: Inspect the generated SQL manually**

```bash
cat drizzle/0001_schema_overhaul.sql
```

Verify:

- Money columns altered with `USING base_price::numeric(10,2)` (Drizzle should generate this; if not, hand-edit before applying).
- `created_at` altered with `USING created_at::timestamptz`. **If `created_at` was previously stored as ISO strings**, this works; if as Unix epoch text, the cast will fail and we'll need to hand-edit to `to_timestamp(created_at::bigint)`. Verify by sampling current data first:
  ```bash
  psql "$DATABASE_URL" -c "SELECT created_at FROM quotes LIMIT 3;"
  ```
- New `updated_at` columns added with `DEFAULT now()`.
- FKs added with `ON DELETE CASCADE` (or `RESTRICT` for `quotes.machine_id`).
- Three indexes created.

- [ ] **Step 9.5: Take a Supabase point-in-time snapshot**

Supabase dashboard → **Database → Backups** → **Restore point** (note the timestamp in your scratchpad).

- [ ] **Step 9.6: Apply the migration**

```bash
npm run db:migrate
```

Expected: `0001_schema_overhaul applied`.

- [ ] **Step 9.7: Verify in psql**

```bash
psql "$DATABASE_URL" -c "\d quotes" | grep -E "base_price|created_at|updated_at"
psql "$DATABASE_URL" -c "\d options" | grep -E "category_id|machine_id"
psql "$DATABASE_URL" -c "\di" | grep -E "idx_options|idx_option_categories"
```

Expected: numeric(10,2) for money columns, timestamp for createdAt/updatedAt, FK references on category_id/machine_id, three indexes present.

- [ ] **Step 9.8: Commit**

```bash
git add shared/schema.ts shared/zodTypes.ts drizzle/0001_schema_overhaul.sql drizzle/meta
git commit -m "feat(db): schema overhaul with FKs, indexes, numeric money, timestamps"
```

---

## Task 10: Centralized API helpers (cors, errors, env)

**Files:**

- Create: `api/_lib/env.ts`
- Create: `api/_lib/handler.ts`
- Modify: `api/_db.ts`

- [ ] **Step 10.1: Create `api/_lib/env.ts`**

```ts
function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY ?? "",
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ?? "",
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
  LEAD_NOTIFICATION_TO: process.env.LEAD_NOTIFICATION_TO ?? "",
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
```

- [ ] **Step 10.2: Modify `api/_db.ts` to validate env at import**

Replace `api/_db.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";
import { env } from "./_lib/env";

const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 1,
});

export const db = drizzle(client, { schema });
export { client as pgClient };
```

- [ ] **Step 10.3: Create `api/_lib/handler.ts`**

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public clientMessage: string,
  ) {
    super(clientMessage);
  }
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void;

export function withErrorHandling(handler: Handler): Handler {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.clientMessage });
        return;
      }
      if (err instanceof ZodError) {
        console.error("ZodError:", err.flatten());
        res.status(400).json({ error: "Invalid input" });
        return;
      }
      console.error("Unhandled API error:", err);
      res.status(500).json({ error: "Server error" });
    }
  };
}

export function methodNotAllowed(res: VercelResponse, allow: string[]): void {
  res.setHeader("Allow", allow.join(", "));
  res.status(405).json({ error: "Method not allowed" });
}
```

- [ ] **Step 10.4: Verify typecheck**

```bash
npm run typecheck:api
```

Expected: exit 0.

- [ ] **Step 10.5: Commit**

```bash
git add api/_db.ts api/_lib
git commit -m "feat(api): centralized env validation and error handler"
```

---

## Task 11: Server pricing module (TDD)

**Files:**

- Create: `server/pricing.ts`
- Create: `tests/unit/pricing.test.ts`
- Create: `vitest.config.ts`

- [ ] **Step 11.1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@server": path.resolve(__dirname, "server"),
    },
  },
});
```

- [ ] **Step 11.2: Write failing tests**

Create `tests/unit/pricing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeQuoteTotals } from "@server/pricing";

describe("computeQuoteTotals", () => {
  const machine = { id: 1, basePrice: "189245.00" };
  const options = [
    { id: 10, machineId: 1, price: "1500.00" },
    { id: 11, machineId: 1, price: "750.50" },
    { id: 12, machineId: 1, price: "0.00" },
  ];

  it("sums basePrice + selected option prices into a numeric-precise string", () => {
    const r = computeQuoteTotals({ machine, allOptions: options, selectedOptionIds: [10, 11] });
    expect(r.basePrice).toBe("189245.00");
    expect(r.optionsTotal).toBe("2250.50");
    expect(r.totalPrice).toBe("191495.50");
  });

  it("returns optionsTotal '0.00' when no options selected", () => {
    const r = computeQuoteTotals({ machine, allOptions: options, selectedOptionIds: [] });
    expect(r.optionsTotal).toBe("0.00");
    expect(r.totalPrice).toBe("189245.00");
  });

  it("throws when a selected option id is not in allOptions", () => {
    expect(() =>
      computeQuoteTotals({ machine, allOptions: options, selectedOptionIds: [10, 999] }),
    ).toThrow(/unknown option/i);
  });

  it("throws when a selected option belongs to a different machine", () => {
    const wrong = [...options, { id: 99, machineId: 2, price: "100.00" }];
    expect(() =>
      computeQuoteTotals({ machine, allOptions: wrong, selectedOptionIds: [99] }),
    ).toThrow(/wrong machine/i);
  });

  it("rejects duplicate option ids", () => {
    expect(() =>
      computeQuoteTotals({ machine, allOptions: options, selectedOptionIds: [10, 10] }),
    ).toThrow(/duplicate/i);
  });
});
```

- [ ] **Step 11.3: Run test, verify failures**

```bash
npm test -- pricing
```

Expected: 5 failures, "Cannot find module '@server/pricing'".

- [ ] **Step 11.4: Implement `server/pricing.ts`**

```ts
type MoneyString = string;

interface PricingMachine {
  id: number;
  basePrice: MoneyString;
}
interface PricingOption {
  id: number;
  machineId: number;
  price: MoneyString;
}

export interface QuoteTotals {
  basePrice: MoneyString;
  optionsTotal: MoneyString;
  totalPrice: MoneyString;
}

function toCents(s: MoneyString): bigint {
  const [whole, frac = "00"] = s.split(".");
  const fracPadded = (frac + "00").slice(0, 2);
  return BigInt(whole) * 100n + BigInt(fracPadded);
}

function fromCents(c: bigint): MoneyString {
  const neg = c < 0n;
  const abs = neg ? -c : c;
  const whole = abs / 100n;
  const frac = abs % 100n;
  const fracStr = frac.toString().padStart(2, "0");
  return `${neg ? "-" : ""}${whole.toString()}.${fracStr}`;
}

export function computeQuoteTotals(input: {
  machine: PricingMachine;
  allOptions: PricingOption[];
  selectedOptionIds: number[];
}): QuoteTotals {
  const { machine, allOptions, selectedOptionIds } = input;

  if (new Set(selectedOptionIds).size !== selectedOptionIds.length) {
    throw new Error("duplicate option ids in selection");
  }

  const byId = new Map(allOptions.map((o) => [o.id, o]));
  let optionsCents = 0n;
  for (const id of selectedOptionIds) {
    const opt = byId.get(id);
    if (!opt) throw new Error(`unknown option id: ${id}`);
    if (opt.machineId !== machine.id) {
      throw new Error(`option ${id} belongs to wrong machine`);
    }
    optionsCents += toCents(opt.price);
  }
  const baseCents = toCents(machine.basePrice);
  const totalCents = baseCents + optionsCents;
  return {
    basePrice: fromCents(baseCents),
    optionsTotal: fromCents(optionsCents),
    totalPrice: fromCents(totalCents),
  };
}
```

- [ ] **Step 11.5: Run tests, verify pass**

```bash
npm test -- pricing
```

Expected: 5 passed.

- [ ] **Step 11.6: Commit**

```bash
git add server/pricing.ts tests/unit/pricing.test.ts vitest.config.ts
git commit -m "feat(server): add computeQuoteTotals with cents-precise arithmetic"
```

---

## Task 12: Origin allowlist + honeypot helpers

**Files:**

- Create: `api/_lib/origin.ts`
- Create: `tests/unit/origin.test.ts`

- [ ] **Step 12.1: Write failing tests**

Create `tests/unit/origin.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isAllowedOrigin } from "../../api/_lib/origin";

describe("isAllowedOrigin", () => {
  const allowed = ["https://trinitybaq.com", "https://www.trinitybaq.com"];

  it("accepts an exact match in Origin", () => {
    expect(isAllowedOrigin({ origin: "https://trinitybaq.com" }, allowed)).toBe(true);
  });

  it("falls back to Referer prefix when Origin is missing", () => {
    expect(isAllowedOrigin({ referer: "https://trinitybaq.com/configure/ax2-16" }, allowed)).toBe(
      true,
    );
  });

  it("rejects any other origin", () => {
    expect(isAllowedOrigin({ origin: "https://evil.example" }, allowed)).toBe(false);
  });

  it("rejects empty headers", () => {
    expect(isAllowedOrigin({}, allowed)).toBe(false);
  });
});
```

- [ ] **Step 12.2: Run test, verify failure**

```bash
npm test -- origin
```

Expected: failures (module not found).

- [ ] **Step 12.3: Implement `api/_lib/origin.ts`**

```ts
export function isAllowedOrigin(
  headers: { origin?: string; referer?: string },
  allowed: string[],
): boolean {
  if (allowed.length === 0) return false;
  if (headers.origin && allowed.includes(headers.origin)) return true;
  if (headers.referer) {
    return allowed.some((a) => headers.referer!.startsWith(a + "/") || headers.referer === a);
  }
  return false;
}
```

- [ ] **Step 12.4: Run tests, verify pass**

```bash
npm test -- origin
```

Expected: 4 passed.

- [ ] **Step 12.5: Commit**

```bash
git add api/_lib/origin.ts tests/unit/origin.test.ts
git commit -m "feat(api): add origin/referer allowlist helper"
```

---

## Task 13: Turnstile server-verify helper

**Files:**

- Create: `api/_lib/turnstile.ts`
- Create: `tests/unit/turnstile.test.ts`

- [ ] **Step 13.1: Write failing tests**

Create `tests/unit/turnstile.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyTurnstile } from "../../api/_lib/turnstile";

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => fetchSpy.mockReset());
afterEach(() => fetchSpy.mockReset());

describe("verifyTurnstile", () => {
  it("returns true when Cloudflare returns success", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    expect(await verifyTurnstile("secret", "token", "1.2.3.4")).toBe(true);
  });

  it("returns false when Cloudflare returns success:false", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }), {
        status: 200,
      }),
    );
    expect(await verifyTurnstile("secret", "token", "1.2.3.4")).toBe(false);
  });

  it("returns false when secret is empty (dev fallback)", async () => {
    expect(await verifyTurnstile("", "token", "1.2.3.4")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns false when token is empty", async () => {
    expect(await verifyTurnstile("secret", "", "1.2.3.4")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns false on network/parse error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("network"));
    expect(await verifyTurnstile("secret", "token", "1.2.3.4")).toBe(false);
  });
});
```

- [ ] **Step 13.2: Run test, verify failure**

```bash
npm test -- turnstile
```

Expected: failures (module not found).

- [ ] **Step 13.3: Implement `api/_lib/turnstile.ts`**

```ts
const ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  secret: string,
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  if (!secret || !token) return false;
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const res = await fetch(ENDPOINT, { method: "POST", body });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("Turnstile verify error:", err);
    return false;
  }
}
```

- [ ] **Step 13.4: Run tests, verify pass**

```bash
npm test -- turnstile
```

Expected: 5 passed.

- [ ] **Step 13.5: Commit**

```bash
git add api/_lib/turnstile.ts tests/unit/turnstile.test.ts
git commit -m "feat(api): add Cloudflare Turnstile server verification"
```

---

## Task 14: Upstash rate limiter

**Files:**

- Create: `api/_lib/rateLimit.ts`
- Create: `tests/unit/rateLimit.test.ts`

- [ ] **Step 14.1: Write failing tests**

Create `tests/unit/rateLimit.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { checkRateLimit } from "../../api/_lib/rateLimit";

describe("checkRateLimit", () => {
  function fakeClient(initial = 0) {
    let count = initial;
    return {
      incr: vi.fn(async () => ++count),
      expire: vi.fn(async () => 1),
    };
  }

  it("allows the first request", async () => {
    const client = fakeClient();
    const r = await checkRateLimit(client, "1.2.3.4", 5, 60);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
    expect(client.incr).toHaveBeenCalledOnce();
  });

  it("rejects when count exceeds the limit", async () => {
    const client = fakeClient(5);
    const r = await checkRateLimit(client, "1.2.3.4", 5, 60);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("only sets expire on the first hit", async () => {
    const client = fakeClient();
    await checkRateLimit(client, "1.2.3.4", 5, 60);
    await checkRateLimit(client, "1.2.3.4", 5, 60);
    expect(client.expire).toHaveBeenCalledOnce();
  });

  it("fails open when client is null (Upstash unconfigured)", async () => {
    const r = await checkRateLimit(null, "1.2.3.4", 5, 60);
    expect(r.allowed).toBe(true);
  });
});
```

- [ ] **Step 14.2: Run test, verify failure**

```bash
npm test -- rateLimit
```

Expected: failures.

- [ ] **Step 14.3: Implement `api/_lib/rateLimit.ts`**

```ts
import { Redis } from "@upstash/redis";
import { env } from "./env";

interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

let cachedClient: RedisLike | null | undefined;

export function getRateLimitClient(): RedisLike | null {
  if (cachedClient !== undefined) return cachedClient;
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    cachedClient = null;
    return null;
  }
  cachedClient = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return cachedClient;
}

export async function checkRateLimit(
  client: RedisLike | null,
  ip: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  if (!client) return { allowed: true, remaining: limit };
  const key = `ratelimit:quotes:${ip}`;
  try {
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, windowSeconds);
    const remaining = Math.max(0, limit - count);
    return { allowed: count <= limit, remaining };
  } catch (err) {
    console.error("Rate limit error (failing open):", err);
    return { allowed: true, remaining: limit };
  }
}
```

- [ ] **Step 14.4: Run tests, verify pass**

```bash
npm test -- rateLimit
```

Expected: 4 passed.

- [ ] **Step 14.5: Commit**

```bash
git add api/_lib/rateLimit.ts tests/unit/rateLimit.test.ts
git commit -m "feat(api): add Upstash-backed per-IP rate limiter"
```

---

## Task 15: Resend email helper

**Files:**

- Create: `api/_lib/email.ts`
- Create: `tests/unit/email.test.ts`

- [ ] **Step 15.1: Write failing tests**

Create `tests/unit/email.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { renderQuoteEmail } from "../../api/_lib/email";

describe("renderQuoteEmail", () => {
  it("renders subject + html with quote details", () => {
    const r = renderQuoteEmail({
      quoteNumber: "Q-2026-0001",
      machineName: "AX2-16",
      totalPrice: "191495.50",
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
      customerCompany: "Acme",
      customerPhone: "555-0100",
      summaryUrl: "https://trinitybaq.com/quote/Q-2026-0001",
    });
    expect(r.subject).toMatch(/AX2-16/);
    expect(r.subject).toMatch(/\$191,?495\.50/);
    expect(r.html).toMatch(/Jane Doe/);
    expect(r.html).toMatch(/Q-2026-0001/);
    expect(r.html).toMatch(/jane@example\.com/);
    expect(r.text).toMatch(/Q-2026-0001/);
  });

  it("handles optional company/phone gracefully", () => {
    const r = renderQuoteEmail({
      quoteNumber: "Q-2026-0002",
      machineName: "Ai Part Loader",
      totalPrice: "115900.00",
      customerName: "Bob",
      customerEmail: "bob@example.com",
      customerCompany: null,
      customerPhone: null,
      summaryUrl: "https://trinitybaq.com/quote/Q-2026-0002",
    });
    expect(r.html).not.toMatch(/null/);
    expect(r.text).not.toMatch(/null/);
  });
});
```

- [ ] **Step 15.2: Run test, verify failure**

```bash
npm test -- email
```

Expected: failures.

- [ ] **Step 15.3: Implement `api/_lib/email.ts`**

```ts
import { Resend } from "resend";
import { env } from "./env";

export interface QuoteEmailInput {
  quoteNumber: string;
  machineName: string;
  totalPrice: string;
  customerName: string;
  customerEmail: string;
  customerCompany: string | null;
  customerPhone: string | null;
  summaryUrl: string;
}

function fmtMoney(s: string): string {
  const [whole, frac = "00"] = s.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${frac}`;
}

export function renderQuoteEmail(q: QuoteEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const total = fmtMoney(q.totalPrice);
  const subject = `New Trinity quote — ${q.machineName} — ${total}`;
  const company = q.customerCompany ? `<br>${q.customerCompany}` : "";
  const phone = q.customerPhone ? `<br>${q.customerPhone}` : "";
  const html = `
    <h2>New quote: ${q.quoteNumber}</h2>
    <p><strong>${q.machineName}</strong> — ${total}</p>
    <h3>Customer</h3>
    <p>${q.customerName}<br>${q.customerEmail}${company}${phone}</p>
    <p><a href="${q.summaryUrl}">View quote summary</a></p>
  `.trim();
  const text =
    `New quote: ${q.quoteNumber}\n` +
    `${q.machineName} — ${total}\n\n` +
    `${q.customerName}\n${q.customerEmail}\n` +
    `${q.customerCompany ?? ""}\n${q.customerPhone ?? ""}\n\n` +
    `${q.summaryUrl}`;
  return { subject, html, text };
}

let cachedResend: Resend | null | undefined;
function getResend(): Resend | null {
  if (cachedResend !== undefined) return cachedResend;
  if (!env.RESEND_API_KEY) {
    cachedResend = null;
    return null;
  }
  cachedResend = new Resend(env.RESEND_API_KEY);
  return cachedResend;
}

export async function sendQuoteEmail(q: QuoteEmailInput): Promise<void> {
  const client = getResend();
  if (!client || !env.LEAD_NOTIFICATION_TO) {
    console.warn("Resend not configured; skipping lead notification");
    return;
  }
  const { subject, html, text } = renderQuoteEmail(q);
  const recipients = env.LEAD_NOTIFICATION_TO.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    const result = await client.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: recipients,
      subject,
      html,
      text,
    });
    if (result.error) console.error("Resend send error:", result.error);
  } catch (err) {
    console.error("Resend send threw:", err);
  }
}
```

- [ ] **Step 15.4: Run tests, verify pass**

```bash
npm test -- email
```

Expected: 2 passed.

- [ ] **Step 15.5: Commit**

```bash
git add api/_lib/email.ts tests/unit/email.test.ts
git commit -m "feat(api): add Resend lead notification helper"
```

---

## Task 16: Fix N+1 in options endpoint + narrow errors + slug validation

**Files:**

- Modify: `api/machines.ts`, `api/machines/[id].ts`, `api/machines/[id]/options.ts`, `api/quotes/[quoteNumber].ts`

- [ ] **Step 16.1: Replace `api/machines.ts`**

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_db";
import { machines } from "../shared/schema";
import { withErrorHandling, methodNotAllowed } from "./_lib/handler";

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const all = await db.select().from(machines);
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(200).json(all);
});
```

- [ ] **Step 16.2: Replace `api/machines/[id].ts`**

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../_db";
import { machines } from "../../shared/schema";
import { withErrorHandling, methodNotAllowed, HttpError } from "../_lib/handler";

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const { id } = req.query;
  const slug = typeof id === "string" ? id : undefined;
  if (!slug || !SLUG_RE.test(slug)) throw new HttpError(400, "Invalid slug");
  const [m] = await db.select().from(machines).where(eq(machines.slug, slug)).limit(1);
  if (!m) throw new HttpError(404, "Not found");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(200).json(m);
});
```

- [ ] **Step 16.3: Replace `api/machines/[id]/options.ts` (kills the N+1)**

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../_db";
import { machines, optionCategories, options } from "../../../shared/schema";
import { withErrorHandling, methodNotAllowed, HttpError } from "../../_lib/handler";

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const { id } = req.query;
  const slug = typeof id === "string" ? id : undefined;
  if (!slug || !SLUG_RE.test(slug)) throw new HttpError(400, "Invalid slug");

  const [machine] = await db.select().from(machines).where(eq(machines.slug, slug)).limit(1);
  if (!machine) throw new HttpError(404, "Not found");

  const categories = await db
    .select()
    .from(optionCategories)
    .where(eq(optionCategories.machineId, machine.id))
    .orderBy(optionCategories.sortOrder);

  if (categories.length === 0) {
    res.status(200).json([]);
    return;
  }

  const allOpts = await db
    .select()
    .from(options)
    .where(
      inArray(
        options.categoryId,
        categories.map((c) => c.id),
      ),
    )
    .orderBy(options.sortOrder);

  const grouped = categories.map((c) => ({
    ...c,
    options: allOpts.filter((o) => o.categoryId === c.id),
  }));

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.status(200).json(grouped);
});
```

- [ ] **Step 16.4: Replace `api/quotes/[quoteNumber].ts`**

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../_db";
import { quotes } from "../../shared/schema";
import { withErrorHandling, methodNotAllowed, HttpError } from "../_lib/handler";

const QUOTE_NUM_RE = /^[A-Za-z0-9-]{1,64}$/;

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const { quoteNumber } = req.query;
  const qn = typeof quoteNumber === "string" ? quoteNumber : undefined;
  if (!qn || !QUOTE_NUM_RE.test(qn)) throw new HttpError(400, "Invalid quote number");
  const [q] = await db.select().from(quotes).where(eq(quotes.quoteNumber, qn)).limit(1);
  if (!q) throw new HttpError(404, "Not found");
  res.status(200).json(q);
});
```

- [ ] **Step 16.5: Verify**

```bash
npm run check
npm test
```

Expected: both green.

- [ ] **Step 16.6: Commit**

```bash
git add api/machines.ts "api/machines/[id].ts" "api/machines/[id]/options.ts" "api/quotes/[quoteNumber].ts"
git commit -m "feat(api): narrow errors, validate slugs, fix N+1, add cache headers"
```

---

## Task 17: Rewrite POST /api/quotes (the centerpiece)

**Files:**

- Modify: `api/quotes.ts`
- Create: `tests/unit/quoteHandler.test.ts`

- [ ] **Step 17.1: Write the failing test (handler logic, mocked deps)**

We test the **pure handler logic** — Origin allowlist, honeypot drop, payload validation, computeQuoteTotals integration — by extracting the request-validation core into a pure function.

Create `tests/unit/quoteHandler.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateQuotePayload } from "../../api/_lib/quotePayload";

describe("validateQuotePayload", () => {
  const base = {
    machineId: 1,
    selectedOptionIds: [10, 11],
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    customerCompany: null,
    customerPhone: null,
    financingParams: null,
    roiParams: null,
    website: "",
    turnstileToken: "tok",
  };

  it("accepts a valid payload", () => {
    const r = validateQuotePayload(base);
    expect(r.success).toBe(true);
  });

  it("rejects bad email", () => {
    const r = validateQuotePayload({ ...base, customerEmail: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("rejects missing machineId", () => {
    const r = validateQuotePayload({ ...base, machineId: undefined });
    expect(r.success).toBe(false);
  });

  it("rejects empty selectedOptionIds (always at least 0 is fine; empty array OK)", () => {
    const r = validateQuotePayload({ ...base, selectedOptionIds: [] });
    expect(r.success).toBe(true);
  });

  it("rejects non-string honeypot", () => {
    const r = validateQuotePayload({ ...base, website: 123 });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 17.2: Create `api/_lib/quotePayload.ts`**

```ts
import { z } from "zod";
import { FinancingParamsSchema, RoiParamsSchema } from "../../shared/zodTypes";

export const QuotePayloadSchema = z.object({
  machineId: z.number().int().positive(),
  selectedOptionIds: z.array(z.number().int().positive()),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email().max(254),
  customerCompany: z.string().max(200).nullable().optional(),
  customerPhone: z.string().max(50).nullable().optional(),
  financingParams: FinancingParamsSchema.nullable().optional(),
  roiParams: RoiParamsSchema.nullable().optional(),
  website: z.string(), // honeypot, expected empty
  turnstileToken: z.string().min(1),
});

export type QuotePayload = z.infer<typeof QuotePayloadSchema>;

export function validateQuotePayload(
  body: unknown,
): { success: true; data: QuotePayload } | { success: false } {
  const r = QuotePayloadSchema.safeParse(body);
  return r.success ? { success: true, data: r.data } : { success: false };
}
```

- [ ] **Step 17.3: Run test, verify pass**

```bash
npm test -- quoteHandler
```

Expected: 5 passed.

- [ ] **Step 17.4: Implement quote-number generator helper**

Append to `api/_lib/quotePayload.ts`:

```ts
export function generateQuoteNumber(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `Q-${yyyy}-${rand}`;
}
```

- [ ] **Step 17.5: Replace `api/quotes.ts` with the full pipeline**

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, inArray } from "drizzle-orm";
import { db } from "./_db";
import { machines, options, quotes } from "../shared/schema";
import { env } from "./_lib/env";
import { withErrorHandling, methodNotAllowed, HttpError } from "./_lib/handler";
import { isAllowedOrigin } from "./_lib/origin";
import { verifyTurnstile } from "./_lib/turnstile";
import { checkRateLimit, getRateLimitClient } from "./_lib/rateLimit";
import { sendQuoteEmail } from "./_lib/email";
import { validateQuotePayload, generateQuoteNumber } from "./_lib/quotePayload";
import { computeQuoteTotals } from "../server/pricing";

function getClientIp(req: VercelRequest): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0].trim();
  if (Array.isArray(xff) && xff.length) return xff[0].split(",")[0].trim();
  return req.socket?.remoteAddress ?? "0.0.0.0";
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  // 1. Origin allowlist
  const ok = isAllowedOrigin(
    {
      origin: typeof req.headers.origin === "string" ? req.headers.origin : undefined,
      referer: typeof req.headers.referer === "string" ? req.headers.referer : undefined,
    },
    env.ALLOWED_ORIGINS,
  );
  if (!ok) throw new HttpError(403, "Forbidden");

  // 2. Schema
  const parsed = validateQuotePayload(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid input");
  const p = parsed.data;

  // 3. Honeypot — silent success on hit
  if (p.website && p.website.trim() !== "") {
    console.warn("Honeypot triggered, dropping quote", { ip: getClientIp(req) });
    res.status(200).json({ ok: true });
    return;
  }

  // 4. Turnstile
  const ip = getClientIp(req);
  const turnstileOk = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, p.turnstileToken, ip);
  if (!turnstileOk) throw new HttpError(400, "Verification failed");

  // 5. Rate limit
  const rateClient = getRateLimitClient();
  const rl = await checkRateLimit(rateClient, ip, 5, 60);
  if (!rl.allowed) {
    res.setHeader("Retry-After", "60");
    throw new HttpError(429, "Too many requests");
  }

  // 6. Look up machine
  const [machine] = await db.select().from(machines).where(eq(machines.id, p.machineId)).limit(1);
  if (!machine) throw new HttpError(400, "Invalid input");

  // 7. Look up + validate every option
  const opts =
    p.selectedOptionIds.length > 0
      ? await db.select().from(options).where(inArray(options.id, p.selectedOptionIds))
      : [];
  if (opts.length !== p.selectedOptionIds.length) throw new HttpError(400, "Invalid input");
  for (const o of opts) {
    if (o.machineId !== machine.id) throw new HttpError(400, "Invalid input");
  }

  // 8. Recompute totals on the server
  const totals = computeQuoteTotals({
    machine: { id: machine.id, basePrice: machine.basePrice },
    allOptions: opts.map((o) => ({ id: o.id, machineId: o.machineId, price: o.price })),
    selectedOptionIds: p.selectedOptionIds,
  });

  // 9. Insert
  const quoteNumber = generateQuoteNumber();
  const [inserted] = await db
    .insert(quotes)
    .values({
      quoteNumber,
      machineId: machine.id,
      machineName: machine.name,
      customerName: p.customerName,
      customerEmail: p.customerEmail,
      customerCompany: p.customerCompany ?? null,
      customerPhone: p.customerPhone ?? null,
      selectedOptions: JSON.stringify(
        opts.map((o) => ({
          id: o.id,
          categoryId: o.categoryId,
          name: o.name,
          price: o.price,
        })),
      ),
      basePrice: totals.basePrice,
      optionsTotal: totals.optionsTotal,
      totalPrice: totals.totalPrice,
      financingParams: p.financingParams ? JSON.stringify(p.financingParams) : null,
      roiParams: p.roiParams ? JSON.stringify(p.roiParams) : null,
    })
    .returning();

  // 10. Fire-and-forget email (do not await blocking the response)
  void sendQuoteEmail({
    quoteNumber: inserted.quoteNumber,
    machineName: inserted.machineName,
    totalPrice: inserted.totalPrice,
    customerName: inserted.customerName,
    customerEmail: inserted.customerEmail,
    customerCompany: inserted.customerCompany,
    customerPhone: inserted.customerPhone,
    summaryUrl: `https://trinitybaq.com/quote/${inserted.quoteNumber}`,
  }).catch((err) => console.error("Email task error:", err));

  // 11. Respond
  res.status(201).json({ quoteNumber: inserted.quoteNumber });
});
```

- [ ] **Step 17.6: Verify typecheck and tests**

```bash
npm run check
npm test
```

Expected: both green.

- [ ] **Step 17.7: Commit**

```bash
git add api/quotes.ts api/_lib/quotePayload.ts tests/unit/quoteHandler.test.ts
git commit -m "feat(api): public-flow hardened POST /api/quotes (origin, honeypot, turnstile, rate limit, server-recompute, resend)"
```

---

## Task 18: Wire Turnstile + honeypot into the quote form (frontend)

**Files:**

- Modify: `client/index.html`
- Modify: `client/src/pages/configurator.tsx`
- Create: `client/src/components/TurnstileWidget.tsx`

- [ ] **Step 18.1: Load the Turnstile script**

Edit `client/index.html`. Add this `<script>` tag after the existing fontshare link:

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

- [ ] **Step 18.2: Create `client/src/components/TurnstileWidget.tsx`**

```tsx
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

interface Props {
  onToken: (token: string) => void;
  onError?: () => void;
}

export function TurnstileWidget({ onToken, onError }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
    if (!ref.current || !sitekey) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || !ref.current) return;
      widgetIdRef.current = window.turnstile.render(ref.current, {
        sitekey,
        callback: (t) => onToken(t),
        "error-callback": () => onError?.(),
        "expired-callback": () => onError?.(),
        appearance: "interaction-only",
        theme: "dark",
      });
    };
    if (window.turnstile) render();
    else {
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          render();
        }
      }, 100);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    };
  }, [onToken, onError]);

  return <div ref={ref} />;
}
```

- [ ] **Step 18.3: Modify `configurator.tsx` quote submission**

Open `client/src/pages/configurator.tsx`. Find the `quoteMutation` block (around lines 254–275 per the audit).

A. Add this import at the top of the file:

```tsx
import { TurnstileWidget } from "@/components/TurnstileWidget";
```

B. Add state inside the component (near the other `useState` calls for the form):

```tsx
const [turnstileToken, setTurnstileToken] = useState<string>("");
const [honeypot, setHoneypot] = useState<string>("");
```

C. Replace the `apiRequest("POST", "/api/quotes", { ... })` body (the object passed as the third arg) with:

```tsx
{
  machineId: machine.id,
  selectedOptionIds: selectedOpts.map((o) => o.id),
  customerName: formData.name,
  customerEmail: formData.email,
  customerCompany: formData.company || null,
  customerPhone: formData.phone || null,
  financingParams: financingParamsForServer,  // see step 18.4 below
  roiParams: roiParamsForServer,              // see step 18.4 below
  website: honeypot,
  turnstileToken,
}
```

Remove `quoteNumber`, `machineName`, `selectedOptions`, `basePrice`, `optionsTotal`, `totalPrice` from the request body — they are now server-computed.

D. Update the success handler (near line 270) — the API now returns `{ quoteNumber }`, so the existing `setLocation('/quote/...')` line should change to:

```tsx
onSuccess: (data: { quoteNumber: string }) => {
  setLocation(`/quote/${data.quoteNumber}`);
  setShowQuoteModal(false);
},
```

E. In the JSX where the customer info form is rendered (the modal that pops before submission), add **right above the submit button**:

```tsx
{/* honeypot — hidden from users */}
<input
  type="text"
  name="website"
  value={honeypot}
  onChange={(e) => setHoneypot(e.target.value)}
  tabIndex={-1}
  autoComplete="off"
  aria-hidden="true"
  style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", opacity: 0 }}
/>

<TurnstileWidget onToken={setTurnstileToken} onError={() => setTurnstileToken("")} />
```

F. Disable the submit button until `turnstileToken` is non-empty:

```tsx
<Button type="submit" disabled={quoteMutation.isPending || !turnstileToken}>
  {quoteMutation.isPending ? "Submitting..." : "Get Quote"}
</Button>
```

- [ ] **Step 18.4: Pass financing + ROI params as objects, not strings**

Search `configurator.tsx` for where `financingParams` and `roiParams` are stringified before submission. They're now sent as objects (the API parses with Zod). Define these locally before the mutation call:

```tsx
const financingParamsForServer = financingState
  ? {
      downPayment: Number(financingState.downPayment),
      termMonths: Number(financingState.termMonths),
      apr: Number(financingState.apr),
      monthlyPayment: Number(financingState.monthlyPayment ?? 0),
    }
  : null;

const roiParamsForServer = {
  shopRate: roi.shopRate,
  hrsPerShift: roi.hrsPerShift,
  operatorWage: roi.operatorWage,
  workingDays: roi.workingDays,
  mannedShifts: roi.mannedShifts,
  unmannedShifts: roi.unmannedShifts,
  mannedUtilBefore: roi.mannedUtilBefore,
  mannedUtilAfter: roi.mannedUtilAfter,
  unmannedUtilBefore: roi.unmannedUtilBefore,
  unmannedUtilAfter: roi.unmannedUtilAfter,
};
```

Adjust property names if the existing variables differ.

- [ ] **Step 18.5: Verify build**

```bash
npm run check && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

Expected: both succeed.

- [ ] **Step 18.6: Commit**

```bash
git add client/index.html client/src/components/TurnstileWidget.tsx client/src/pages/configurator.tsx
git commit -m "feat(client): add Turnstile widget + honeypot to quote form, drop client-supplied prices"
```

---

## Task 19: Update GET /api/quotes/:quoteNumber consumers

The quote-summary page reads back the saved quote. The schema field shape is unchanged for the page's consumption (it still gets `selectedOptions`, `basePrice`, etc.), but `selectedOptions` is now server-rebuilt. Verify the summary page still renders.

**Files:**

- Inspect: `client/src/pages/quote-summary.tsx`
- Modify only if a field name mismatches.

- [ ] **Step 19.1: Read the page**

```bash
grep -nE "JSON\.parse\(.*selectedOptions" client/src/pages/quote-summary.tsx
```

Expected: a line that parses `quote.selectedOptions`. The shape we now write is `[{id, categoryId, name, price}]` — confirm the page reads `name` and `price`. If it expects different keys, adjust the page accordingly.

- [ ] **Step 19.2: Wrap the parse in `safeParse`**

If the page uses a naked `JSON.parse(quote.selectedOptions)`, replace with a defensive parse:

```tsx
const selectedOptions = (() => {
  try {
    return JSON.parse(quote.selectedOptions) as Array<{
      id: number;
      categoryId: number;
      name: string;
      price: string;
    }>;
  } catch {
    return [];
  }
})();
```

- [ ] **Step 19.3: Verify build**

```bash
npm run check && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

- [ ] **Step 19.4: Commit (only if changes were needed)**

```bash
git add client/src/pages/quote-summary.tsx
git commit -m "refactor(client): defensive JSON.parse for selectedOptions on quote summary"
```

(If no changes were needed, skip this commit.)

---

## Task 20: Deploy preview and verify the full pipeline

**Files:** none (deploy + verify)

- [ ] **Step 20.1: Push to a preview branch**

```bash
git checkout -b hardening-plan-1
git push -u origin hardening-plan-1
```

Vercel auto-builds a preview. Wait for the deploy URL (the dashboard or `vercel ls`).

- [ ] **Step 20.2: Add the preview URL to `ALLOWED_ORIGINS` (preview env)**

Run:

```bash
vercel env rm ALLOWED_ORIGINS preview --yes
vercel env add ALLOWED_ORIGINS preview
# value: https://trinitybaq.com,https://www.trinitybaq.com,https://<preview-deploy-url>
```

Re-deploy: `vercel --prod=false`.

- [ ] **Step 20.3: Smoke-test the preview**

In a real browser:

1. Navigate to the preview URL.
2. Pick AX2-16. Add a couple of options.
3. Open dev tools → Network. Submit the quote form with valid info.
4. Confirm `POST /api/quotes` returns **201** with `{ quoteNumber }`.
5. Go to the lead notification inbox; confirm an email arrived from `RESEND_FROM_EMAIL`.
6. In the dev-tools Network tab, retry the same submission 6 times within 60 seconds; confirm the 6th returns **429**.
7. Manually craft a `curl` against the preview's `/api/quotes` from your terminal (no browser Origin) — should return **403**:
   ```bash
   curl -i -X POST https://<preview>.vercel.app/api/quotes \
     -H "content-type: application/json" \
     -d '{"machineId":1,"selectedOptionIds":[],"customerName":"x","customerEmail":"a@b.co","website":"","turnstileToken":"x"}'
   ```
8. From a `curl` with `-H "Origin: https://trinitybaq.com"` and a bogus turnstile token: expect **400**.
9. Submit with `website: "fishbait"` (valid Origin + Turnstile bypassed locally only if you configured a test secret) → expect **200** but **no DB row** (verify in Supabase).
10. Submit with `totalPrice` field included in the body — confirm the server ignores it (the schema doesn't have that field, so it's silently dropped, but the stored total comes from the DB).

- [ ] **Step 20.4: Verify the schema in production matches**

Skip if Task 9 already ran on production.

- [ ] **Step 20.5: Merge to main**

```bash
git checkout main
git merge --no-ff hardening-plan-1
git push origin main
```

Vercel auto-promotes to production. Verify https://trinitybaq.com/api/machines still returns the catalog.

- [ ] **Step 20.6: Final live verification**

```bash
curl -s https://trinitybaq.com/api/machines | head -c 200
curl -i -X POST https://trinitybaq.com/api/quotes \
  -H "content-type: application/json" \
  -H "Origin: https://evil.example" \
  -d '{}'
```

Expected: first command returns 200 + JSON; second returns **403**.

- [ ] **Step 20.7: Smoke-test the live form end-to-end**

Submit a real quote on https://trinitybaq.com from a browser. Confirm:

- 201 response.
- Lead email lands in `LEAD_NOTIFICATION_TO`.
- Row appears in `quotes` with `total_price` matching the displayed total to the cent.
- Replaying a saved request via curl from a different IP returns 429 after 5 hits.

- [ ] **Step 20.8: Tag**

```bash
git tag -a v1.1.0 -m "Hardening Plan 1: public-flow protection + schema overhaul"
git push origin v1.1.0
```

---

## Self-Review

(Performed at write time, fixed inline.)

**Spec coverage:**

- Server-recomputed pricing — Tasks 11, 17 ✅
- Machine + option ID validation — Task 17 ✅
- Origin/Referer — Tasks 12, 17 ✅
- Honeypot — Tasks 17, 18 ✅
- Turnstile (server verify + client widget) — Tasks 13, 17, 18 ✅
- Per-IP rate limit — Tasks 14, 17 ✅
- Resend lead emails — Tasks 15, 17 ✅
- Schema FKs/indexes/numeric/timestamps — Task 9 ✅
- Drizzle migrations replacing push — Tasks 8, 9, 3 (script change) ✅
- Narrow error responses — Tasks 10, 16, 17 ✅
- Slug regex validation — Task 16 ✅
- N+1 fix + cache headers — Task 16 ✅
- `.vercel` brochure leak — Task 1 ✅
- `.env.example` restoration — Task 2 ✅
- Supabase password rotation — Task 0 ✅
- Engines + scripts + tooling baseline — Tasks 3, 5, 6, 7 ✅
- Configurator decomposition, frontend reliability bugs, performance/bundle, full e2e — **deferred to Plan 2**

**Placeholders:** none.

**Type/name consistency:** `computeQuoteTotals` signature is the same in Tasks 11, 17. `validateQuotePayload` shape consistent in 17, 18. `TurnstileWidget` props match across 18.2, 18.3.
