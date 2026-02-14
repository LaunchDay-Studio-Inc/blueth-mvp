# Bible Compliance Report — Vigor + Economy

**Date:** 2026-02-14
**Bible version:** Blueth City Core Bible V2 (`docs/BluethCity_Core_Bible_v2.md`)
**Scope:** Vigor system (`packages/core/src/vigor.ts`, `soft-gates.ts`, `types.ts`) and
Economy system (`packages/core/src/economy.ts`, `money.ts`)

---

## Legend

| Status | Meaning |
|--------|---------|
| MATCH | Code matches Bible exactly |
| MISMATCH | Code differs from Bible — fix required |
| RANGE | Bible gives a range; code picks a value within or near range |
| ADDITION | Code adds something not specified in Bible (acceptable extension) |

---

## 1) Vigor System

### 1.1 Dimensions & State (Bible §3.1)

| Requirement | Status | File | Notes |
|---|---|---|---|
| 5 dimensions: PV, MV, SV, CV, SpV | MATCH | `types.ts:7-13` | |
| Caps per dim (default 100) | MATCH | `vigor.ts:23` | `DEFAULT_CAP = 100` |
| Clamp to `[0, Vcap]` | MATCH | `vigor.ts:185-187` | `clampDim` function |
| SleepState: awake/sleeping | MATCH | `types.ts:30` | Also has `exhausted` (extension) |
| LastMealTimes tracked | MATCH | `types.ts:69` | |
| mealPenaltyLevel (0..3) | MATCH | `types.ts:71` | |

### 1.2 Base Regen Rates (Bible §3.2)

| Dim | Bible | Code | Status | Location |
|-----|-------|------|--------|----------|
| PV | 2.0/hr | 2.0 | MATCH | `vigor.ts:32` |
| MV | 1.5/hr | 1.5 | MATCH | `vigor.ts:33` |
| SV | 1.0/hr | 1.0 | MATCH | `vigor.ts:34` |
| CV | 0.5/hr | 0.5 | MATCH | `vigor.ts:35` |
| SpV | 0.3/hr | 0.3 | MATCH | `vigor.ts:36` |

### 1.3 Circadian Multipliers (Bible §3.3)

| Period | Bible | Code | Status | Location |
|--------|-------|------|--------|----------|
| Morning (06-12): PV, MV x1.5 | `{pv:1.5, mv:1.5}` | `{pv:1.5, mv:1.5}` | MATCH | `vigor.ts:45` |
| Afternoon (12-18): SV, CV x1.5 | `{sv:1.5, cv:1.5}` | `{sv:1.5, cv:1.5}` | MATCH | `vigor.ts:46` |
| Evening (18-24): SpV x1.5, SV x1.2 | `{spv:1.5, sv:1.2}` | `{spv:1.5, sv:1.2}` | MATCH | `vigor.ts:47` |
| Night (00-06): all x0.5 | all dims 0.5 | all dims 0.5 | MATCH | `vigor.ts:48` |

### 1.4 Sleep Rules (Bible §3.3 + §3.7)

| Requirement | Bible | Code | Status | Location |
|---|---|---|---|---|
| Night sleeping: PV x2.0 | PV x2.0 instead of 0.5 | `NIGHT_SLEEP_OVERRIDES.pv = 2.0` | MATCH | `vigor.ts:53` |
| Sleeping (any time): MV x1.2 | MV regen x1.2 | `getSleepMultiplier` returns 1.2 for MV | MATCH | `vigor.ts:210` |
| Night sleeping: MV override | Bible: no MV night override (MV stays 0.5; x1.2 is general sleep effect) | Code: `NIGHT_SLEEP_OVERRIDES.mv = 1.2` PLUS `getSleepMultiplier` 1.2 → double-counting (1.2 × 1.2 = 1.44) | **MISMATCH** | `vigor.ts:54` |
| SV/CV/SpV unchanged while sleeping | unchanged | unchanged (sleep mult = 1.0) | MATCH | `vigor.ts:211` |

**Fix required:** Remove `mv: 1.2` from `NIGHT_SLEEP_OVERRIDES`. MV x1.2 is already handled by `getSleepMultiplier`. Adding it as a night override causes double-counting.

### 1.5 Meals (Bible §3.4)

