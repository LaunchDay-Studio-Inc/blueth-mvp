# 📘 Blueth City — Core Bible (V2)
## Clickable Map RPG Simulator — **Two-System Deep MVP** (Vigor + Economy)
**Single‑player first. Multiplayer‑ready later. Monetizable without grief.**

> **Core loop:** **Vigor → Work/Trade/Produce → ₿ Money → Meals/Housing/Leisure → Vigor**
> Everything else is introduced only as **minimal stubs** (interfaces + hooks) so future systems slot in without rewriting.

---

## 0) Build Contract (Ship‑Safe, No Interpretation)

### 0.1 What ships in MVP (only these are "real systems")
1) **Vigor System** (5 dimensions + regen/depletion + cascade)
2) **Economy System** (jobs, goods, market, production, bills, sinks)

### 0.2 What does **NOT** ship (stubs only)
Politics, crime, law, health, education, property ownership, environment, factions, PvP, etc.
They appear as **"Module Stubs"**: definitions, data hooks, and placeholder UI entries — **no gameplay impact** until implemented.

### 0.3 Non‑negotiable principles
- **No hard lockouts:** low Vigor reduces efficiency, never removes all actions.
- **Failure‑resistant:** bankruptcy and burnout are recoverable (soft landings, recovery paths).
- **Economic integrity:** ledgered money, bounded formulas, no infinite loops.
- **Anti‑grief monetization:** money never buys power; cosmetics and convenience only.
- **Single-player first:** the "city" is simulated by NPC demand/supply and events.

---

## 1) Game Format & Player Flow

### 1.1 Core experience
- **Clickable map** of **Blueth City** (districts → locations → actions).
- Actions are **menu-driven**, produce **timed outcomes**, and update state on a **real-time clock**.
- Player plays a *life routine*: work, eat, sleep, trade, build.

### 1.2 Time model (MVP)
- **1 real hour = 1 game hour**
- Simulation ticks:
  - **Hourly:** Vigor update, bills accrual, work shift progress, production timers
  - **Every 6 hours:** NPC demand/supply refresh, market smoothing pass
  - **Daily (00:00):** rent due checks, daily summary, optional event roll

### 1.3 Input model (player actions)
Actions are:
- **Immediate** (resolve now) or
- **Queued** (resolve later; player can queue up to `QUEUE_MAX` actions)

**Queue rules (anti-exploit + QoL)**
- `QUEUE_MAX = 12` actions
- Each queued action must have a **minimum duration** of 5 minutes.
- Queue cannot include actions that would exceed **hard caps** (e.g., eating 10 meals at once).

### 1.4 Clickable map (MVP)
**12 districts** exist as map regions (for future parity), but in MVP they are **flavor + pricing modifiers** only.

Each district has 3–6 locations:
- **Home**
- **Job Center**
- **Market (BCE)**
- **Food**
- **Leisure**
- **Business Office** (unlocks when owning a business)

Travel is **instant in MVP** (no transport system yet).
A future Transport module replaces instant travel with time/cost.

---

## 2) Core Systems Overview

### 2.1 Vigor (life-fuel)
Five stats, default **0–100**:
- **PV** Physical
- **MV** Mental
- **SV** Social
- **CV** Civic (economic civics only in MVP)
- **SpV** Spiritual (secular meaning/resilience)

### 2.2 Economy
- Currency: **Blueth (₿)**, 1 ₿ = 100 ¢
- Core loops:
  - **Jobs → Wages**
  - **BCE Market → Trade**
  - **Businesses → Production Chains**
  - **Needs → Costs (meals, rent, utilities)**

---

# 3) The Vigor System (Deep Spec)

## 3.1 State
Each player stores:
- `PV, MV, SV, CV, SpV` (current)
- `PVcap, MVcap, SVcap, CVcap, SpVcap` (caps; MVP default 100)
- `SleepState` (awake/sleeping)
- `LastMealTimes` (timestamps for up to 3 meals/day)
- `BurnoutFlags` (derived; see 3.6)

All vigor values are clamped:
- `V = clamp(V, 0, Vcap)`

