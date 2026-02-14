# Ship Audit — Blueth City MVP

**Date:** 2026-02-14
**Branch:** `ship/itch-vm-android`
**Scope:** Full repo structure, architecture, dev commands, static-build feasibility

---

## 1) Repo Tree (depth 3)

```
blueth-mvp/
├── apps/
│   ├── api/                      # Fastify 4.x backend (port 3001)
│   │   ├── src/                  # Routes, services, workers, plugins
│   │   ├── tests/                # Jest integration tests (needs PostgreSQL)
│   │   ├── Dockerfile
│   │   ├── Dockerfile.dev
│   │   ├── jest.config.js
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                      # Next.js 14 App Router frontend (port 3000)
│       ├── src/                  # App router pages, components, hooks, lib
│       ├── Dockerfile
│       ├── Dockerfile.dev
│       ├── next.config.js
│       ├── postcss.config.js
│       ├── tailwind.config.js
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── core/                     # Pure TS domain logic (vigor, economy, market)
│   │   ├── src/                  # All pure functions — zero I/O, deterministic
│   │   ├── jest.config.js
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── db/                       # PostgreSQL migrations + query helpers
│       ├── migrations/           # 14 numbered SQL files
│       ├── src/                  # migrate.ts, pool, retry, query helpers
│       ├── package.json
│       └── tsconfig.json
├── deploy/
│   └── systemd/                  # Service files: blueth-api, scheduler, tick
├── docs/
│   ├── BluethCity_Core_Bible_v2.md
│   ├── bible_compliance_report.md
│   └── SHIP_AUDIT.md            # ← this file
├── docker-compose.yml            # Dev: postgres + api + web
├── docker-compose.prod.yml       # Prod variant
├── ecosystem.config.cjs          # PM2 config: api + scheduler + tick workers
├── pnpm-workspace.yaml           # Workspaces: apps/*, packages/*
├── package.json                  # Root scripts (dev, build, test, db:migrate)
├── tsconfig.base.json
├── .eslintrc.js
├── .prettierrc
└── .nvmrc                        # Node >=20
```

---

## 2) Architecture Identification

### Backend / API

| Attribute | Value |
|-----------|-------|
| **Path** | `apps/api/` |
| **Framework** | Fastify 4.25 |
| **Port** | 3001 |
| **Language** | TypeScript (CommonJS, compiled with `tsc`) |
| **Dev runner** | `tsx watch src/index.ts` |
| **Key deps** | `@fastify/cookie`, `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`, `bcryptjs`, `luxon`, `zod` |
| **Shared** | `@blueth/core` (pure domain logic), `@blueth/db` (query helpers + pool) |

### Frontend / Web

| Attribute | Value |
|-----------|-------|
| **Path** | `apps/web/` |
| **Framework** | Next.js 14.1 (App Router) |
| **Port** | 3000 |
| **UI** | Radix UI + Tailwind CSS 3.4 + `class-variance-authority` + `lucide-react` icons + `recharts` |
| **Data fetch** | TanStack React Query 5 → `fetch('/api/...')` → Next.js rewrite → Fastify |
| **SSR usage** | None. All 10 game pages are `'use client'`. Root layout is the only server component (sets HTML shell). |
| **Middleware** | Edge middleware checks `session_id` cookie → redirects to `/login` |
| **Shared** | `@blueth/core` (for type imports only — no server logic) |

### Database / Migrations

| Attribute | Value |
|-----------|-------|
| **Path** | `packages/db/` |
| **Engine** | PostgreSQL 16 |
| **Driver** | `pg` (raw SQL, no ORM) |
| **Migration runner** | Custom (`packages/db/src/migrate.ts`): sequential `.sql` files, `_migrations` tracking table, per-file transactions |
| **Migration count** | 14 files (`001_core.sql` through `014_action_retries.sql`) |
| **Seed data** | Embedded in `007_seed_data.sql` (goods, recipes, districts, NPC prices, system accounts). No separate seed script. |

**Migration file inventory:**

| File | Purpose |
|------|---------|
| `001_core.sql` | players, player_state, actions, ticks |
| `002_ledger.sql` | ledger_accounts, player_wallets, ledger_entries |
| `003_economy.sql` | goods, inventories |
| `004_market.sql` | npc_market_state, market_orders, market_trades |
| `005_businesses.sql` | businesses, recipes, production_jobs |
| `006_world.sql` | districts, locations |
| `007_seed_data.sql` | Seed: goods catalog, recipes, districts, NPC prices, system accounts |
| `008_indexes.sql` | Performance indexes |
| `009_sessions_and_extensions.sql` | sessions table, active_buffs/skills columns |
| `010_workers.sql` | daily_summaries, worker indexes |
| `011_market_deep.sql` | Market alpha/spread, NPC sessions |
| `012_business_deep.sql` | Recipe labor hours, business extensions |
| `013_anomalies.sql` | anomalies table |
| `014_action_retries.sql` | retry_count on actions |

### Auth