| Meal | PV Bonus | MV Bonus | Extra | Duration | Code Status |
|---|---|---|---|---|---|
| Street Food | +2/hr | — | — | 2hr | MATCH (`vigor.ts:90-93`) |
| Home Cooked | +3/hr | +1/hr (2hr) | — | 4hr | MATCH (`vigor.ts:94-98`) |
| Restaurant | +4/hr | +2/hr | — | 3hr | MATCH (`vigor.ts:99-102`) |
| Fine Dining | +5/hr | +3/hr | SV +2 instant | 4hr | MATCH (`vigor.ts:103-107`) |
| Nutrient Optimal | +6/hr | +4/hr | — | 6hr | MATCH (`vigor.ts:108-111`) |

**Meal buff cap (anti-exploit):** Bible says +8/hr per dim. Code: `BUFF_CAP_PER_DIM_PER_HOUR = 8.0` — **MATCH** (`vigor.ts:27`)

### 1.6 Meal Penalties (Bible §3.5)

| Meals Eaten | Bible PV mult | Code PV mult | Bible MV mult | Code MV mult | Bible SpV mult | Code SpV mult | Immediate | Status |
|---|---|---|---|---|---|---|---|---|
| 2 | 0.9 | 0.9 | 0.95 | 0.95 | — | — | — | MATCH |
| 1 | 0.75 | 0.75 | 0.85 | 0.85 | 0.9 | 0.9 | — | MATCH |
| 0 | 0.5 | 0.5 | 0.7 | 0.7 | 0.8 | 0.8 | PV -10 | MATCH |

**No death spiral clamp:** Bible says max severity 3 days. Code: `MAX_PENALTY_LEVEL = 3` — **MATCH** (`vigor.ts:28`)

### 1.7 Cascade Cross-Drain (Bible §3.6)

**Threshold:** Bible < 20. Code: `CASCADE_THRESHOLD = 20` — **MATCH** (`vigor.ts:24`)
**Drain rate:** Bible 1.5/hr. Code: `CRITICAL_DRAIN_RATE = 1.5` — **MATCH** (`vigor.ts:25`)
**Cap per dim:** Bible 3.0/hr. Code: `CROSS_DRAIN_CAP_PER_DIM = 3.0` — **MATCH** (`vigor.ts:26`)

**Cascade Matrix Coefficients:**

| From→To | Bible | Code | Status |
|---|---|---|---|
| PV→MV | 0.3 | 0.5 | **MISMATCH** |
| PV→SV | 0.1 | 0.2 | **MISMATCH** |
| PV→CV | 0.0 | 0.4 | **MISMATCH** |
| PV→SpV | 0.1 | 0.1 | MATCH |
| MV→PV | 0.3 | 0.2 | **MISMATCH** |
| MV→SV | 0.4 | 0.3 | **MISMATCH** |
| MV→CV | 0.3 | 0.5 | **MISMATCH** |
| MV→SpV | 0.4 | 0.1 | **MISMATCH** |
| SV→PV | 0.1 | 0.1 | MATCH |
| SV→MV | 0.4 | 0.4 | MATCH |
| SV→CV | 0.2 | 0.1 | **MISMATCH** |
| SV→SpV | 0.3 | 0.4 | **MISMATCH** |
| CV→PV | 0.0 | 0.1 | **MISMATCH** |
| CV→MV | 0.3 | 0.4 | **MISMATCH** |
| CV→SV | 0.2 | 0.2 | MATCH |
| CV→SpV | 0.2 | 0.3 | **MISMATCH** |
| SpV→PV | 0.1 | 0.1 | MATCH |
| SpV→MV | 0.4 | 0.2 | **MISMATCH** |
| SpV→SV | 0.3 | 0.4 | **MISMATCH** |
| SpV→CV | 0.2 | 0.3 | **MISMATCH** |

**15 of 20 off-diagonal entries are wrong.** Fix required.

### 1.8 No Hard Lockouts (Bible §5.2)

| Requirement | Status | Location |
|---|---|---|
| SLEEP always allowed at 0 vigor | MATCH | `vigor.ts:723` |
| EAT_MEAL always allowed at 0 vigor | MATCH | `vigor.ts:723` |
| WORK_SHIFT allowed at reduced efficiency | MATCH | `vigor.ts:730-738` |
| Other actions blocked only when dim = 0 | MATCH | `vigor.ts:741-747` |

### 1.9 Soft-Gating (Bible §5.2)

