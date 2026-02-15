# FIXLOG — Batch 3 (Bugs #21–#40)

Branch: `hotfix/p0p1-batch-3`

## Summary

| Bug | Title | Status | Details |
|-----|-------|--------|---------|
| #21 | Timer freeze at 0 | Already fixed | `setInterval` already in place |
| #22 | refetchOnWindowFocus false | Already fixed | Set to `true` |
| #23 | onSuccess double-submit | Already fixed | `onSuccess` awaits `invalidateQueries` |
| #24 | Auth prefix bypass | **Fixed** | Switched from prefix matching to exact path matching |
| #25 | Matching engine break on insufficient funds | Already fixed | Both sides handled |
| #26 | Fund escrow for buy limit orders | **Deferred** | Requires matching-engine refactor |
| #27 | dotenv ordering | Already fixed | `db` module calls `dotenv.config` before pool |
| #28 | O(N) balance scan | **Deferred** | Requires schema migration (materialized balance) |
| #29 | Middleware blocks /_next/data | Already fixed | Bypasses all `/_next` paths |
| #30 | hasRedirected never resets | **Fixed** | Reset flag on `authenticated` status |
| #31 | No precondition recheck at resolution | **Fixed** | Added `checkPreconditions` call in `resolveActionInTx` |
| #32 | Leisure/social-call ignore sleep_state | **Fixed** | Added sleep-state guard in both handlers |
| #33 | Idempotency ignores payload | **Fixed** | Compare `JSON.stringify(payload)` on repeat key |
| #34 | Preview skips validation | **Fixed** | Preview now runs `validatePayload` + `checkPreconditions` |
| #35 | Preview ignores buff gains | **Fixed** | Preview estimates `perHourBonus * duration + instantDelta` |
| #36 | Meal payment to wrong account | **Fixed** | Changed target from `BILL_PAYMENT_SINK` to `NPC_VENDOR` |
| #37 | Waste disposal fee skipped | **Fixed** | Pay whatever the business can afford (partial payment) |
| #38 | Cancel idempotency key | Already fixed | Deterministic key by design |
| #39 | No max order quantity | **Fixed** | Added `.max(10000)` to qty schema |
| #40 | Fractional order quantities | **Fixed** | Added `.int()` to qty schema |

**Fixed: 12 | Already fixed: 8 | Deferred: 2**

---

## Fix Details

### Bug #24/#48 — Auth prefix bypass

**File:** `apps/api/src/plugins/auth.ts`

Changed `PUBLIC_PREFIXES` with `.startsWith(p)` to `PUBLIC_PATHS` with exact match + query-string support:
```
request.url === p || request.url.startsWith(p + '?')
```

**Test:** `auth.test.ts` → "does not bypass auth via path prefix trick"

---

### Bug #30 — hasRedirected never resets

**File:** `apps/web/src/components/require-auth.tsx`

Added `hasRedirected.current = false` when `status === 'authenticated'`.

**Verify:** Log out → log in → log out again → should redirect to `/login` each time.

---

### Bug #31 — No precondition recheck at resolution

**File:** `apps/api/src/services/action-engine.ts`

Added `handler.checkPreconditions(payload, lockedState)` in `resolveActionInTx` before calling `handler.resolve()`.

**Verify:** Queue a SLEEP → queue a LEISURE → fast-forward SLEEP → LEISURE resolution should fail with `ACTION_CONFLICT` since player just woke up (precondition re-evaluated).

---

### Bug #32 — Leisure/social-call ignore sleep_state

**Files:** `apps/api/src/handlers/leisure.handler.ts`, `apps/api/src/handlers/social-call.handler.ts`

Added `if (state.sleep_state !== 'awake') throw new ActionConflictError(...)` to `checkPreconditions` in both handlers.

**Tests:** `actions.test.ts` → "rejects LEISURE while sleeping", "rejects SOCIAL_CALL while sleeping"

---

### Bug #33 — Idempotency ignores payload

**File:** `apps/api/src/services/action-engine.ts`

After confirming type matches, compare `JSON.stringify(existing.payload)` vs `JSON.stringify(payload)`. Mismatch → 409 `IDEMPOTENCY_CONFLICT`.

**Test:** `actions.test.ts` → "rejects same key with different payload (409)"

---

### Bug #34 — Preview skips validation

**File:** `apps/api/src/routes/actions.ts`

Preview endpoint now calls `handler.validatePayload(payload)` and `handler.checkPreconditions(payload, state)`.

**Tests:** `actions.test.ts` → "rejects invalid payload in preview", "rejects preview of LEISURE while sleeping"

---

### Bug #35 — Preview ignores buff gains

**File:** `apps/api/src/routes/actions.ts`

EAT_MEAL preview now uses `MEAL_DEFINITIONS[quality]` to estimate total buff gain:
`perHourBonus[dim] * (perDimDurationOverrides[dim] ?? durationHours) + instantDelta[dim]`

**Test:** `actions.test.ts` → "STREET_FOOD preview shows estimated pv gain from buffs" (expects `vigorGain.pv === 4`)

---

### Bug #36 — Meal payment to wrong account

**File:** `apps/api/src/handlers/eat-meal.handler.ts`

Changed `transferCents` destination from `SYSTEM_ACCOUNTS.BILL_PAYMENT_SINK` to `SYSTEM_ACCOUNTS.NPC_VENDOR`.

**Test:** `actions.test.ts` → "meal payment ledger entry goes to NPC_VENDOR (account 5)"

---

### Bug #37 — Waste disposal fee skipped

**File:** `apps/api/src/services/business-service.ts`

Instead of skipping when business cannot fully pay, now pays `Math.min(fee, balance)` and tracks `wasteFeePaidCents` / `wasteFeeUnpaidCents` in the result.

**Verify:** Run a production job with waste output on a business with low balance → fee is partially charged instead of skipped entirely.

---

### Bug #39/#40 — Order qty validation

**Files:** `apps/api/src/handlers/market-place-order.handler.ts`, `apps/api/src/routes/market.ts`

Changed `qty: z.number().positive()` → `qty: z.number().int().positive().max(10000)` in both schemas.

**Tests:** `market.test.ts` → "rejects fractional qty", "rejects qty exceeding 10 000"
