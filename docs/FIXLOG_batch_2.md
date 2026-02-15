# FIXLOG — Batch 2 P0/P1 Fixes

Branch: `hotfix/p0p1-batch-2`
Base: `qa/bug-bash-100`

## Bugs Fixed

### Bug #4 (P0): Non-atomic market order placement
**Problem:** `placeOrder()` called `withTransaction()` internally, creating a separate DB connection from the action engine's `ctx.tx`. Two concurrent orders could both pass the balance check on separate connections, enabling double-spend.

**Fix:** Added optional `txOverride?: PoolClient` parameter to `placeOrder()`. When provided, uses the caller's transaction directly. Handler now passes `ctx.tx`.

**Files:**
- `apps/api/src/services/market-service.ts` — `placeOrder` signature
- `apps/api/src/handlers/market-place-order.handler.ts` — passes `tx`

**Verify:** Run `pnpm --filter @blueth/api test -- --testPathPattern=market` — "placeOrder uses action engine transaction" test passes.

---

### Bug #5 (P0): Non-atomic market order cancellation
**Problem:** Same pattern as #4. `cancelOrder()` called `withTransaction()` internally, bypassing the action engine's transaction.

**Fix:** Same pattern — added `txOverride?: PoolClient` param. Handler passes `ctx.tx`.

**Files:**
- `apps/api/src/services/market-service.ts` — `cancelOrder` signature
- `apps/api/src/handlers/market-cancel-order.handler.ts` — passes `ctx.tx`

**Verify:** Run `pnpm --filter @blueth/api test -- --testPathPattern=market` — "cancelOrder uses action engine transaction" test passes.

---

### Bug #6 (P0): Labor hours double-spend across concurrent production jobs
**Problem:** `startProduction()` queried workers via pool-level `query()` instead of `tx.query()`, breaking transaction isolation. Additionally, labor hours already committed to running production jobs were not subtracted from available labor.

**Fix:**
1. Changed worker query to `tx.query()` with `FOR UPDATE` row locking
2. Added committed labor subtraction: queries `SUM(r.labor_hours)` from running production jobs and subtracts from effective labor before the `hasEnoughLabor` check

**Files:**
- `apps/api/src/services/business-service.ts` — `startProduction` labor check block

**Verify:** Run `pnpm --filter @blueth/api test -- --testPathPattern=business` — "rejects second production job when labor is fully committed" test passes.

---

### Bug #8 (P0): Docker Compose prod exposes Postgres port to public internet
**Problem:** `docker-compose.prod.yml` had `ports: - '5432:5432'` on the postgres service, binding to `0.0.0.0:5432`. All containers connect via Docker internal DNS, so the published port was unnecessary and dangerous.

**Fix:** Removed the `ports:` block from the postgres service.

**Files:**
- `docker-compose.prod.yml`

**Verify:** `grep -c "5432" docker-compose.prod.yml` returns 0.

---

### Bug #12 (P1): Inventory double-spend via concurrent startProduction calls
**Problem:** `getInventoryQty()` did `SELECT qty` without `FOR UPDATE`. Two concurrent `startProduction` calls could both see the same inventory qty and both deduct, with `GREATEST(0, ...)` silently clamping the second deduction to 0.

**Fix:** Added `FOR UPDATE` to the `SELECT qty FROM inventories` query in `getInventoryQty()` in both `business-service.ts` and `market-service.ts`. This serializes concurrent reads, ensuring the second caller sees the updated (post-deduction) quantity.

Note: `GREATEST(0, ...)` in `adjustInventory()` was kept because PostgreSQL's CHECK constraint on `inventories.qty >= 0` fires on INSERT values before the ON CONFLICT clause is evaluated.

**Files:**
- `apps/api/src/services/business-service.ts` — `getInventoryQty()`
- `apps/api/src/services/market-service.ts` — `getInventoryQty()`

**Verify:** Run `pnpm --filter @blueth/api test -- --testPathPattern=business` — "rejects second production job when inventory is consumed by first" test passes.

---

## Tests Added

| Test file | Test name |
|-----------|-----------|
| `market.test.ts` | placeOrder uses action engine transaction — balance check is atomic |
| `market.test.ts` | cancelOrder uses action engine transaction — refund is atomic |
| `business.test.ts` | rejects second production job when labor is fully committed |
| `business.test.ts` | rejects second production job when inventory is consumed by first |

## Verification Results

- Backend tests: 88 passed, 5 failed (all 5 failures are pre-existing, unrelated to this batch)
- Frontend build: clean, no errors
- TypeScript compilation: clean
