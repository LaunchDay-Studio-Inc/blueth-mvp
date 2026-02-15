# Queue UI — Action Timers & Completion Feed

## Overview

The Action Queue dropdown in the game HUD header shows real-time countdown timers for running actions, scheduled start/end times for pending actions, and a feed of recently completed actions with money/vigor deltas.

## Queue Dropdown Sections

### 1. Running Action

When an action is in progress, it shows:
- Action name with spinning loader icon
- Countdown timer: `Xm XXs left` (or `Xh XXm XXs` for long actions)
- Ends-at wall clock time: `ends HH:MM`
- Progress bar with percentage

### 2. Up Next (Pending/Scheduled)

Shows the next 5 queued actions with their scheduled start and end times:
```
Eat Meal      14:30 → 14:35
Leisure       14:35 → 14:50
```

### 3. Last Completed

Shows the 5 most recent completed/failed actions from history:
- Completed: green check + action name + delta summary + relative time
- Failed: red alert + action name + "failed" chip + relative time (failure reason in tooltip)

Delta summaries show money earned/spent and vigor changes:
```
+B50.00           (earned money)
-B5.00, +2 SV     (spent money, gained vigor)
-25 PV, -8 MV     (vigor cost)
```

## Timer Mechanics

### Server Timestamps

All timing is based on server-provided `scheduled_for` and `duration_seconds`:
```
endTime = new Date(scheduled_for).getTime() + duration_seconds * 1000
remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
```

The client clock updates every 1 second via `setInterval`.

### Auto-Refetch on Completion

When the countdown reaches 0, the timer fires a one-time callback that invalidates both `actions.all` and `player.all` query keys. This triggers React Query to refetch the queue (picking up the resolved action) and the player state (updated vigor/balance).

A `useRef` flag ensures the callback fires exactly once per action.

### Dynamic Polling

- **Running action exists**: Queue refetches every 5 seconds (detects completion quickly)
- **No running action**: Queue refetches every 15 seconds (idle polling)
- **History**: Always refetches every 30 seconds

## Toast Messages

On action submission, the toast now includes the end time:
```
Queued: Work shift — ends at 14:30
```

For instant actions (duration = 0), the toast says:
```
Work shift completed
```

## Action Result Deltas

Action results are stored as heterogeneous JSON per handler. The `extractActionDeltas()` function normalizes them:

| Action Type | Money Field | Vigor Field |
|---|---|---|
| WORK_SHIFT | `result.payCents` (earned) | `result.vigorCost` (negated) |
| EAT_MEAL | `-result.costCents` (spent) | `result.instantDelta` |
| SLEEP | — | `result.vigorGained` |
| LEISURE | — | `result.instantDelta` |
| SOCIAL_CALL | — | `result.vigorDelta` |
| MARKET_PLACE_ORDER | computed from `result.fills[]` | — |
| MARKET_DAY_TRADE | — | `result.mvCost`, `result.spvStress` |

## Mobile Bottom Drawer

On viewports below `md` (768px), the dropdown transforms into a bottom drawer:
- Full-width, anchored to bottom of screen
- Max height 70vh, scrollable
- Pill-shaped drag handle indicator (cosmetic)
- Semi-transparent backdrop with blur (tap to dismiss)
- Slide-up animation

## Component Structure

```
apps/web/src/
├── components/
│   └── action-queue-dropdown.tsx  — Main dropdown/drawer + ActionTimer
├── hooks/
│   ├── use-action-queue.ts        — Queue fetching (dynamic 5s/15s polling)
│   ├── use-action-history.ts      — History fetching (30s polling)
│   └── use-submit-action.ts       — Mutation with enhanced toast
└── lib/
    └── action-results.ts          — extractActionDeltas() + formatDeltaSummary()
```

## Data Flow

```
useActionQueue(hasRunning)──→ GET /actions/queue ─→ running + pending items
                                                     │
                ActionTimer(item, onComplete) ←──────┤
                    │ countdown reaches 0             │
                    └─→ invalidateQueries()           │
                                                      │
useActionHistory()──→ GET /actions/history ──→ last 5 completed/failed
                                                │
                extractActionDeltas(type, result)
                    │
                formatDeltaSummary(deltas) ──→ "+B50.00, -25 PV"
```