## 3.2 Base regen rates (per hour)
```
PV  = 2.0
MV  = 1.5
SV  = 1.0
CV  = 0.5
SpV = 0.3
```

## 3.3 Circadian multipliers
Local time multipliers applied to base regen:

- **Morning (06–12):** PV, MV × **1.5**
- **Afternoon (12–18):** SV, CV × **1.5**
- **Evening (18–24):** SpV × **1.5**, SV × **1.2**
- **Night (00–06):** all × **0.5**, but if **Sleeping**, PV × **2.0** (instead of 0.5)

## 3.4 Meals (3/day pressure + recovery bridge)
Players should eat **3 meals/day**. Missing meals causes penalties (3.5).

Meal types (effect windows stack additively but capped per hour):
| Meal Quality | PV Regen Bonus | MV Regen Bonus | Extra | Typical Cost |
|---|---:|---:|---|---:|
| Street Food | +2/hr for 2hr | — | — | ₿1–5 |
| Home Cooked | +3/hr for 4hr | +1/hr for 2hr | — | ₿5–15 |
| Restaurant | +4/hr for 3hr | +2/hr for 3hr | — | ₿15–50 |
| Fine Dining | +5/hr for 4hr | +3/hr for 4hr | SV +2 (instant) | ₿50–200 |
| Nutrient Optimal | +6/hr for 6hr | +4/hr for 6hr | — | ₿100–300 |

**Meal cap rule (anti-exploit):**
- Total meal regen bonus per dimension per hour is capped at **+8/hr**.

## 3.5 Needs penalties (failure‑resistant)
At daily reset (00:00), compute meal compliance:
- `MealsEatenToday ∈ {0..3}`

Apply **penalties** if < 3 (penalties are *recoverable* within 1–2 days):
- If 2 meals: `PVregen ×0.9`, `MVregen ×0.95` for 24h
- If 1 meal: `PVregen ×0.75`, `MVregen ×0.85`, `SpVregen ×0.9` for 24h
- If 0 meals: `PVregen ×0.5`, `MVregen ×0.7`, `SpVregen ×0.8` for 24h, plus immediate `PV -10`

**No "death spiral":** penalties do **not** stack beyond 3 days; they clamp to a maximum severity.

## 3.6 Cascading failure (burnout realism, bounded)
**Critical threshold:** any dimension < **20** triggers cross-drain.

Interaction matrix (coefficients):
| From \ To | PV | MV | SV | CV | SpV |
|---|---:|---:|---:|---:|---:|
| PV  | 1.0 | 0.3 | 0.1 | 0.0 | 0.1 |
| MV  | 0.3 | 1.0 | 0.4 | 0.3 | 0.4 |
| SV  | 0.1 | 0.4 | 1.0 | 0.2 | 0.3 |
| CV  | 0.0 | 0.3 | 0.2 | 1.0 | 0.2 |
| SpV | 0.1 | 0.4 | 0.3 | 0.2 | 1.0 |

**Critical cross-drain rate:**
- `CRITICAL_DRAIN_RATE = 1.5 per hour`

Rule:
- For each dimension `A` that is < 20:
  - For each other dimension `B`:
    - `B -= coeff[A→B] * CRITICAL_DRAIN_RATE` per hour

**Bound:** total cross-drain per hour across all sources is capped at **3.0** per dimension.

## 3.7 Sleep
Sleep is an action:
- Duration options: 2h / 4h / 6h / 8h
- While sleeping:
  - PV regen uses night multiplier **2.0**
  - MV regen × **1.2**
  - SV/CV/SpV regen unchanged
- Waking early cancels remaining sleep.

## 3.8 Vigor costs for economic actions (canonical list)
Every economy action has a defined Vigor cost vector.
Costs are applied on action completion.

**Work shifts**
- Short shift (2h):
  - Physical job: `PV-10 MV-3`
  - Admin job: `MV-10 CV-2`
  - Service job: `SV-8 MV-4`
- Full shift (8h):
  - Physical: `PV-25 MV-8`
  - Admin: `MV-25 CV-6`
  - Service: `SV-18 MV-10`