| Attribute | Value |
|-----------|-------|
| **Mechanism** | Cookie-based, DB-backed sessions |
| **Cookie** | `session_id` (httpOnly, secure in prod, SameSite=lax, 7-day maxAge) |
| **Password hashing** | bcryptjs, 12 rounds |
| **Session store** | `sessions` table in PostgreSQL (`id UUID`, `player_id`, `expires_at`) |
| **Routes** | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` |
| **Auth guard** | Fastify `preHandler` hook on all non-`/health`, non-`/auth` routes |
| **Client guard** | Next.js Edge middleware redirects to `/login` if no cookie |
| **No JWT** | JWT was considered (`.env.example` has a comment) but not implemented |

### Workers

Two standalone polling workers, started as separate processes:

| Worker | File | Poll interval | Purpose |
|--------|------|---------------|---------|
| **Tick** | `apps/api/src/workers/tick.ts` | 10s | Hourly: vigor regen, buff expiry, production. 6-hourly: NPC market refresh. Daily: meal penalties, rent, summaries |
| **Scheduler** | `apps/api/src/workers/scheduler.ts` | 5s | Claims due scheduled actions (`FOR UPDATE SKIP LOCKED`), resolves them via action engine |

Both handle `SIGTERM`/`SIGINT` for graceful shutdown. Started via:
- Dev: `pnpm --filter @blueth/api worker:tick` / `worker:scheduler`
- Prod: PM2 (`ecosystem.config.cjs`) or systemd (`deploy/systemd/`)

---

## 3) Commands to Run Locally in Codespaces

### Prerequisites

PostgreSQL 16 must be running. In Codespaces without Docker, install and start it manually:

```bash
# If PostgreSQL is not installed/running:
sudo apt-get update && sudo apt-get install -y postgresql-16
sudo pg_ctlcluster 16 main start
sudo -u postgres createuser -s blueth
sudo -u postgres psql -c "ALTER USER blueth PASSWORD 'blueth_dev_password';"
sudo -u postgres createdb -O blueth blueth_city
```

### Environment Setup

```bash
# Create .env files from examples
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env
cp apps/web/.env.example apps/web/.env.local
```

### Install

```bash
pnpm install
```

### Build Shared Packages (required before dev or test)

```bash
pnpm run --filter './packages/*' build
```

### Migrate DB

```bash
pnpm db:migrate
# Or directly:
# pnpm --filter @blueth/db migrate
```

### Seed DB

No separate seed command — seed data is applied automatically by migration `007_seed_data.sql` during `db:migrate`. Per-player data (vigor, wallet, initial ₿500 grant) is created at registration time.

### Dev (frontend + backend)

```bash
# Terminal 1 — API server (port 3001)
pnpm dev:api

# Terminal 2 — Web frontend (port 3000)
pnpm dev:web

# Or both at once (parallel, but harder to read logs):
pnpm dev
```

Optional workers:

```bash
# Terminal 3 — Tick worker
pnpm --filter @blueth/api worker:tick

# Terminal 4 — Scheduler worker
pnpm --filter @blueth/api worker:scheduler
```

### Run Tests

```bash
# Core domain logic (no DB required) — 478 tests
pnpm test:core

# API integration tests (requires running PostgreSQL)
pnpm --filter @blueth/api test