| Gate | Bible | Code | Status | Location |
|---|---|---|---|---|
| Low MV → trading slippage | reduces accuracy | mvSlippage [0, 0.15] | MATCH | `soft-gates.ts:35-38` |
| Low SV → service job reduction | affects outcomes | svServiceMult [0.70, 1.0] | MATCH | `soft-gates.ts:57-59` |
| Low CV → fee surcharge | increases fees | cvFeeMult [1.0, 1.25] | MATCH | `soft-gates.ts:71-73` |
| Low CV → admin slowdown | slows actions | cvSpeedMult [1.0, 1.5] | MATCH | `soft-gates.ts:83-85` |
| Low SpV → global regen penalty (max -10%) | max -10% | spvRegenMult [0.90, 1.0] | MATCH | `soft-gates.ts:97-99` |

---

## 2) Economy System

### 2.1 Money Model (Bible §4.1)

| Requirement | Status | Location |
|---|---|---|
| Integer cents only (1 B = 100 cents) | MATCH | `money.ts:16-23` — `assertCents` enforces |
| No floating point | MATCH | All money ops use `Math.floor()` |
| Currency: Blueth (B) | MATCH | `money.ts:90-98` — formats as `₿` |

### 2.2 Double-Entry Ledger (Bible §4.1)

| Requirement | Status | Location |
|---|---|---|
| Every tx has from, to, amount, type, timestamp | MATCH | `economy.ts:562-569` |
| Ledger entries validated (positive amount, no self-transfer) | MATCH | `economy.ts:576-587` |
| Explicit sources/sinks | MATCH | `types.ts:163-170` — 6 system accounts |

**System Accounts:**

| Bible Concept | Code Account | ID | Status |
|---|---|---|---|
| Job wages (source) | JOB_PAYROLL | 1 | MATCH |
| Market fees (sink) | TAX_SINK | 2 | MATCH |
| Market escrow | MARKET_ESCROW | 3 | MATCH |
| Rent/utilities (sink) | BILL_PAYMENT_SINK | 4 | MATCH |
| NPC vendor | NPC_VENDOR | 5 | MATCH |
| Starting money (source) | INITIAL_GRANT | 6 | MATCH |

### 2.3 Jobs Performance Formula (Bible §4.3.2)

| Requirement | Bible | Code | Status | Location |
|---|---|---|---|---|
| Formula | `Skill * (PV/100)^wPV * (MV/100)^wMV * clamp(Sat, 0.5, 1.3) * clamp(Equip, 0.5, 1.5)` | Same formula | MATCH | `economy.ts:168-190` |
| Physical weights | wPV=1.0, wMV=0.3 | wPV=1.0, wMV=0.3 | MATCH | `economy.ts:91` |
| Admin weights | wPV=0.2, wMV=1.0 | wPV=0.2, wMV=1.0 | MATCH | `economy.ts:96` |
| Service weights + SV factor | wPV=0.2, wMV=0.4, SV: `(0.7+SV/300)` | Same | MATCH | `economy.ts:101, 186` |
| Pay formula | `BaseWage * clamp(Perf, 0.4, 1.5)` | Same, `Math.floor` | MATCH | `economy.ts:199-202` |

### 2.4 Work Shift Vigor Costs (Bible §3.8)

| Shift | Bible | Code | Status | Location |
|---|---|---|---|---|
| Physical short (2h) | PV-10 MV-3 | `{pv:10, mv:3}` | MATCH | `economy.ts:120` |
| Physical full (8h) | PV-25 MV-8 | `{pv:25, mv:8}` | MATCH | `economy.ts:121` |
| Admin short (2h) | MV-10 CV-2 | `{mv:10, cv:2}` | MATCH | `economy.ts:124` |
| Admin full (8h) | MV-25 CV-6 | `{mv:25, cv:6}` | MATCH | `economy.ts:125` |
| Service short (2h) | SV-8 MV-4 | `{sv:8, mv:4}` | MATCH | `economy.ts:128` |
| Service full (8h) | SV-18 MV-10 | `{sv:18, mv:10}` | MATCH | `economy.ts:129` |
| Management short | Not specified in Bible | `{mv:12, sv:3, spv:2}` | ADDITION | `economy.ts:132` |
| Management full | Not specified in Bible | `{mv:28, sv:8, spv:5}` | ADDITION | `economy.ts:133` |

### 2.5 Housing Tiers (Bible §4.4)