**Trading / market**
- Place/modify orders (per session): `MV-4`
- Market "day trading" session (1h): `MV-10`, optional `SpV-2` if repeated 3+ times/day (stress)

**Business operations**
- Production planning (30m): `MV-6 CV-2`
- Hiring session (30m): `SV-6 MV-4`
- Compliance/admin (30m): `CV-6 MV-2`

**Recovery actions**
- Leisure (1h): `MV+4 SpV+2` (regen bonus, see 5.8)
- Social call (15m): `SV+3` (instant), `MV+1` (small)

---

# 4) The Economy System (Deep Spec)

## 4.1 Ledger integrity (non-negotiable)
All money movement is double-entry in a ledger:
- Every transaction has: `from`, `to`, `amount`, `type`, `timestamp`, `source_action_id`.

No system can create or destroy money except explicit sinks/sources:
- **Sources:** job wages, NPC subsidies (optional), bank loans (later)
- **Sinks:** market fees, rent, utilities, business fees, NPC consumption sink

## 4.2 The minimal goods list (ships)
Essentials (drive Vigor recovery):
- **Raw Food**
- **Processed Food**
- **Fresh Water**
- **Energy (Utility)**

Stability:
- **Housing Rent** (service)
- **Transportation** (service stub; MVP is "instant travel" but cost can exist later)
- **Entertainment** (service; used for Leisure)

Growth inputs:
- **Materials**
- **Building Materials**
- **Industrial Machinery** (durable input)
- **Consumer Goods** (optional sink)

## 4.3 Jobs (starter economy)
Jobs are stable income and the default daily action.

### 4.3.1 Job families
- **Physical labor** (PV heavy)
- **Admin** (MV/CV heavy)
- **Service** (SV/MV heavy)
- **Management** (MV heavy, higher variance)

### 4.3.2 Performance formula (bounded)
```
Performance =
  Skill
  * (PV/100)^(wPV)
  * (MV/100)^(wMV)
  * clamp(Satisfaction, 0.5, 1.3)
  * clamp(EquipmentQuality, 0.5, 1.5)
```

Default weights:
- Physical jobs: `wPV=1.0, wMV=0.3`
- Admin: `wPV=0.2, wMV=1.0`
- Service: `wPV=0.2, wMV=0.4` + SV modifier:
  - multiply by `(0.7 + SV/300)` (range ~0.7–1.03)

Pay:
```
DailyPay = BaseWage * clamp(Performance, 0.4, 1.5)
```

## 4.4 Bills (core money sinks)
MVP bills:
- **Meals** (player-chosen)
- **Rent** (daily or monthly; MVP recommends daily to reduce surprise)
- **Utilities** (small daily sink tied to housing tier)
- **Market fee** (1% default; tunable)

**Rent tiers (example)**
- Shelter: ₿0/day, no bonus
- Cheap room: ₿10/day, PV regen +0.2/hr
- Studio: ₿20/day, PV +0.5/hr
- 1BR: ₿35/day, PV +0.8/hr, MV +0.2/hr
- Comfortable: ₿60/day, PV +1.2/hr, MV +0.4/hr, SV +0.2/hr

## 4.5 BCE Market (player-facing exchange)
Single-player MVP still uses a full order-book exchange, but the "other side" is NPC market makers + NPC consumers/producers.

### 4.5.1 Order types
- Market order
- Limit order

### 4.5.2 Price discovery (simple, stable)
Use order-book for immediate trades; also maintain a reference price per good:
```
P_ref(t) = P_ref(t-1) * (1 + α(g) * (D - S) / max(S, 1))
```
Recommended α:
- Essentials: 0.05–0.08
- Non-essentials: 0.10–0.12

**Circuit breaker**
- If price moves > **25%** within 6 hours → trading halts for 1 hour, then resumes with widened spreads.

### 4.5.3 NPC demand/supply (single-player engine)
Every 6 hours:
- NPCs compute demand for essentials based on a target "affordability index"
- NPC producers supply essentials with capacity tied to "economic health"
- This creates living price movement without real players.

## 4.6 Production chains (business engine)
Businesses convert inputs → outputs over time.

