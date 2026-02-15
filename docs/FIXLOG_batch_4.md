# FIXLOG — Batch 4 (`hotfix/p0p1-batch-4`)

Branch: `hotfix/p0p1-batch-4` (from `hotfix/p0p1-batch-3`)

## Bugs Fixed (10)

### Bug #10 (P1): Guest username collision at scale — 32-bit random space

**Root cause:** `crypto.randomBytes(4)` produces only 32 bits of entropy (8 hex chars). Birthday paradox gives 50% collision at ~77k guests. Duplicate username causes unhandled Postgres unique constraint violation (500).

**Fix:** Increased to `crypto.randomBytes(12)` (96 bits, 24 hex chars). Wrapped `withTransaction` in try/catch; on Postgres error 23505, throw `ValidationError` instead of raw 500.

**File:** `apps/api/src/services/auth.service.ts`

**Verify:** `guest-auth.test.ts > multiple guest registrations produce unique usernames (Bug #10)` — creates 10 guests, asserts all unique. Also updated existing regex test from `{8}` to `{24}` hex chars.

---

### Bug #13 (P1): Rate limit check runs outside transaction — bypassable

**Root cause:** `placeOrder` handler's rate-limit SELECT uses `queryOne` (pool-level), not `ctx.tx`. Two concurrent requests both see count=9, both pass, resulting in 11+ orders per minute.

**Fix:** Replaced `queryOne` import with `txQueryOne` from `action-engine.ts`. Rate limit query now runs inside the action engine's transaction via `tx`.

**File:** `apps/api/src/handlers/market-place-order.handler.ts`

**Verify:** `market.test.ts > Market order rate limit (Bug #13)` — places 10 orders (limit), then asserts 11th is rejected with "Rate limit" error.

---

### Bug #25 (P1): Matching engine breaks on insufficient funds instead of continuing

**Root cause:** When a buyer can't afford a counter-order fill, `break` exits the entire matching loop. Cheaper orders further down the book are never evaluated.

**Fix:** For incoming buy orders (counter-orders sorted cheapest first), `break` is correct — remaining are same/higher price. For incoming sell orders (counter-orders sorted by highest bidder), replaced `break` with `continue` + exclusion list (`skippedOrderIds`) to skip unfundable resting buys and try cheaper ones.

**File:** `apps/api/src/services/market-service.ts`

**Verify:** Existing market matching tests still pass. The fix only changes behavior for the sell-incoming/buy-counter case where the counter-buyer is underfunded.

---

### Bug #27 (P1): dotenv.config() called after DB module initialization

**Root cause:** In `index.ts`, `import { pool } from '@blueth/db'` (line 6) triggers DB module evaluation (which creates the Pool) before `dotenv.config()` on line 19 executes. Static ES imports are hoisted.

**Fix:** Removed the redundant `dotenv.config()` call and `import * as dotenv` from `index.ts`. The `@blueth/db` package already calls `dotenv.config()` at module load time before creating the pool. Added explanatory comment documenting this dependency.

**File:** `apps/api/src/index.ts`

**Verify:** Backend tests pass (pool initialization works correctly). The `@blueth/db` module's own `dotenv.config()` handles `.env` loading.

---

### Bug #16 (P1): Docker healthcheck doesn't verify DB connectivity

**Root cause:** Docker healthcheck hits `/health` which returns `{ status: 'ok' }` without querying the database. Container marked healthy even when DB is down.

**Fix:** Changed healthcheck URL from `/health` to `/ready`, which queries DB with `SELECT 1`.

**File:** `docker-compose.prod.yml`

**Verify:** Inspect `docker-compose.prod.yml` line 65 — healthcheck now uses `/ready`.

---

### Bug #17 (P1): Connection pool exhaustion — 3 processes x 20 = 60 connections

**Root cause:** Each Node.js process (API, scheduler, tick) creates a pool with `max: 20`. Total: 60 connections against Postgres default `max_connections=100`. Under load, pool contention causes timeouts.

**Fix:** Changed hardcoded `max: 20` to `parseInt(process.env.DB_POOL_MAX || '8', 10)`. Default 8 per process = 24 total, well within Postgres limits. Configurable via `DB_POOL_MAX` env var.

**File:** `packages/db/src/index.ts`

**Verify:** Backend tests pass with default pool size of 8.

---

### Bug #21 (P1): Daily reset timer stuck at zero — never refreshes

**Root cause:** Timer counts down to 0 but never refetches the server's next reset time. Also, `totalSeconds % 60` produces fractional seconds (e.g., `0.7s`).

**Fix:**
1. Added `Math.floor(totalSeconds)` in `formatCountdown` to eliminate fractional seconds.
2. Added `useEffect` that triggers `queryClient.invalidateQueries` when countdown hits 0, fetching the next day's reset time.
3. Added `hasRefetched` ref to prevent repeated refetches.

**File:** `apps/web/src/components/daily-reset-timer.tsx`

**Verify:** Frontend build clean. Timer now refetches when hitting 0 and displays integer seconds.

---

### Bug #22 (P1): Stale vigor displayed after returning to tab

**Root cause:** `QueryClient` sets `refetchOnWindowFocus: false` and `refetchOnReconnect: false`. After tab-switching for 30+ minutes, user sees stale data until next poll cycle.

**Fix:** Changed both to `true` in `QueryClient` default options.

**File:** `apps/web/src/components/providers.tsx`

**Verify:** Frontend build clean. All queries now refetch on window focus and reconnect.

---

### Bug #23 (P1): Double-submit race after mutation success

**Root cause:** `useSubmitAction` fires `invalidateQueries` without `await`. Mutation resolves, `isPending` becomes false, buttons re-enable before refetch completes. User can re-click with stale preconditions.

**Fix:** Made `onSuccess` async. Wrapped both `invalidateQueries` calls in `await Promise.all([...])` so `isPending` stays true until data is refreshed.

**File:** `apps/web/src/hooks/use-submit-action.ts`

**Verify:** Frontend build clean. Buttons now stay disabled until queries are fully refreshed after a successful action.

---

### Bug #30 (P1): Logout in ITCH_MODE strands user on blank screen

**Root cause:** Logout in ITCH_MODE clears guest token and query cache but doesn't redirect (guarded by `!ITCH_MODE`). `guestLoginAttempted.current` is already true from initial mount, so auto-guest-login never re-fires. User stuck with no session.

**Fix:** In ITCH_MODE, after clearing cache, reset `guestLoginAttempted.current = false` and immediately call `guestLogin()` to create a fresh guest session.

**File:** `apps/web/src/lib/auth-context.tsx`

**Verify:** Frontend build clean. In ITCH_MODE, logout now automatically creates a fresh guest account.

---

## Test Results

- Backend: **95 passed**, 5 failed (all pre-existing), 100 total
- Frontend build: clean
- New regression tests: 2 added (Bug #10 uniqueness, Bug #13 rate limit), both passing
- All batch 3 regression tests still passing

## Pre-existing Failures (unchanged)

1. `market.test.ts` — trade fee ledger verification
2. `auth.test.ts` — session cookie format (2 tests)
3. `scheduler.test.ts` — concurrent claim disjointness
4. `tick.test.ts` — rent downgrade end-to-end
