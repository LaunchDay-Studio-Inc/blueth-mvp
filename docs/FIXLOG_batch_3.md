# FIXLOG — Batch 3 (`hotfix/p0p1-batch-3`)

Branch: `hotfix/p0p1-batch-3` (from `hotfix/p0p1-batch-2`)

## Bugs Fixed

### Bug #18 (P1): TOCTOU race in idempotency check — duplicate actions

**Root cause:** `submitAction()` runs the idempotency SELECT outside the transaction as a fast-path check. Two concurrent requests with the same key both pass the check, and the second INSERT hits the UNIQUE constraint `(player_id, idempotency_key)` producing an unhandled Postgres 23505 error (500).

**Fix:** In `action-engine.ts`, catch Postgres error code `23505` in the existing `withTransaction` catch block. On catch, re-query the existing action and return it (same as the fast-path cache hit).

**File:** `apps/api/src/services/action-engine.ts`

**Verify:** 5 concurrent identical action submissions all return the same `actionId` (existing test in `actions.test.ts > Concurrent idempotency`).

---

### Bug #15 (P1): Failed tick never retried — permanently stuck daily cycles

**Root cause:** `failTick()` in `tick-service.ts` sets `status = 'failed'` permanently. `claimTick()` only selects `status = 'pending'`. No retry mechanism exists, so an entire daily cycle for all players is permanently skipped.

**Fix:**
1. Modified `failTick()` to track retry count in the `detail` JSONB field (read existing retryCount, increment).
2. Added `resetStaleFailedTicks()` function: resets failed ticks to pending if `retryCount < 3` and `finished_at > 2 minutes ago`.
3. Call `resetStaleFailedTicks()` at the start of `runTickIteration()`.

**File:** `apps/api/src/services/tick-service.ts`

**Verify:** `tick.test.ts > failed tick retry (Bug #15)` — tests both retry (retryCount=1 gets reset) and exhaustion (retryCount=3 stays failed).

---

### Bug #20 (P1): Handlers don't round vigor — fractional values in integer columns

**Root cause:** All action handlers write raw floating-point vigor values to the DB. Over time, fractional values like `67.30000000000001` accumulate and cause subtle math errors.

**Fix:** Wrapped all vigor dimension writes in `Math.round()` across 6 handler files.

**Files:**
- `apps/api/src/handlers/eat-meal.handler.ts`
- `apps/api/src/handlers/work-shift.handler.ts`
- `apps/api/src/handlers/sleep.handler.ts`
- `apps/api/src/handlers/market-place-order.handler.ts`
- `apps/api/src/handlers/leisure.handler.ts`
- `apps/api/src/handlers/social-call.handler.ts`

**Verify:** `actions.test.ts > Vigor rounding (Bug #20)` — checks that all vigor values in DB are integers after a work shift.

---

### Bug #14 (P1): Unpaid wages still count toward worker satisfaction

**Root cause:** In `processBusinessDailyTick()`, `updateWorkerSatisfaction()` always receives `worker.wage_cents` (the configured wage) even when payment was skipped due to insufficient balance. This means broke business owners get satisfaction credit they don't deserve.

**Fix:** Track actual paid amount in a local variable `actualPaidCents`. Set to `worker.wage_cents` on successful payment, `0` when skipped. Pass `actualPaidCents` to `updateWorkerSatisfaction()`.

**File:** `apps/api/src/services/business-service.ts`

**Verify:** `business.test.ts > Unpaid wage satisfaction (Bug #14)` — drains wallet, runs daily tick, asserts satisfaction decreased below 1.0.

---

### Bug #11 (P1): clearCookie on logout uses incomplete options — cookie persists

**Root cause:** Logout calls `reply.clearCookie(SESSION_COOKIE, { path: '/' })` but the cookie was set with full `sessionCookieOptions(isProduction)` including `httpOnly`, `secure`, `sameSite`. Browsers (especially Safari, mobile) won't clear cookies unless all attributes match.

**Fix:** Changed `clearCookie` to use `sessionCookieOptions(isProduction)` instead of just `{ path: '/' }`.

**File:** `apps/api/src/routes/auth.ts`

**Verify:** `auth.test.ts > logout set-cookie includes HttpOnly and Path (Bug #11)` — checks that the clear-cookie header includes HttpOnly, Path, and SameSite.

---

## Test Results

- Backend: **93 passed**, 5 failed (all pre-existing), 98 total
- Frontend build: clean
- New regression tests: 5 added (all passing)

## Pre-existing Failures (unchanged)

1. `market.test.ts` — trade fee ledger verification
2. `auth.test.ts` — session cookie format (2 tests)
3. `scheduler.test.ts` — concurrent claim disjointness
4. `tick.test.ts` — rent downgrade end-to-end