### 4.6.1 Recipes (ship 2)
**Processed Food**
- Inputs: Raw Food×3, Water×1, Energy×1, Labor×2 worker-hours, MachineryDep×0.01
- Output: Processed Food×5
- Byproduct: Waste×1 (MVP: disposal fee sink)

**Building Materials**
- Inputs: Materials×2, Energy×2, Labor×3 worker-hours, MachineryDep×0.02
- Output: Building Materials×3

### 4.6.2 Business loop (MVP)
- Register business (fee)
- Rent location (daily fee)
- Buy machinery (capex)
- Hire NPC workers (simple satisfaction)
- Buy inputs (BCE)
- Schedule production
- Sell outputs (BCE)

### 4.6.3 Worker satisfaction (minimal)
Satisfaction ∈ [0, 1.3], default 1.0.
Satisfaction decreases if wages are below "fair wage band" and if hours are consistently long.

---

# 5) Economy ↔ Vigor Integration (The Whole Game)

## 5.1 The core loop (formal)
```
EarningPower = f(Vigor, Skills, JobType, MarketState)
RecoveryPower = f(₿, MealQuality, HousingTier, LeisureTime)

V_next = clamp(V + Regen(RecoveryPower) - Depletion(EarningPower), 0, Vcap)
```

## 5.2 Soft gating (never hard locks)
- Low PV reduces physical job output; player can:
  - take admin/service shifts,
  - trade lightly,
  - do business planning,
  - rest/eat.
- Low MV reduces trading/business planning accuracy; player can:
  - take simple physical work,
  - do leisure,
  - sleep.
- Low SV affects service jobs and hiring outcomes.
- Low CV increases fees and slows admin actions.
- Low SpV adds a mild global regen penalty (max -10%), pushing players to maintain meaning/leisure.

## 5.3 Anti-exploit via human rhythms
Because regen and effectiveness depend on time-of-day, meals, and sleep:
- Perfect "always online" patterns are naturally suboptimal.
- Overwork causes cascade.
- The best strategy is **human**.

## 5.4 Recovery actions (ships)
- **Sleep** (queued)
- **Eat meal** (queued)
- **Leisure** (1h):
  - Adds regen bonus for next 3 hours: `MV +1/hr`, `SpV +0.5/hr`

---

# 6) Player Progression (Within Two Systems)

## 6.1 Skills (minimal set)
- Labor
- Admin
- Service
- Management
- Trading

Skills scale 0.1–2.0 (soft cap) and increase slowly via use.

## 6.2 Milestones (optional MVP)
Milestones are **cosmetic + narrative** only in MVP (badges, logs).
No power benefits.

---

# 7) Single‑Player First, Multiplayer Later (Expansion‑Safe)

## 7.1 Single-player world simulation
- NPC population drives demand/supply.
- The market is a "city exchange" with NPC orders.
- Businesses can hire NPC labor.

## 7.2 Multiplayer conversion plan (later)
When multiplayer is added:
- Player-to-player trading overlays BCE (same order-book).
- Co-op employment: players can work for player businesses.
- Grief protection begins with **soft PvP** (economic competition only), no crime/PvP combat until systems exist.

**Compatibility rule:** Multiplayer introduces **more actors**, not new mechanics.
Economy + Vigor remain identical.

---

# 8) Monetization Without Grief (Best Action Plan)

## 8.1 Best action (practical)
- **Build MVP as single-player first** with *no monetization pressure*.
- When retention loop is proven (daily ritual), introduce monetization that is:
  - **cosmetic**, **convenience**, and **supporter** based,
  - never sells money, vigor, or advantages.

## 8.2 Allowed monetization (safe)
**A) Subscription (optional)**
- Free tier: full gameplay access.
- Paid tiers provide:
  - cosmetic profile themes,
  - expanded activity logs,
  - optional analytics dashboard (graphs, history),
  - extra queue planning UI (not more actions, just better planning tools),
  - priority support.

**B) Cosmetic marketplace**
- Profile skins, map themes, character description styles,
- property description decorations (pure flavor text),
- seasonal themes.