# All tests
pnpm test
```

---

## 4) Static Build Feasibility for itch.io

### Current State: NOT static-exportable

The current `next.config.js` uses:

```js
output: 'standalone',       // ← builds a Node.js server
rewrites() { ... },         // ← requires Node.js request proxy
```

And `middleware.ts` uses Edge middleware (`NextResponse.redirect`), which requires the Next.js server runtime.

### Why a Static Export IS Feasible

Despite that, the frontend is architecturally a single-page application:

1. **Zero SSR data fetching** — Every page is `'use client'`. No `getServerSideProps`, no `getStaticProps`, no server component data loading. All data comes from TanStack React Query calling `fetch('/api/...')`.

2. **No Next.js API routes** — The `app/api/` directory doesn't exist. All API calls proxy through `rewrites()` to the Fastify backend.

3. **No dynamic routes** — All 10 game pages (`/city`, `/jobs`, `/food`, `/wallet`, `/vigor`, `/leisure`, `/bills`, `/market`, `/business`, `/summary`) plus `/login`, `/register` are static paths.

4. **`@blueth/core` is pure** — The shared package used by the frontend contains zero I/O, just types and pure functions.

### Smallest Additive Change for Static Export

Create a **new Next.js config file** and a **new build script** that produces static HTML/JS/CSS files suitable for itch.io hosting. The existing `next.config.js` and `build` script remain untouched.

**What needs to change (additive only):**

1. **New file: `apps/web/next.config.static.js`**
   - Sets `output: 'export'` (Next.js static export)
   - Removes `rewrites()` (not supported in static mode)
   - Sets `NEXT_PUBLIC_API_URL` to a configurable base URL (for the hosted Fastify API)

2. **New script in `apps/web/package.json`**
   - `"build:static": "NEXT_CONFIG_FILE=next.config.static.js next build"` or
   - `"build:static": "next build --config next.config.static.js"` — however, Next.js doesn't support `--config`. Instead: copy the static config over at build time, then restore.
   - Cleaner approach: `"build:static": "STATIC_EXPORT=true next build"` with a conditional in the existing config.

3. **Modify `apps/web/src/lib/api.ts`** (additive)
   - Currently hardcodes `fetch('/api' + path)`. For static export, needs to read `NEXT_PUBLIC_API_URL` and use it as the base URL: `fetch((process.env.NEXT_PUBLIC_API_URL || '') + path)`.
   - This change is backward-compatible — when `NEXT_PUBLIC_API_URL` is empty string or unset, it falls back to the current relative `/api` path behavior.

4. **Move auth guard from Edge middleware to client-side**
   - `middleware.ts` uses `NextResponse.redirect()` which requires Edge runtime.
   - The `AuthProvider` in `lib/auth-context.tsx` already handles 401 redirects client-side.
   - For static export: the middleware should be excluded from static builds (or replaced with a client-side `useEffect` redirect, which is already partially implemented in `page.tsx`).

5. **Google Font handling**
   - `next/font/google` works with static export (Next.js inlines the font CSS at build time).
   - No change needed.

**Output directory:** `apps/web/out/` (Next.js static export default). This directory can be zipped and uploaded to itch.io.

### Blockers and Considerations for itch.io Specifically

| Concern | Impact | Mitigation |
|---------|--------|------------|
| **API server required** | itch.io hosts static files only — no backend | The Fastify API + PostgreSQL + workers must be hosted separately (e.g., a VPS, Railway, Fly.io). The static frontend connects to it via `NEXT_PUBLIC_API_URL`. |
| **Cookie auth cross-origin** | If API is on a different domain, `SameSite=lax` cookies won't be sent cross-origin | Switch to `SameSite=none; Secure` on the API, or use token-based auth (e.g., pass session token in `Authorization` header instead of cookies). |
| **CORS** | Cross-origin fetch from itch.io iframe to API host | API already supports CORS (`@fastify/cors`) via `ALLOWED_ORIGINS` env var. Set it to include the itch.io origin. |
| **itch.io iframe sandbox** | itch.io embeds HTML games in a sandboxed iframe | May block cookies entirely. Token-based auth (localStorage + header) is more reliable in sandboxed iframes. |
| **Android (VM context)** | If targeting Android WebView or VM | Same considerations as itch.io iframe. Ensure `NEXT_PUBLIC_API_URL` is set to the public API endpoint. |

### Recommended Approach Summary

The **smallest** additive change is 3 steps:

1. Add `apps/web/next.config.static.js` (new file, ~15 lines)
2. Add `"build:static"` script to `apps/web/package.json`
3. Make `api.ts` read `NEXT_PUBLIC_API_URL` for the fetch base URL (1-line change, backward-compatible)

The auth cookie-vs-token concern is a separate decision that only matters once the API is deployed to a different origin than the frontend.

---

## Appendix: API Routes Inventory

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Login |
| POST | `/auth/logout` | Yes | Logout |
| GET | `/health` | No | Health check |
| GET | `/me/state` | Yes | Full player state |
| POST | `/actions` | Yes | Submit action (idempotent) |
| GET | `/actions/queue` | Yes | View action queue |
| POST | `/actions/:id/cancel` | Yes | Cancel action |
| GET | `/market/goods` | Yes | List goods + prices |
| GET | `/market/:good/book` | Yes | Order book |
| POST | `/market/orders` | Yes | Place order |
| DELETE | `/market/orders/:id` | Yes | Cancel order |
| GET | `/market/orders` | Yes | My orders |
| GET | `/businesses` | Yes | List businesses |
| POST | `/businesses` | Yes | Register business |
| POST | `/businesses/:id/produce` | Yes | Start production |
| GET | `/businesses/:id` | Yes | Business detail |

## Appendix: Web Pages

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Redirect to `/city` or `/login` |
| `/login` | `app/login/page.tsx` | Login form |
| `/register` | `app/register/page.tsx` | Registration form |
| `/city` | `app/(game)/city/page.tsx` | Clickable district map |
| `/jobs` | `app/(game)/jobs/page.tsx` | Job center |
| `/food` | `app/(game)/food/page.tsx` | Meal selection |
| `/wallet` | `app/(game)/wallet/page.tsx` | Balance + costs |
| `/vigor` | `app/(game)/vigor/page.tsx` | Vigor dimensions |
| `/leisure` | `app/(game)/leisure/page.tsx` | Leisure + social |
| `/bills` | `app/(game)/bills/page.tsx` | Housing management |
| `/market` | `app/(game)/market/page.tsx` | Commodity exchange |
| `/business` | `app/(game)/business/page.tsx` | Business management |
| `/summary` | `app/(game)/summary/page.tsx` | Daily summary |
