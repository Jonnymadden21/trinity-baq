# Trinity Automation — Build & Price

Build-a-quote web application for Trinity Automation CNC pallet systems.

## Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Vercel Serverless Functions (TypeScript)
- **Database**: Supabase (PostgreSQL) + Drizzle ORM
- **Hosting**: Vercel

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **Project Settings → Database → Connection string**
3. Copy the **URI** connection string (Transaction mode, port 6543)

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and paste your Supabase connection string:

```
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Push Database Schema

This creates all tables in your Supabase database:

```bash
npx drizzle-kit push
```

### 5. Seed the Database

This populates all 11 Trinity machines with their options and pricing:

```bash
npm run db:seed
```

### 6. Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy
vercel

# Set your environment variable
vercel env add DATABASE_URL
# Paste your Supabase connection string when prompted

# Deploy to production
vercel --prod
```

### Local Development

```bash
npm run dev
```

The Vite dev server runs on port 5173 with API calls proxied to `/api/` routes.

**Note**: For local dev, the API routes need Vercel's local dev server:

```bash
vercel dev
```

This runs both the Vite frontend and the serverless API functions locally.

## Project Structure

```
├── api/                    # Vercel serverless API routes
│   ├── _db.ts              # Shared database connection (Supabase/Postgres)
│   ├── machines.ts         # GET /api/machines
│   ├── machines/
│   │   ├── [slug].ts       # GET /api/machines/:slug
│   │   └── [id]/
│   │       └── options.ts  # GET /api/machines/:id/options
│   ├── quotes.ts           # POST /api/quotes
│   └── quotes/
│       └── [quoteNumber].ts # GET /api/quotes/:quoteNumber
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── pages/          # Machine selector, configurator, quote summary
│   │   ├── components/     # Trinity logo, theme provider, shadcn/ui
│   │   └── lib/            # Query client, utilities
│   └── index.html
├── shared/
│   └── schema.ts           # Drizzle ORM schema (Postgres)
├── scripts/
│   └── seed.ts             # Database seed script (all 11 machines)
├── vercel.json             # Vercel routing config
├── drizzle.config.ts       # Drizzle Kit config (Postgres)
└── vite.config.ts          # Vite build config
```

## Machines Included

### AX Series (Pallet Automation)
- AX1-12 — $165,000
- AX1-18 — $175,000
- AX2-16 — $189,245
- AX2-24 — $195,845
- AX2-16 Duo — $225,000
- AX2-24 Duo — $245,000
- AX4-12 — $235,000
- AX4-12 HD — $275,000
- AX5-20 — $212,082
- AX5-20 HD — $277,959

### Ai Series
- Ai Part Loader — $115,900