**C) DLC/Expansions**
- New systems as paid expansions **only if**:
  - free players can still interact indirectly (buy goods/services produced by DLC owners),
  - expansions grant **new gameplay paths**, not raw power.

## 8.3 Banned monetization (never)
- Vigor refills/boosts
- Selling ₿ currency
- Loot boxes / randomized paid rewards
- Paid protection from other players
- Paid advantage in markets (fees, access, speed)
- Pay-to-skip time

---

# 9) Future Systems — Minimal Stubs (Interfaces Only)

Each future module must connect through **two bridges only**:
1) **Vigor costs/rewards**
2) **Economy goods/services/sinks/sources**

## 9.1 Module stub template (must follow)
For any new system `X`, define:
- `X.Actions[]` with:
  - Time cost
  - Vigor delta vector
  - Money delta (fees, rewards)
  - Required items/services (if any)
  - Outputs (items, status flags)
- `X.State` (minimal)
- `X.EconomyHooks` (what goods/services it consumes/produces)
- `X.VigorHooks` (what vigor dimensions it targets)

## 9.2 Stub list (super minimal)
- Politics/Government: taxes/fees (Economy), CV costs, CV rewards.
- Law/Justice: legal fees, CV drain, MV drain (stress).
- Crime: economic loss, SpV drain; must never be the primary loop.
- Healthcare: medical services cost, PV/MV recovery.
- Education: tuition cost, MV costs, long-term skill cap changes.
- Real estate ownership: property as economic asset; housing bonuses already exist.
- Environment: affects food/water supply and district pricing modifiers.
- Social/Factions: SV regen sources, economic cooperation interfaces, no hard advantages.

---

# 10) MVP Content List (What to Actually Implement)

## 10.1 Map + UI screens (ship)
- City Map (districts)
- Vigor Panel
- Wallet + Ledger view
- Bills (meals/rent/utilities)
- Job Center
- Market (BCE): buy/sell, order book, history
- Business: create, inventory, production queue, sell outputs
- Daily Summary

## 10.2 Starter "day 1" loop (must feel good)
- Starting money: **₿500**
- Player can:
  - choose housing tier,
  - take a short shift,
  - buy meals,
  - see Vigor move in a satisfying way,
  - end day with a meaningful decision.

---

# 11) Balance Constants (Start Values)
```
STARTING:
  StartingMoney = ₿500
  VigorCaps = 100 each
  QUEUE_MAX = 12

VIGOR:
  BaseRegen/hr = PV 2.0, MV 1.5, SV 1.0, CV 0.5, SpV 0.3
  CriticalThreshold = 20
  CRITICAL_DRAIN_RATE = 1.5/hr
  CrossDrainCapPerDim = 3.0/hr
  MealBonusCapPerDim = +8/hr

ECONOMY:
  MarketFee = 1%
  Essentials α = 0.05–0.08
  CircuitBreaker = 25% move in 6h → 1h halt
```

---

# 12) Build Plan (Minimal, Failure‑Resistant)

### Phase A — Vigor engine (first)
- Regen, meals, sleep, cascade, UI panel.

### Phase B — Economy engine (minimum playable)
- Wallet/ledger, jobs, bills, BCE with NPC orders.

### Phase C — Businesses + recipes
- Registration, location rent, inputs/outputs, hire NPC workers.

### Phase D — Polish + anti-exploit
- Circuit breakers, bounds checks, anomaly logging, tuning.

---



---

# 13) Technical Architecture (Longevity + "Won't Fall Over")

This section is **not** a gameplay system. It exists to keep the two systems safe at scale.

## 13.1 Action execution model (the core reliability pattern)
Every player input becomes an **Action** with:
- `action_id` (UUID)
- `player_id`
- `type` (enum)
- `payload` (validated)
- `status` (pending/running/committed/failed)
- `scheduled_for` (timestamp)
- `created_at`, `started_at`, `finished_at`
- `idempotency_key` (client-generated, required)

**Rule:** an action is applied **exactly once** to the authoritative DB using a single transaction:
1) validate
2) lock player row (or use advisory lock)
3) re-check requirements (money/vigor/inventory)
4) apply deltas (vigor + economy + inventory + ledger)
5) write ledger entries
6) mark action committed

