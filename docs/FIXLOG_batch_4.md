# FIXLOG — Batch 4 (`hotfix/p0p1-batch-4`)

Branch: `hotfix/p0p1-batch-4` (from `hotfix/p0p1-batch-3`)

## Bugs Fixed (2)

Final two P1 bugs deferred from batch 3, both requiring schema changes.

---

### Bug #26 (P1): Fund escrow for buy limit orders

**Problem:** `SYSTEM_ACCOUNTS.MARKET_ESCROW` (account 3) existed in the DB but was completely unused. Buy limit orders rested on the book without reserving funds. If a buyer spent their money between placement and fill, the order was silently skipped during matching.

**Root cause:** `placeOrder` checked the balance at placement time but did not reserve funds. Sell orders correctly reserved inventory; buy orders had no symmetric mechanism.

**Fix:**
1. **Migration 016** adds `escrowed_cents BIGINT NOT NULL DEFAULT 0` to `market_orders`.
2. **`placeOrder`** — for buy limit orders, transfers `floor(price * qty * 1.01)` from the player to `MARKET_ESCROW` at placement. The order's `escrowed_cents` column tracks the reserved amount.
3. **`matchOrder`** — for escrowed buyers, fills draw from `MARKET_ESCROW` instead of the buyer's direct balance. `escrowed_cents` is decremented per fill. For market buy orders (no escrow), direct balance check is preserved.
4. **Post-match refund** — if the order is fully filled or cancelled after matching, remaining escrow is returned to the player via `MARKET_ESCROW_RELEASE`.
5. **Counter-order refund** — when a resting buy is fully filled by an incoming sell, remaining escrow (from price improvement) is refunded.
6. **`cancelOrder`** — refunds remaining `escrowed_cents` to the player.

**New ledger entry types:** `MARKET_ESCROW`, `MARKET_ESCROW_RELEASE`

**Files changed:**
- `packages/db/migrations/016_escrow_and_balance.sql`
- `packages/core/src/economy.ts` — added entry types
- `apps/api/src/services/market-service.ts` — escrow in `placeOrder`, `matchOrder`, `cancelOrder`; `MarketOrderRow` type

**Verify:**
```
npx jest --runInBand --testPathPattern='market.test'
# 31 tests pass, including:
#   "escrows funds at placement and deducts from balance"
#   "refunds escrow on cancel"
#   "refunds surplus escrow when filled at better price"
#   "draws from escrow when resting buy is matched by incoming sell"
```

---

### Bug #28 (P1): O(N) balance calculation per ledger query

**Problem:** Every balance check ran `SUM(CASE WHEN to_account = $1 ...) - SUM(CASE WHEN from_account = $1 ...)` over the full `ledger_entries` table. Four independent copies of this O(N) query existed. Performance degrades as the ledger grows.

**Root cause:** `ledger_accounts` had no `balance_cents` column; `transferCents` only inserted into `ledger_entries` without maintaining a running total.

**Fix:**
1. **Migration 016** adds `balance_cents BIGINT NOT NULL DEFAULT 0` to `ledger_accounts` and backfills from existing entries.
2. **`transferCents`** now atomically updates `balance_cents` on both the from and to accounts after every ledger entry insert.
3. **All 5 balance readers** replaced with `SELECT balance_cents FROM ledger_accounts WHERE id = $1`:
   - `packages/db/src/index.ts` — `getAccountBalance()`
   - `apps/api/src/services/market-service.ts` — `getBalanceInTx()`
   - `apps/api/src/services/tick-service.ts` — `getBalanceInTx()`
   - `apps/api/src/services/business-service.ts` — `getBalanceInTx()`
   - `apps/api/src/handlers/eat-meal.handler.ts` — inline balance query
4. **Test cleanup** — `cleanDatabase()` resets `balance_cents = 0` on system accounts and deletes all ledger entries. Test helpers that manipulate balances directly now keep `balance_cents` in sync.

**Files changed:**
- `packages/db/migrations/016_escrow_and_balance.sql`
- `packages/db/src/index.ts` — `transferCents`, `getAccountBalance`
- `apps/api/src/services/market-service.ts` — `getBalanceInTx`
- `apps/api/src/services/tick-service.ts` — `getBalanceInTx`
- `apps/api/src/services/business-service.ts` — `getBalanceInTx`
- `apps/api/src/handlers/eat-meal.handler.ts` — inline balance query
- `apps/api/tests/helpers/setup.ts` — cleanup reset
- `apps/api/tests/tick.test.ts` — balance sync in drain
- `apps/api/tests/business.test.ts` — balance sync in drain and grant

**Verify:**
```
npx jest --runInBand --testPathPattern='market.test'
# "balance_cents matches ledger SUM after trades" passes
```

---

## Test Results

```
Test Suites: 11 passed, 11 total
Tests:       125 passed, 125 total (--runInBand)
```

## All P0/P1 bugs resolved

With batch 4, all 30 P0/P1 bugs (#1-#30) from the bug backlog are now addressed:

| Batch | Bugs | Fixed | Already Fixed | Deferred |
|-------|------|-------|---------------|----------|
| 1 | #1-#10 | 10 | 0 | 0 |
| 2 | #11-#20 | 10 | 0 | 0 |
| 3 | #21-#40 | 12 | 8 | 2 (#26, #28) |
| 4 | #26, #28 | 2 | 0 | 0 |
| **Total** | | **34** | **8** | **0** |
