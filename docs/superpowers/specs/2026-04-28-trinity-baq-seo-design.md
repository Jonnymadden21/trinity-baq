# Trinity BAQ — Technical SEO Fixes

**Date:** 2026-04-28
**Project:** trinity-quote-vercel (deployed at https://trinitybaq.com)
**Status:** Approved design — pending implementation plan

## Context

An external SEO audit of https://trinitybaq.com surfaced ten issues, ranging from missing `robots.txt` / `sitemap.xml` files to fundamental architectural limits (SPA hash routing, empty initial HTML, no per-route metadata). The site is a React + Vite SPA deployed to Vercel, backed by Supabase + Drizzle, that lets prospects configure and price Trinity Automation CNC pallet systems.

This spec covers the technical SEO fixes only. Marketing-style content landing pages (audit issue #10) and a full Next.js migration (option B from brainstorming) are explicitly out of scope.

## Goals

1. Make every product/configurator page a real, crawlable HTML document with unique title, description, canonical, H1, body content, and structured data — present in initial HTML before JavaScript runs.
2. Replace SPA hash routing with clean history-mode URLs.
3. Ship the basic SEO files search engines expect (`robots.txt`, `sitemap.xml`, `favicon.ico`, `manifest.json`) as real static files with correct content types.
4. Return true 404 status codes for invalid routes.
5. Keep the existing configurator, proposal PDF, and ROI modal UX unchanged.

## Non-goals

- Migrating to Next.js (option B from brainstorming, deferred).
- SEO marketing landing pages around search intent (audit #10, deferred).
- OG image / Twitter card image generation.
- Image optimization, font optimization, Core Web Vitals work.
- Schema.org coverage beyond `Organization` + `Product`.
- 301 redirects for old hash URLs (replaced with a small client-side hash-to-path redirector since hash fragments never reach the server).

## Architecture

### Stack additions

- **`vite-react-ssg`** — Vite-native static site generator for React. At build time it walks defined routes, renders each to HTML, writes `index.html` per route. No runtime SSR server.
- **`react-helmet-async`** — per-route `<head>` management. Captured by SSG into static HTML.

Rationale for `vite-react-ssg` over alternatives: actively maintained, integrates with React Router, supports per-route async loaders for build-time Supabase fetches. `react-snap` is semi-abandoned. `vike` (formerly `vite-plugin-ssr`) requires restructuring routes more invasively. Rolling our own with Puppeteer reinvents wheels.

### Routing migration

- Swap `HashRouter` → `createBrowserRouter`.
- Update internal `Link` paths that assume hash routing (audit existing usages).
- Add a small client-side hash-redirector in `client/index.html` that detects `location.hash.startsWith('#/')` and replaces with the corresponding clean path. This handles inbound traffic from any old `/#/configure/foo` URLs already shared.
- Vercel `vercel.json` rewrite: `{ "source": "/(.*)", "destination": "/$1" }`. Because SSG produces real `dist/configure/ax5-20/index.html` files, Vercel will serve them directly; only truly missing paths fall through to the SPA fallback (the homepage `index.html`).

### Build-time data fetch

Extract a shared `lib/machines.ts` callable both server-side (at SSG build) and client-side (at runtime). The SSG build fetches the machines list and each machine's options/specs from Supabase, passes them to per-route loaders, and the rendered output contains real product names, prices, and specs in the initial HTML.

Price/spec updates require a rebuild → redeploy. Acceptable: pricing changes infrequently, and Vercel auto-rebuilds on git push.

### Per-route metadata

Add a single `<SEO>` component (props: `title`, `description`, `canonical`, optional `jsonLd`). Every page renders its own `<SEO>`. SSG captures into static HTML.

Per-machine titles/descriptions are **generated from a template** using machine fields (name, type, capacity, headline benefit) — not hand-authored 11 strings. Adding a machine in the future stays cheap. Template lives in `lib/machineSeo.ts`.

### Static files

Located in `client/public/`:

- `robots.txt` — plain text:
  ```
  User-agent: *
  Allow: /

  Sitemap: https://trinitybaq.com/sitemap.xml
  ```
- `favicon.ico` — multi-resolution (16×16, 32×32) generated from existing `trinity-logo.jpeg`.
- `manifest.json` — minimal: name, short_name, theme_color `#D4A843`, background_color `#2D2D2D`, icons.

`sitemap.xml` is **generated** by a postbuild Node script (`scripts/generate-sitemap.ts`) that reads machines from Supabase and writes `dist/sitemap.xml`. Committed file in `public/` is a placeholder noting it's regenerated at build.

### JSON-LD structured data

- Homepage: `Organization` (Trinity Robotics Automation, phone `800-762-6864`, address `431 Nelo Street, Santa Clara, CA 95054`, logo, url, sameAs links).
- Each machine page: `Product` (name, brand, description, image, offers.price USD, offers.priceCurrency, offers.availability `InStock`).
- Injected via `<SEO jsonLd={...}>`.

### True 404s

Build outputs `dist/404.html`. Vercel auto-serves it with a `404` status for unmatched paths (current behavior: SPA fallback returns `200` for any path). Existing `/favicon.ico`, `/manifest.json`, etc. are real files at the root, so they no longer fall through to the app shell.

### Empty-direct-load bug (audit issue #6)

Audit found `/configure/ax2-16`, `/configure/ax2-24`, `/configure/ax4-12`, etc. render empty when loaded directly (only `ai-part-loader` renders content). Likely cause: route component reads slug-keyed data from a context populated only after the homepage's `/api/machines` fetch resolves; loading the configurator first leaves the context empty.

Fix: each configurator page fetches its own machine via `/api/machines/:slug` on mount, independent of any parent state or shared context. This bug also blocks SSG — the prerenderer would capture empty HTML otherwise. The fix is a prerequisite, not an add-on.

## Affected files (preliminary, plan will refine)

- `package.json` — add `vite-react-ssg`, `react-helmet-async`.
- `vite.config.ts` — register `vite-react-ssg` plugin.
- `client/src/main.tsx` — switch router, wrap in `HelmetProvider`.
- `client/src/App.tsx` (or routes file) — define routes for SSG with loaders.
- `client/src/pages/*` — add `<SEO>` to each top-level page; ensure configurator page fetches its own data on mount.
- `client/src/components/SEO.tsx` (new) — head-tag component.
- `client/src/lib/machines.ts` (new or refactored) — shared machine fetch.
- `client/src/lib/machineSeo.ts` (new) — title/description templates + JSON-LD builder.
- `client/public/robots.txt` (new), `client/public/manifest.json` (new), `client/public/favicon.ico` (new).
- `scripts/generate-sitemap.ts` (new) — postbuild sitemap generator.
- `vercel.json` — rewrite rule confirmation.
- `client/index.html` — hash-to-path redirector snippet.

## Verification checklist

Every item must pass before the work is called done:

- `curl -I https://trinitybaq.com/robots.txt` → `200`, `Content-Type: text/plain`
- `curl https://trinitybaq.com/sitemap.xml` → valid XML, includes homepage + all 11 machine URLs
- `curl -I https://trinitybaq.com/404-random-test` → `404`
- `curl -I https://trinitybaq.com/favicon.ico` → `200`, image content-type
- `curl https://trinitybaq.com/configure/ai-part-loader` → initial HTML contains `<h1>Ai Part Loader`, the price `$115,900`, a JSON-LD `Product` script tag, and a `<link rel="canonical">`
- Each of the 11 machine routes, loaded directly in a browser, shows full content (not empty)
- `view-source` on each page shows unique `<title>` and `<meta name="description">`
- Each page has `<link rel="canonical">` matching its clean URL
- Lighthouse SEO score ≥ 95 on homepage and one product page
- Configurator → quote summary → proposal PDF flow still works end-to-end (no regression)
- ROI modal still works (no regression)

## Risks

- **`vite-react-ssg` route definition style** may require restructuring how routes are declared. If too invasive, fallback to `react-snap` (less ideal but zero route changes).
- **Supabase fetch at build time** requires `DATABASE_URL` available in Vercel build environment. Already configured per README, but confirm.
- **`HashRouter` → `BrowserRouter`** can break links embedded in old proposal PDFs or shared elsewhere. Hash redirector mitigates inbound `#/foo` traffic; outbound links in PDFs are unaffected since those PDFs already have whatever URL was current at print time.