If the server repeats the same request (network retry), the idempotency key returns the already-committed result.

## 13.2 Stateless API, authoritative DB
- API servers hold **no** player truth in memory.
- DB is the source of truth for:
  - player state
  - ledger
  - market orders
  - production queues
  - scheduled actions

This is what lets you scale horizontally later without logic divergence.

## 13.3 Background workers (required)
You need two worker types:
1) **Scheduler worker**: picks pending actions whose `scheduled_for <= now()`
2) **Tick worker**: runs hourly/6-hour/daily tick jobs (NPC market, bills, vigor regen)

**All tick jobs must be idempotent** and keyed by `(tick_type, tick_timestamp)`.

## 13.4 Concurrency at 10k–50k players
- Prefer **short DB transactions** (sub-50ms typical).
- Use **row-level locks** per player for action commits.
- Avoid global locks; for market, lock **order rows** only.
- Partition ledger by month (later) if needed.
- Put read-heavy endpoints behind cache (Redis) later; do not require cache correctness.

## 13.5 Observability (minimum)
- structured logs per `action_id`
- metrics: p95 latency, DB connections, action failures, deadlocks, queue depth
- alert on: high failure rate, tick drift, transaction retries

## 13.6 Anti-cheat / anti-exploit
- Server validates **everything** (never trust client).
- Rate limits per IP + per account.
- Anomaly detectors (simple):
  - money delta > X/day
  - orders spam > N/min
  - repeated failed actions > N/min

---

# 14) MVP Cloud Setup (Cost-aware, Upgrade-safe)

## 14.1 Database choice
Use **PostgreSQL** for the MVP:
- strong transactions for the ledger
- good indexing for order books
- mature tooling for backups and migrations

## 14.2 Cloud SQL HA guidance (money vs risk)
- For MVP, run **single-zone** (no standby) to save cost.
- Turn on **automated backups** + **PITR** from day 1.

**You can enable HA later** by upgrading the instance to regional/HA (expect a maintenance window and extra cost).
Design stays the same because the DB remains authoritative.

## 14.3 VM/API
- One VM (Ubuntu 24) can run:
  - web (static frontend)
  - API
  - workers
  - reverse proxy (Caddy/Nginx)
- Keep API stateless so you can split into multiple VMs later.

## 14.4 Upgrade path (no rewrite)
1) Scale VM up (more CPU/RAM)
2) Add Redis cache (optional)
3) Add 2nd VM for API/workers
4) Add load balancer + horizontal scaling
5) Move heavy ticks to dedicated worker pool

---

# 15) Minimal Data Model (MVP Tables)

## 15.1 Core tables
- `players` (id, created_at, …)
- `player_state` (player_id PK, PV, MV, SV, CV, SpV, caps, housing_tier, last_meals…, updated_at)
- `actions` (action_id PK, player_id, type, payload jsonb, status, scheduled_for, idempotency_key unique(player_id, key), timestamps)
- `ledger_accounts` (id, owner_type, owner_id, currency)
- `ledger_entries` (id, action_id, from_account, to_account, amount, type, created_at)
- `goods` (id, code, name, is_essential)
- `inventories` (player_id, good_id, qty)
- `market_orders` (order_id, player_id_or_npc, good_id, side, price, qty_open, status, created_at)
- `market_trades` (trade_id, good_id, buy_order_id, sell_order_id, price, qty, created_at)
- `businesses` (id, owner_player_id, name, location, created_at)
- `business_workers` (business_id, npc_id, wage, satisfaction, hours)
- `production_jobs` (id, business_id, recipe_id, status, started_at, finishes_at)
- `npc_market_state` (good_id PK, demand, supply, ref_price, updated_at)

## 15.2 Migration discipline
- Use versioned migrations from day 1.
- Never edit existing migrations; always add a new one.

---

## Appendix: "Torn-like, but better" guardrails
- The best loop is "live your life," not "grief others."
- Competition is **economic**, not predatory.
- If you later add crime/PvP, it must be opt-in and bounded by cooldowns and protections.


## End
