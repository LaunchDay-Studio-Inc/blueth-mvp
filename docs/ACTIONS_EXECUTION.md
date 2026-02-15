# Actions Execution Model

## How Actions Are Queued

1. **Frontend** calls `POST /actions` with `{ type, payload, idempotencyKey }`.
2. **`submitAction()`** in `apps/api/src/services/action-engine.ts`:
   - Looks up the handler from the registry by `type`
   - Validates payload via `handler.validatePayload()`
   - Opens a transaction:
     - Locks player state with `SELECT ... FOR UPDATE`
     - Checks queue limit (max 12 concurrent pending/scheduled/running)
     - Runs `handler.checkPreconditions()` against locked state
     - Calculates `scheduled_for` = MAX(NOW(), end of last queued action)
     - Inserts action row into the `actions` table
     - If `duration_seconds = 0` (instant): resolves immediately in-transaction
     - Otherwise: returns status `scheduled` (HTTP 202)
   - Idempotency: duplicate `(player_id, idempotencyKey)` returns the cached result

### Action Table Schema

| Column | Purpose |
|--------|---------|
| `action_id` | UUID PK |
| `player_id` | FK to players |
| `type` | e.g. `WORK_SHIFT`, `EAT_MEAL` |
| `payload` | JSONB input data |
| `status` | `pending` / `scheduled` / `running` / `completed` / `failed` |
| `scheduled_for` | When the action begins |
| `duration_seconds` | How long it takes (0 = instant) |
| `idempotency_key` | Unique per player |
| `result` | JSONB output from handler |

## How Actions Complete

Three resolution paths, from fastest to slowest:

### 1. Instant Resolution (duration = 0)
- **EAT_MEAL** resolves synchronously within `submitAction()`.
- API returns HTTP 200 with the result immediately.

### 2. Lazy Resolution (on next API call)
- When a player hits `POST /actions` or `GET /actions/queue`, the server calls `resolveAllDue(playerId)`.
- This queries for all `scheduled` actions where `scheduled_for + duration_seconds <= NOW()`.
- Each is resolved in its own transaction.

### 3. Scheduler Worker (background polling)
- `apps/api/src/workers/scheduler.ts` — standalone process polling every 5 seconds.
- Claims batches of up to 50 due actions using `FOR UPDATE SKIP LOCKED`.
- Resolves each via `resolveScheduledActionById()`.
- This ensures actions complete even if the player doesn't make an API request.

### Resolution Flow (`resolveActionInTx`)

1. Marks action status as `running`
2. Loads player wallet account
3. Calls `handler.resolve(ctx)` — this applies vigor/money effects
4. On success: marks `completed`, stores `result` JSONB
5. On transient failure: re-schedules with `retry_count + 1` (max 3)
6. On permanent failure: marks `failed`, stores error

## Action Durations and Effects

| Action | Duration | Effects on Completion |
|--------|----------|----------------------|
| `EAT_MEAL` | Instant | Charges meal cost, creates vigor buffs (per-hour PV/MV regen), instant SV delta for FINE_DINING |
| `SOCIAL_CALL` | 15 min | Instant delta: SV +3, MV +1 |
| `LEISURE` | 1 hour | Instant delta: MV +4, SpV +2. Creates buff: MV +1/hr, SpV +0.5/hr for 3 hours |
| `WORK_SHIFT` (short) | 2 hours | Vigor cost (varies by job family), pay calculated from performance, skill XP |
| `WORK_SHIFT` (full) | 8 hours | Same as short but larger cost/reward |
| `SLEEP` | 2-8 hours | Sets sleep_state='sleeping' on submit, vigor regen on completion, wakes up |

## Dev Fast-Forward Tool

### Endpoint: `POST /debug/advance`

Only available when `NODE_ENV !== 'production'`.

**Request:** `{ minutes: number }` (1-1440)

**What it does:**
1. Shifts `scheduled_for` backwards by N minutes for all of the authenticated player's active actions
2. Calls `resolveAllDue(playerId)` to process any actions that are now due
3. Returns updated player state + count of shifted actions

**Frontend:** Settings page has "+15m", "+30m", "+60m", "+120m" buttons (dev mode only) that call this endpoint and refresh all queries.

### How to test an action end-to-end

1. Go to Jobs/Food/Leisure page
2. Click "Go" on any action
3. See "Queued: ..." toast
4. Go to Settings
5. Click "+60m" (or appropriate duration)
6. Go back — vigor/balance will reflect the completed action
7. Queue dropdown in top bar shows "completed" status

## Vigor Change Mechanisms

### Instant Deltas
Applied directly in handler `resolve()` via `addVigor()`/`subVigor()`. Clamped to [0, cap].

### Buffs
Created by EAT_MEAL and LEISURE handlers. Stored in `player_state.active_buffs` as JSONB.
Each buff has `startsAt`, `endsAt`, `perHourBonusByDim`. Consumed during hourly tick.

### Hourly Tick
Formula per dimension:
```
regen = baseRate * circadian * sleep * penalty * spvRegen
net = regen + buffBonus - cascadeDrain
newValue = clamp(current + net, 0, cap)
```

Base rates: PV 2.0, MV 1.5, SV 1.0, CV 0.5, SpV 0.3 per hour.
