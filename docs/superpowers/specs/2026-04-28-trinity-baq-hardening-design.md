# Trinity BAQ — Public-Flow Hardening

**Date:** 2026-04-28
**Project:** trinity-quote-vercel (deployed at https://trinitybaq.com)
**Status:** Approved scope — pending implementation plan
**Companion docs:**
- `docs/superpowers/specs/2026-04-28-trinity-baq-seo-design.md` (SEO migration; separate effort)

## Context

A full enterprise audit of the project on 2026-04-28 surfaced 8 CRITICAL, 14 HIGH, 13 MEDIUM, and 13 LOW issues across security, data integrity, reliability, architecture, performance, testing, and documentation. The site is functional today (build green, typecheck green, live), but several fundamentals fail a serious technical review: client-trusted pricing on quote submission, an unauthenticated public write endpoint, no foreign keys or indexes, money stored as floats, no migrations (production runs `drizzle-kit push`), a stray `.vercel/project.json` inside `client/public/brochures/`, no tests, no CI, and a 1,100-LOC configurator monolith.

This spec covers the hardening work to address those findings **without changing the public lead-gen nature of the product**. There are no logins, no user accounts, no admin portal, no sessions, no roles, no gating. A customer must still be able to land on the site, build a quote, and submit — fast — without creating an account.

## Goals

1. Make `POST /api/quotes` safe for the public internet: server-recomputed pricing, validated machine/option IDs, bot/spam-resistant, rate-limited, with safe errors that don't leak internals.
2. Make the database schema enterprise-grade: foreign keys with cascade, indexes on FK columns, `numeric(10,2)` for money, real timestamps, validated JSON columns.
3. Replace `drizzle-kit push` with proper migrations.
4. Wire a transactional email (Resend) so every submitted quote produces a real lead notification from the Trinity domain.
5. Fix the audit's reliability bugs: configurator blank-on-direct-load, theme-provider dead branch, PDF export silent failure, unguarded ROI inputs, naked `JSON.parse` of `machine.specs`.
6. Cut bundle size and front-end bloat: dynamic-import the PDF stack, delete the 34 unused shadcn UI components, fix the N+1 options query, cache static API responses.
7. Decompose the 1,100-LOC `configurator.tsx` into testable feature modules.
8. Add ESLint, Prettier, Vitest, Playwright, and a minimal CI pipeline.
9. Restore `.env.example`, fix the README onboarding flow, document architecture and deployment.
10. Stop shipping `client/public/brochures/.vercel/` into the build output. Rotate the Supabase database password.

## Non-goals

**Explicit, in-stone:**

- No customer login, no account creation, no email verification before quote.
- No sales-rep login, no admin portal, no internal dashboard, no role-based access control.
- No session cookies for users. No gated routes. No password flows.
- No CRM features. No quote-history-by-account. No saved configurations per user.
- No `Authorization` header, no API key embedded in client JS, no JWTs in browser storage.

The Build-a-Quote tool stays a public lead-gen surface end-to-end.

**Also out of scope (deferred):**

- SEO / static prerender migration (separate spec, already approved).
- Marketing/landing-page content around CNC search intent.
- Migration to Next.js.
- Image optimization beyond compressing brochure PDFs.

## Architecture: protecting a public write endpoint

The submit flow is a single round-trip from a public form. Protection is layered, all of it server-side and invisible to humans:

1. **Origin/Referer allowlist.** Accept submissions only when the request originates from `https://trinitybaq.com` or a Vercel preview deployment under the project. Else `403`.
2. **Honeypot.** A hidden `<input name="website">` is added to the quote form. Real users never fill it; most form-spam bots do. If non-empty, the server returns `200` (so the bot reports success) but never writes to the DB.
3. **Cloudflare Turnstile.** Managed mode: invisible to ~95% of users, transparent challenge to suspect ones, no checkbox for the rest. The client widget produces a token; the server `POST`s it to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with the secret. Reject on failure or missing token. The site key is public; the secret stays in `TURNSTILE_SECRET_KEY` (Vercel env var).
4. **Per-IP rate limit.** 5 quotes/min/IP via Upstash Redis (Vercel-native KV is also fine; Upstash is recommended because the existing Selway Market Data project may already have it provisioned). Identifier: `x-forwarded-for` first IP. Quiet `429` with `Retry-After`.
5. **Server-side price recomputation.** The DB is the source of truth. The endpoint:
   - Looks up the machine by `machineId`. `400` if missing.
   - Looks up every option ID in `selectedOptionIds`. `400` if any missing OR if `option.machineId !== machineId`.
   - Computes `basePrice = machine.basePrice` and `optionsTotal = Σ option.price`, then `totalPrice = basePrice + optionsTotal`.
   - **Stores server-computed values only.** Ignores any totals the client sent.
6. **Safe error handling.** Catch blocks map: ZodError → `400 {error: "Invalid input"}`; everything else → `500 {error: "Server error"}`. Full detail goes to `console.error` (Vercel logs). No Zod paths, no pg constraint names, no stack traces returned to clients.
7. **Lead notification.** On successful insert, fire (in parallel, not blocking the HTTP response) a Resend email to the configured sales inbox(es) with quote number, machine, total, customer contact info, and a link to view the quote summary page.

The complete request flow:

```
POST /api/quotes
  body: {
    machineId, selectedOptionIds[],
    customerName, customerEmail, customerCompany?, customerPhone?,
    financingParams?, roiParams?,
    "website" (honeypot, must be empty),
    turnstileToken
  }

Server pipeline:
  1. Origin/Referer check                  → 403 if mismatch
  2. Body schema (Zod)                     → 400 if invalid
  3. Honeypot check                        → 200 silent if filled (logged)
  4. Turnstile siteverify                  → 400 if fails
  5. Rate limit (Upstash, 5/min/IP)        → 429 if exceeded
  6. Look up machine                       → 400 if missing
  7. Look up + validate every optionId     → 400 if any orphan / wrong machine
  8. Recompute basePrice/optionsTotal/totalPrice
  9. INSERT quote (server values only)
 10. Fire-and-forget Resend email          (errors logged, not surfaced)
 11. Return 201 { quoteNumber }
```

## Schema overhaul

Single migration `0001_init.sql` (generated from the new `shared/schema.ts`, applied once via `drizzle-kit migrate`):

- `machines`, `optionCategories`, `options`: add `id` PK as before, but add `.references()` clauses with `onDelete: "cascade"` on `optionCategories.machineId`, `options.categoryId`, `options.machineId`.
- Add indexes: `idx_option_categories_machine_id`, `idx_options_category_id`, `idx_options_machine_id`.
- `quotes.basePrice`, `optionsTotal`, `totalPrice`: change from `doublePrecision` to `numeric(10,2)`.
- `quotes.createdAt`: change from `text` to `timestamp().notNull().defaultNow()`. Add `updatedAt: timestamp().notNull().defaultNow()` with an `ON UPDATE` trigger or `$onUpdate(() => new Date())`.
- `quotes.selectedOptions`: keep as text-stored JSON for now, but add a strict Zod schema (`SelectedOptionsSchema`) parsed and validated on every read in the API and on every write before insert. Same treatment for `financingParams` and `roiParams`.
- `machines.specs`: same Zod-on-read pattern (`MachineSpecsSchema`).

Migration sequence (zero-downtime, performed against a fresh Supabase point-in-time snapshot first):
1. Generate `0001_init.sql`.
2. Run on staging branch / preview Supabase project.
3. Spot-check existing data: float→numeric cast preserves values to 2 decimal places (existing prices are whole-dollar integers per seed data), text→timestamp cast requires `using created_at::timestamp` if the existing strings are ISO; otherwise a backfill query.
4. Take production Supabase backup.
5. Apply on production. Replace `npm run db:push` with `npm run db:generate` + `npm run db:migrate`. Document `db:push` as forbidden in production.

## Lead notifications via Resend

- Add `RESEND_API_KEY` to Vercel env. Add `LEAD_NOTIFICATION_TO` (comma-separated list).
- Verify the Trinity domain in Resend (`trinityautomation.com` or a subdomain like `mail.trinitybaq.com`). DNS records (DKIM, SPF, DMARC) added at the domain registrar.
- Email payload: from `quotes@<verified-domain>`, subject `New Trinity quote — {machine} — ${total}`, plain-text + HTML body with quote number, machine, total, customer fields, and a link to `https://trinitybaq.com/quote/{quoteNumber}`.
- Send is **non-blocking**: kicked off after the `INSERT` returns, awaited only for log purposes; failure logs but does not affect the API response. Customers should not see a 500 because of email infrastructure.

## Reliability fixes (front-end)

- `client/src/components/theme-provider.tsx:12` — change `? "dark" : "dark"` to `? "dark" : "light"`. Throw from `useTheme` if used outside the provider.
- `client/src/pages/configurator.tsx:307-308` — replace `if (!machine || !categories || !parsedMachine) return null;` with explicit branches: render `<NotFound />` if machine is missing, render an error card if categories failed, render the loading skeleton while either is in flight. No more blank screens on direct load.
- `client/src/pages/machine-selector.tsx:120` — replace `JSON.parse(machine.specs)` with `safeParse<MachineSpecs>(machine.specs, {})`. Same treatment anywhere `JSON.parse` is called on DB-sourced text.
- `client/src/lib/pdf-export.ts:41-50` — when `.prop` or `.page` containers are missing, throw an error so the calling component's catch fires; that catch shows a toast and resets the loading state.
- `client/src/pages/configurator.tsx:82-89` and the corresponding numeric inputs — clamp `shopRate`, `hrsPerShift`, `operatorWage`, `workingDays`, `mannedShifts`, `unmannedShifts` to sensible ranges; reject negatives.

## Performance fixes

- `api/machines/[id]/options.ts:24-29` — replace the per-category `Promise.all` of separate selects with a single `db.select().from(options).where(inArray(options.categoryId, ids))` and group in JS.
- `api/machines.ts` and `api/machines/[slug].ts` — return `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`. Machine catalog changes infrequently; this also cushions cold-start latency.
- `client/src/lib/pdf-export.ts` — make this module dynamic-import-only. The proposal page imports it via `await import("../lib/pdf-export")` on first PDF click. Removes ~600 KB from the initial bundle.
- Delete the 34 unused shadcn components (verified by grepping all imports outside `components/ui/`). Also deletes the recharts dependency that ships only because of `ui/chart.tsx`. Drop `react-icons` from `package.json`. Drop `client/src/html2pdf.d.ts`.

## Architecture cleanup

Decompose `client/src/pages/configurator.tsx` into `client/src/features/configurator/`:
- `ConfiguratorPage.tsx` (~150 LOC) — wiring only.
- `OptionsPanel.tsx`, `OptionCard.tsx` — option rendering.
- `RoiModal.tsx`, `FinancingModal.tsx` — modal flows.
- `QuoteForm.tsx` — customer info + Turnstile widget + honeypot + submit handler.
- `hooks/useMachine.ts`, `hooks/useOptions.ts`, `hooks/useQuoteSubmit.ts` — data layer.
- `client/src/features/pricing/{computeRoi,computeFinancing}.ts` — pure functions, unit-testable.
- `client/src/components/SEO.tsx` — head tags + JSON-LD (also used by the SEO spec).

Split `tsconfig.json` into `tsconfig.json` (client + shared) and `tsconfig.api.json` (api + scripts). Update `npm run check` to run both.

## Housekeeping

- Delete `client/public/brochures/.vercel/`.
- Add `**/.vercel/` to root `.gitignore`. Also add `.DS_Store`, `*.log`, `coverage/`.
- Restore `.env.example` with `DATABASE_URL=...`, `TURNSTILE_SITE_KEY=...`, `TURNSTILE_SECRET_KEY=...`, `RESEND_API_KEY=...`, `LEAD_NOTIFICATION_TO=...`, `UPSTASH_REDIS_REST_URL=...`, `UPSTASH_REDIS_REST_TOKEN=...`.
- Fix README step 2 to reference the restored file. Add a short "Local API testing requires `vercel dev`" note.
- Add `engines: { node: ">=18.17.0" }` to `package.json`.
- **Rotate the Supabase database password** (current password lives in plaintext in `.env.local`).
- Confirm `.env.local` is in `.gitignore` (it is).

## Tests + CI + docs

- **Vitest** unit tests for `server/pricing.ts` (computeTotal happy path + reject mismatched price + reject orphan option + reject option from wrong machine), `features/pricing/computeRoi.ts`, `features/pricing/computeFinancing.ts`.
- **Supertest** API tests for `POST /api/quotes`: 201 happy, 403 origin, 400 schema, 200 silent honeypot, 400 bad Turnstile, 429 rate limit, 400 unknown machine, 400 orphan option.
- **Playwright** smoke: home → AX2-16 configurator (direct load, asserts H1 + price visible — codifies the C7 fix) → submit → quote summary → PDF download.
- ESLint (recommended preset + `react-hooks` + `import` plugins), Prettier, Husky `pre-commit` running lint-staged on staged files.
- `.github/workflows/ci.yml`: install, typecheck (both tsconfigs), lint, test, build. Runs on every push.
- New docs: `docs/architecture.md`, `docs/api.md`, `docs/database.md`, `docs/deployment.md`, `docs/troubleshooting.md`, `KNOWN_ISSUES.md`. README rewritten as a fast quickstart pointing to those.

## Affected files (preliminary)

**New:**
- `server/pricing.ts`, `server/quotes.ts`, `server/machines.ts`
- `api/_lib/cors.ts`, `api/_lib/handler.ts`, `api/_lib/rateLimit.ts`, `api/_lib/turnstile.ts`, `api/_lib/email.ts`
- `shared/types.ts` (Zod schemas for JSON columns)
- `client/src/features/configurator/*` (decomposition)
- `client/src/features/pricing/{computeRoi,computeFinancing}.ts`
- `tests/{unit,api,e2e}/*`
- `.github/workflows/ci.yml`
- `eslint.config.js`, `prettier.config.js`, `vitest.config.ts`, `playwright.config.ts`, `.husky/pre-commit`
- `tsconfig.api.json`
- `drizzle/0001_init.sql`
- `docs/{architecture,api,database,deployment,troubleshooting}.md`, `KNOWN_ISSUES.md`
- `.env.example`

**Modified:**
- `api/_db.ts` (validate env at import, health probe)
- `api/machines.ts`, `api/machines/[id].ts` (rename to `[slug].ts`), `api/machines/[id]/options.ts` (N+1 fix), `api/quotes.ts` (full rewrite around `server/pricing.ts`), `api/quotes/[quoteNumber].ts`
- `shared/schema.ts` (FKs, indexes, money type, timestamps)
- `scripts/seed.ts` (transactional, dedupe shared lists, close pool)
- `client/src/main.tsx` (drop manual hash assignment)
- `client/src/components/theme-provider.tsx` (dead-branch fix)
- `client/src/pages/configurator.tsx` → split into `features/configurator/*` and a thin `pages/configurator.tsx` wrapper (or remove the page in favor of a route component)
- `client/src/pages/machine-selector.tsx` (`safeParse`)
- `client/src/lib/pdf-export.ts` (throw on missing DOM, dynamic import on caller side)
- `package.json` (engines, scripts, drop unused deps)
- `tsconfig.json` (narrow scope), `vercel.json` (cache headers), `.gitignore` (entries), `README.md` (rewrite)

**Deleted:**
- `client/public/brochures/.vercel/` (directory)
- `client/src/html2pdf.d.ts`
- 34 unused `client/src/components/ui/*.tsx` files (final list determined by grep at implementation time)
- `npm run db:push` (replaced)

## Verification checklist

Every item must pass before the work is called done.

**Security / integrity**
- `POST /api/quotes` from a non-allowlisted Origin → `403`.
- Submitting a payload with the honeypot field filled → `200`, no row inserted, log line written.
- Submitting without a Turnstile token, or with a bad token → `400`.
- Sending the same valid request 6 times in 60 seconds from one IP → 6th returns `429`.
- Submitting a payload with `totalPrice: 1` for an AX5-20 → server stores the real `$212,082.00` (or whatever the DB says), client `totalPrice` is ignored.
- Submitting with an unknown `machineId` → `400 {error:"Invalid input"}`, no row.
- Submitting with an option ID that belongs to a different machine → `400`, no row.
- A successful submit produces a Resend email to `LEAD_NOTIFICATION_TO` within 30s with all customer fields and the correct totals.

**Data**
- `\d quotes` shows `base_price numeric(10,2)`, `created_at timestamp`, `updated_at timestamp`.
- `\d options` shows `category_id` indexed, `machine_id` indexed, both with FK to their parent.
- Inserting a row with an option pointing at a non-existent category fails at the DB level.
- `drizzle-kit push` is no longer in `package.json`. `npm run db:migrate` exists and applies pending migrations.

**Reliability**
- Direct-loading every one of the 11 `/configure/:slug` URLs in a fresh tab renders the full page (no blank). Codifies the audit's C7 fix; also unblocks the SEO spec.
- Setting OS to light mode and reloading in a fresh browser shows light theme.
- PDF export fails gracefully (toast, button reset) when the proposal DOM is missing.
- ROI inputs reject negative numbers and clamp absurd values.

**Performance**
- Initial JS bundle (parsed) for the home page is ≤ 300 KB gzipped (down from ~430 KB).
- `/api/machines` returns `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`.
- Options endpoint runs a single query (verify in Supabase logs / `EXPLAIN`).

**Hygiene**
- No file under `dist/.vercel/` after `npm run build`.
- `.env.example` exists at repo root; a fresh clone can complete the README quickstart end-to-end.
- Supabase password rotated; old password no longer valid against the cluster.

**Quality**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all green locally.
- GitHub Actions CI green on the merge commit.
- Lighthouse SEO ≥ 95 (after SEO migration ships) on home + one product page.

## Risks

- **Turnstile false positives** for legitimate users on aggressive networks (corporate VPNs). Mitigation: managed mode is permissive by default; if reports come in, switch to non-interactive (less strict) and rely more on rate limit + honeypot.
- **Resend domain verification** can take 24–48h DNS propagation. Mitigation: provision domain ahead of cutover; until verified, send from `onboarding@resend.dev` (Resend's shared sandbox sender) so notifications still flow during the gap.
- **Schema migration on production** carries a small data-shape risk on float→numeric and text→timestamp casts. Mitigation: PITR snapshot first; run on a staging Supabase project with a clone of prod data; verify counts and totals byte-equal before applying to prod.
- **Configurator decomposition** is a large diff. Mitigation: ship behind a feature toggle is overkill for a single page; instead, make decomposition the second-to-last stage so it sits behind the test suite, and require Playwright e2e green before merge.
- **Upstash dependency** introduces a third infra service. Mitigation: only used for rate limit; failures fall open with a logged warning rather than blocking submissions (a stricter posture would fail closed; defer that decision to ops).

## Out of scope (deferred — for clarity)

- Anything user-account adjacent: customer login, sales-rep login, admin portal, sessions, password flows, role-based access, forced email verification, gated routes, account creation before quote.
- Static prerender / SEO migration (see companion SEO spec).
- Marketing landing pages around CNC search intent.
- Migration to Next.js.
- Image optimization, OG images, Twitter cards.
- Brochure CDN / Vercel Blob migration.
- Quote-history-by-customer, saved configurations.
