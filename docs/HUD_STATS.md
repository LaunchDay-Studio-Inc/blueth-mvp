# HUD Stats — Clickable Breakdowns

## Overview

Every vigor stat (PV/MV/SV/CV/SPV) and the cash balance in the game HUD are clickable. Tapping/clicking opens a Dialog modal showing a detailed breakdown of the current regen rate or financial status.

## Vigor Stat Breakdown

### Formula

The per-hour regen rate for each dimension is:

```
net = (base * circadian * sleep * penalty * spvRegen) + housing + buff - drain
```

Where:
- **base** — `BASE_REGEN_RATES[dim]` (PV: 2.0, MV: 1.5, SV: 1.0, CV: 0.5, SPV: 0.3)
- **circadian** — Time-of-day multiplier (morning: PV/MV x1.5, afternoon: SV/CV x1.5, evening: SPV x1.5/SV x1.2, night awake: all x0.5, night sleeping: PV x2.0)
- **sleep** — MV x1.2 while sleeping, otherwise x1.0
- **penalty** — Meal compliance penalty (0-3 meals yesterday)
- **spvRegen** — Global regen penalty when SPV < 50 (max -10%)
- **housing** — Additive bonus from housing tier (e.g. Studio: PV +0.5/hr)
- **buff** — Sum of active buff bonuses (meal, leisure, social), capped at 8.0/hr per dim
- **drain** — Cascade cross-drain when any dimension < 20 (capped at 3.0/hr per dim)

Housing bonus is additive (not multiplied by circadian/sleep/penalty) because the tick system applies it separately from the multiplicative regen chain.

### Modal Sections

1. **Header**: Stat name, badge, value/cap progress bar
2. **Current Regen Rate**: Big number showing net rate per hour
3. **Breakdown**: Table showing each factor with its current value
4. **How to Improve**: 3 contextual tips specific to the stat

### Improvement Tips

| Stat | Tips |
|------|------|
| PV | Eat a meal, upgrade housing, sleep at night |
| MV | Sleep (MV x1.2), morning is peak, leisure buffs |
| SV | Leisure venues, social call action, afternoon peak |
| CV | Afternoon peak, housing tier 3+, creative leisure |
| SPV | Evening peak, spiritual leisure, keep SPV > 50 |

## Cash Breakdown

### Daily Burn

Calculated from housing tier:
- **Rent**: `getDailyRent(tier)` — ranges from B0 (Shelter) to B60 (Comfortable)
- **Utilities**: `getDailyUtilities(tier)` — ranges from B0 to B12

### Runway

`floor(balance / dailyBurn)` — shows how many days the player can sustain at current housing level.

Color coded: green (>7d), yellow (3-7d), red (<3d).

### Sections

1. **Header**: Balance displayed large
2. **Daily Burn**: Rent + utilities breakdown
3. **Runway**: Days affordable with color coding
4. **Recent Transactions**: Placeholder (not yet implemented)
5. **Footer**: Link to full Wallet page

## Component Structure

```
apps/web/src/components/
├── stat-detail-modal.tsx   — Vigor breakdown dialog (StatDetailModal)
├── cash-detail-modal.tsx   — Cash breakdown dialog (CashDetailModal)
└── game-shell.tsx          — HUD with clickable stats + modals

packages/core/src/
└── vigor.ts                — computeRegenBreakdown() pure function
```

## Data Flow

```
PlayerStateData (from /me/state via useAuth())
    │
    ├── StatDetailModal
    │     └── computeRegenBreakdown(vigor, sleepState, buffs, penalty, housing, time, tz)
    │           └── Returns RegenBreakdown { perDim, activeBuffDetails, criticalDims, localHour }
    │
    └── CashDetailModal
          └── getDailyHousingCost(tier), getDailyRent(tier), getDailyUtilities(tier)
```

No additional API calls needed — all computation uses `@blueth/core` pure functions client-side, sharing the exact same math the server tick uses.