| Tier | Bible Rent | Code Rent | Bible Bonuses | Code Bonuses | Status |
|---|---|---|---|---|---|
| 0 Shelter | B0/day | 0 | none | `{}` | MATCH |
| 1 Cheap Room | B10/day | 1000 | PV +0.2/hr | `{pv:0.2}` | MATCH |
| 2 Studio | B20/day | 2000 | PV +0.5/hr | `{pv:0.5}` | MATCH |
| 3 1BR | B35/day | 3500 | PV +0.8, MV +0.2 | `{pv:0.8, mv:0.2}` | MATCH |
| 4 Comfortable | B60/day | 6000 | PV +1.2, MV +0.4, SV +0.2 | `{pv:1.2, mv:0.4, sv:0.2}` | MATCH |

### 2.6 Rent Failure Resistance (Bible §4.4 / §5.2)

| Requirement | Status | Location |
|---|---|---|
| Auto-downgrade when cannot afford | MATCH | `economy.ts:383-429` |
| Wallet never negative | MATCH | `economy.ts:398-401` |
| Shelter (tier 0) is free fallback | MATCH | `economy.ts:400` |
| Discomfort penalty: PV -3, SV -2 | MATCH | `economy.ts:403-404` |

### 2.7 Market Constants (Bible §4.5 / §11)

| Constant | Bible | Code | Status | Location |
|---|---|---|---|---|
| Market fee | 1% | `MARKET_FEE_RATE = 0.01` | MATCH | `market.ts:56` |
| Circuit breaker | 25% move → 1h halt | `CIRCUIT_BREAKER_THRESHOLD = 0.25`, `HALT_MS = 3600000` | MATCH | `market.ts:59,62` |
| Essentials alpha | 0.05-0.08 | 0.05-0.08 per good | MATCH | `market.ts:112-122` |
| Non-essentials alpha | 0.10-0.12 | 0.10-0.12 per good | MATCH | `market.ts:112-122` |

### 2.8 Meal Prices (Bible §3.4 "Typical Cost")

| Meal | Bible Range | Code | Status |
|---|---|---|---|
| Street Food | B1-5 | B3.00 (300c) | RANGE — within |
| Home Cooked | B5-15 | B5.00 (500c) | RANGE — at bottom |
| Restaurant | B15-50 | B12.00 (1200c) | RANGE — below min |
| Fine Dining | B50-200 | B30.00 (3000c) | RANGE — below min |
| Nutrient Optimal | B100-300 | B20.00 (2000c) | RANGE — below min |

Note: Bible specifies "Typical Cost" ranges, not exact values. The implementation chose lower
prices for gameplay balance (starting money B500 = 50000c). Restaurant/Fine Dining/Nutrient
Optimal are below their Bible ranges but this appears intentional for playability.
**No code change — flagged for designer review.**

### 2.9 Balance Constants (Bible §11)

| Constant | Bible | Code | Status | Location |
|---|---|---|---|---|
| StartingMoney | B500 | Seeded in `007_seed_data.sql` | MATCH (DB) | migration |
| VigorCaps | 100 each | `DEFAULT_CAP = 100` | MATCH | `vigor.ts:23` |
| QUEUE_MAX | 12 | `QUEUE_MAX = 12` | MATCH | `action-engine.ts:20` |
| MealBonusCap | +8/hr | `BUFF_CAP_PER_DIM_PER_HOUR = 8.0` | MATCH | `vigor.ts:27` |

---

## 3) Summary of Required Fixes

### Fix 1: CASCADE_MATRIX (vigor.ts:71-77)
**Severity: HIGH** — 15 of 20 off-diagonal entries differ from Bible §3.6.
The current matrix appears to be a different "design intent" that doesn't match
the Bible's published interaction matrix.

### Fix 2: NIGHT_SLEEP_OVERRIDES (vigor.ts:52-55)
**Severity: MEDIUM** — `mv: 1.2` in overrides causes MV x1.2 to be applied twice
at night (once as circadian override, once as general sleep multiplier). Bible §3.7
states MV x1.2 is a general sleeping effect, not a night-specific override.
Net effect: night sleeping MV is 1.44x instead of correct 0.6x (0.5 × 1.2).

### No Fix Needed (flagged for review)
- Meal prices below Bible's "Typical Cost" ranges — appears intentional for balance.
- CV labeled "Creative" in comments vs "Civic" in Bible — cosmetic, no gameplay impact.
- Management shift vigor costs not in Bible — reasonable extension for 4th job family.
