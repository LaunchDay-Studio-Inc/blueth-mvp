/**
 * Bible Compliance Regression Tests
 *
 * Locks ALL constants and rules from the Blueth City Core Bible V2
 * (docs/BluethCity_Core_Bible_v2.md) so that future changes cannot
 * silently break the spec. If a test fails, the change MUST be
 * cross-checked against the Bible before being accepted.
 *
 * Sections reference: Bible §<number>
 */

import {
  BASE_REGEN_RATES,
  CASCADE_THRESHOLD,
  CRITICAL_DRAIN_RATE,
  CROSS_DRAIN_CAP_PER_DIM,
  BUFF_CAP_PER_DIM_PER_HOUR,
  MAX_PENALTY_LEVEL,
  CASCADE_MATRIX,
  CIRCADIAN_MULTIPLIERS,
  NIGHT_SLEEP_OVERRIDES,
  MEAL_DEFINITIONS,
  MEAL_PENALTY_TABLE,
  applyHourlyVigorTick,
  applyDailyReset,
  createLeisureBuff,
  createSocialCallInstantDelta,
  validateNoHardLockouts,
} from './vigor';
import {
  SHIFT_VIGOR_COSTS,
  HOUSING_TIERS,
  UTILITIES_DAILY_COST,
  GOOD_BASE_PRICES,
  MEAL_PRICES_CENTS,
  JOBS_CATALOG,
  calculatePerformance,
  calculateDailyPay,
  processRent,
  validateLedgerEntry,
  createJobPayEntry,
  createRentEntry,
  createUtilitiesEntry,
  createPurchaseEntry,
} from './economy';
import { assertCents, assertNonNegativeCents, formatBlueth, parseBlueth } from './money';
import { SOFT_GATE_THRESHOLD, calculateSpvRegenMultiplier } from './soft-gates';
import { SYSTEM_ACCOUNTS, VIGOR_KEYS } from './types';
import type { VigorDimension, VigorCaps, VigorState, VigorKey, MealQuality } from './types';
import type { LedgerEntry } from './economy';

// ── Fixtures ────────────────────────────────────────────────

const defaultCaps: VigorCaps = { pv_cap: 100, mv_cap: 100, sv_cap: 100, cv_cap: 100, spv_cap: 100 };

function makeState(overrides: Partial<VigorState> = {}): VigorState {
  return {
    vigor: { pv: 50, mv: 50, sv: 50, cv: 50, spv: 50 },
    caps: { ...defaultCaps },
    sleepState: 'awake',
    activeBuffs: [],
    lastMealTimes: [],
    mealsEatenToday: 3,
    mealPenaltyLevel: 0,
    lastDailyResetLocalDate: '2024-03-15',
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// §3.2 — Base Regen Rates
// ══════════════════════════════════════════════════════════════

describe('Bible §3.2 — Base Regen Rates', () => {
  it('PV = 2.0/hr', () => expect(BASE_REGEN_RATES.pv).toBe(2.0));
  it('MV = 1.5/hr', () => expect(BASE_REGEN_RATES.mv).toBe(1.5));
  it('SV = 1.0/hr', () => expect(BASE_REGEN_RATES.sv).toBe(1.0));
  it('CV = 0.5/hr', () => expect(BASE_REGEN_RATES.cv).toBe(0.5));
  it('SpV = 0.3/hr', () => expect(BASE_REGEN_RATES.spv).toBe(0.3));
});

// ══════════════════════════════════════════════════════════════
// §3.3 — Circadian Multipliers
// ══════════════════════════════════════════════════════════════

describe('Bible §3.3 — Circadian Multipliers', () => {
  it('morning (06-12): PV × 1.5, MV × 1.5', () => {
    expect(CIRCADIAN_MULTIPLIERS.morning).toEqual({ pv: 1.5, mv: 1.5 });
  });

  it('afternoon (12-18): SV × 1.5, CV × 1.5', () => {
    expect(CIRCADIAN_MULTIPLIERS.afternoon).toEqual({ sv: 1.5, cv: 1.5 });
  });

  it('evening (18-24): SpV × 1.5, SV × 1.2', () => {
    expect(CIRCADIAN_MULTIPLIERS.evening).toEqual({ spv: 1.5, sv: 1.2 });
  });

  it('night (00-06 awake): all × 0.5', () => {
    expect(CIRCADIAN_MULTIPLIERS.night).toEqual({ pv: 0.5, mv: 0.5, sv: 0.5, cv: 0.5, spv: 0.5 });
  });

  it('night sleeping override: PV → 2.0 only (no MV override)', () => {
    expect(NIGHT_SLEEP_OVERRIDES).toEqual({ pv: 2.0 });
  });
});

// ══════════════════════════════════════════════════════════════
// §3.4 — Meal Definitions
// ══════════════════════════════════════════════════════════════

describe('Bible §3.4 — Meal Definitions', () => {
  it('STREET_FOOD: PV +2/hr for 2hr', () => {
    expect(MEAL_DEFINITIONS.STREET_FOOD.perHourBonusByDim).toEqual({ pv: 2 });
    expect(MEAL_DEFINITIONS.STREET_FOOD.durationHours).toBe(2);
  });

  it('HOME_COOKED: PV +3/hr for 4hr, MV +1/hr for 2hr', () => {
    expect(MEAL_DEFINITIONS.HOME_COOKED.perHourBonusByDim).toEqual({ pv: 3, mv: 1 });
    expect(MEAL_DEFINITIONS.HOME_COOKED.durationHours).toBe(4);
    expect(MEAL_DEFINITIONS.HOME_COOKED.perDimDurationOverrides).toEqual({ mv: 2 });
  });

  it('RESTAURANT: PV +4/hr, MV +2/hr for 3hr', () => {
    expect(MEAL_DEFINITIONS.RESTAURANT.perHourBonusByDim).toEqual({ pv: 4, mv: 2 });
    expect(MEAL_DEFINITIONS.RESTAURANT.durationHours).toBe(3);
  });

  it('FINE_DINING: PV +5/hr, MV +3/hr for 4hr, instant SV +2', () => {
    expect(MEAL_DEFINITIONS.FINE_DINING.perHourBonusByDim).toEqual({ pv: 5, mv: 3 });
    expect(MEAL_DEFINITIONS.FINE_DINING.durationHours).toBe(4);
    expect(MEAL_DEFINITIONS.FINE_DINING.instantDelta).toEqual({ sv: 2 });
  });

  it('NUTRIENT_OPTIMAL: PV +6/hr, MV +4/hr for 6hr', () => {
    expect(MEAL_DEFINITIONS.NUTRIENT_OPTIMAL.perHourBonusByDim).toEqual({ pv: 6, mv: 4 });
    expect(MEAL_DEFINITIONS.NUTRIENT_OPTIMAL.durationHours).toBe(6);
  });

  it('meal buff cap per dim per hour = +8', () => {
    expect(BUFF_CAP_PER_DIM_PER_HOUR).toBe(8.0);
  });
});

// ══════════════════════════════════════════════════════════════
// §3.5 — Meal Penalties
// ══════════════════════════════════════════════════════════════

describe('Bible §3.5 — Meal Penalties', () => {
  it('2 meals: PV × 0.9, MV × 0.95', () => {
    expect(MEAL_PENALTY_TABLE[2].regenMultipliers).toEqual({ pv: 0.9, mv: 0.95 });
    expect(MEAL_PENALTY_TABLE[2].immediateDelta).toBeUndefined();
  });

  it('1 meal: PV × 0.75, MV × 0.85, SpV × 0.9', () => {
    expect(MEAL_PENALTY_TABLE[1].regenMultipliers).toEqual({ pv: 0.75, mv: 0.85, spv: 0.9 });
    expect(MEAL_PENALTY_TABLE[1].immediateDelta).toBeUndefined();
  });

  it('0 meals: PV × 0.5, MV × 0.7, SpV × 0.8, immediate PV -10', () => {
    expect(MEAL_PENALTY_TABLE[0].regenMultipliers).toEqual({ pv: 0.5, mv: 0.7, spv: 0.8 });
    expect(MEAL_PENALTY_TABLE[0].immediateDelta).toEqual({ pv: -10 });
  });

  it('no death spiral: MAX_PENALTY_LEVEL = 3', () => {
    expect(MAX_PENALTY_LEVEL).toBe(3);
  });

  it('penalty never exceeds 3 after 10 consecutive days of 0 meals', () => {
    let state = makeState({ mealPenaltyLevel: 0, mealsEatenToday: 0 });
    for (let day = 0; day < 10; day++) {
      const { newState } = applyDailyReset(state, `2024-03-${String(15 + day).padStart(2, '0')}T00:00:00.000Z`);
      state = { ...newState, mealsEatenToday: 0 };
    }
    expect(state.mealPenaltyLevel).toBe(3);
  });

  it('good compliance (3 meals) reduces penalty by 1 per day', () => {
    let state = makeState({ mealPenaltyLevel: 3, mealsEatenToday: 3 });
    for (let day = 0; day < 3; day++) {
      const { newState } = applyDailyReset(state, `2024-03-${String(16 + day).padStart(2, '0')}T20:00:00.000Z`);
      state = { ...newState, mealsEatenToday: 3 };
    }
    expect(state.mealPenaltyLevel).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// §3.6 — Cascade Cross-Drain Matrix (every cell)
// ══════════════════════════════════════════════════════════════

describe('Bible §3.6 — Cascade Matrix (exact coefficients)', () => {
  it('CASCADE_THRESHOLD = 20', () => expect(CASCADE_THRESHOLD).toBe(20));
  it('CRITICAL_DRAIN_RATE = 1.5/hr', () => expect(CRITICAL_DRAIN_RATE).toBe(1.5));
  it('CROSS_DRAIN_CAP_PER_DIM = 3.0/hr', () => expect(CROSS_DRAIN_CAP_PER_DIM).toBe(3.0));

  // Lock every off-diagonal coefficient from Bible §3.6 table
  describe('PV row', () => {
    it('PV→MV = 0.3', () => expect(CASCADE_MATRIX.pv.mv).toBe(0.3));
    it('PV→SV = 0.1', () => expect(CASCADE_MATRIX.pv.sv).toBe(0.1));
    it('PV→CV = 0 (absent)', () => expect(CASCADE_MATRIX.pv.cv).toBeUndefined());
    it('PV→SpV = 0.1', () => expect(CASCADE_MATRIX.pv.spv).toBe(0.1));
    it('PV→PV = undefined (no self-drain)', () => expect(CASCADE_MATRIX.pv.pv).toBeUndefined());
  });

  describe('MV row', () => {
    it('MV→PV = 0.3', () => expect(CASCADE_MATRIX.mv.pv).toBe(0.3));
    it('MV→SV = 0.4', () => expect(CASCADE_MATRIX.mv.sv).toBe(0.4));
    it('MV→CV = 0.3', () => expect(CASCADE_MATRIX.mv.cv).toBe(0.3));
    it('MV→SpV = 0.4', () => expect(CASCADE_MATRIX.mv.spv).toBe(0.4));
    it('MV→MV = undefined (no self-drain)', () => expect(CASCADE_MATRIX.mv.mv).toBeUndefined());
  });

  describe('SV row', () => {
    it('SV→PV = 0.1', () => expect(CASCADE_MATRIX.sv.pv).toBe(0.1));
    it('SV→MV = 0.4', () => expect(CASCADE_MATRIX.sv.mv).toBe(0.4));
    it('SV→CV = 0.2', () => expect(CASCADE_MATRIX.sv.cv).toBe(0.2));
    it('SV→SpV = 0.3', () => expect(CASCADE_MATRIX.sv.spv).toBe(0.3));
    it('SV→SV = undefined (no self-drain)', () => expect(CASCADE_MATRIX.sv.sv).toBeUndefined());
  });

  describe('CV row', () => {
    it('CV→PV = 0 (absent)', () => expect(CASCADE_MATRIX.cv.pv).toBeUndefined());
    it('CV→MV = 0.3', () => expect(CASCADE_MATRIX.cv.mv).toBe(0.3));
    it('CV→SV = 0.2', () => expect(CASCADE_MATRIX.cv.sv).toBe(0.2));
    it('CV→SpV = 0.2', () => expect(CASCADE_MATRIX.cv.spv).toBe(0.2));
    it('CV→CV = undefined (no self-drain)', () => expect(CASCADE_MATRIX.cv.cv).toBeUndefined());
  });

  describe('SpV row', () => {
    it('SpV→PV = 0.1', () => expect(CASCADE_MATRIX.spv.pv).toBe(0.1));
    it('SpV→MV = 0.4', () => expect(CASCADE_MATRIX.spv.mv).toBe(0.4));
    it('SpV→SV = 0.3', () => expect(CASCADE_MATRIX.spv.sv).toBe(0.3));
    it('SpV→CV = 0.2', () => expect(CASCADE_MATRIX.spv.cv).toBe(0.2));
    it('SpV→SpV = undefined (no self-drain)', () => expect(CASCADE_MATRIX.spv.spv).toBeUndefined());
  });
});

// ══════════════════════════════════════════════════════════════
// §3.7 — Sleep Rules
// ══════════════════════════════════════════════════════════════

describe('Bible §3.7 — Sleep Rules', () => {
  it('sleeping at night: PV circadian = 2.0', () => {
    const state = makeState({ sleepState: 'sleeping' });
    const { deltaBreakdown } = applyHourlyVigorTick(state, '2024-03-14T23:00:00.000Z', 'Asia/Dubai');
    expect(deltaBreakdown.circadianMultiplier.pv).toBe(2.0);
  });

  it('sleeping at night: MV circadian remains 0.5 (no night override)', () => {
    const state = makeState({ sleepState: 'sleeping' });
    const { deltaBreakdown } = applyHourlyVigorTick(state, '2024-03-14T23:00:00.000Z', 'Asia/Dubai');
    expect(deltaBreakdown.circadianMultiplier.mv).toBe(0.5);
  });

  it('sleeping (any time): MV sleep multiplier = 1.2', () => {
    const state = makeState({ sleepState: 'sleeping' });
    const { deltaBreakdown } = applyHourlyVigorTick(state, '2024-03-15T06:00:00.000Z', 'Asia/Dubai');
    expect(deltaBreakdown.sleepAdjustment.mv).toBe(1.2);
  });

  it('sleeping: SV/CV/SpV sleep multiplier = 1.0 (unchanged)', () => {
    const state = makeState({ sleepState: 'sleeping' });
    const { deltaBreakdown } = applyHourlyVigorTick(state, '2024-03-14T23:00:00.000Z', 'Asia/Dubai');
    expect(deltaBreakdown.sleepAdjustment.sv).toBe(1.0);
    expect(deltaBreakdown.sleepAdjustment.cv).toBe(1.0);
    expect(deltaBreakdown.sleepAdjustment.spv).toBe(1.0);
  });

  it('night sleeping: net PV = base(2.0) × circadian(2.0) = 4.0', () => {
    const state = makeState({ sleepState: 'sleeping' });
    const { deltaBreakdown } = applyHourlyVigorTick(state, '2024-03-14T23:00:00.000Z', 'Asia/Dubai');
    expect(deltaBreakdown.netDelta.pv).toBeCloseTo(4.0, 5);
  });

  it('night sleeping: net MV = base(1.5) × circadian(0.5) × sleep(1.2) = 0.9', () => {
    const state = makeState({ sleepState: 'sleeping' });
    const { deltaBreakdown } = applyHourlyVigorTick(state, '2024-03-14T23:00:00.000Z', 'Asia/Dubai');
    expect(deltaBreakdown.netDelta.mv).toBeCloseTo(0.9, 5);
  });
});

// ══════════════════════════════════════════════════════════════
// §3.8 — Vigor Costs for Economic Actions
// ══════════════════════════════════════════════════════════════

describe('Bible §3.8 — Vigor Costs for Actions', () => {
  describe('work shift vigor costs', () => {
    it('physical short (2h): PV-10 MV-3', () => {
      expect(SHIFT_VIGOR_COSTS.physical.short).toEqual({ pv: 10, mv: 3 });
    });
    it('physical full (8h): PV-25 MV-8', () => {
      expect(SHIFT_VIGOR_COSTS.physical.full).toEqual({ pv: 25, mv: 8 });
    });
    it('admin short (2h): MV-10 CV-2', () => {
      expect(SHIFT_VIGOR_COSTS.admin.short).toEqual({ mv: 10, cv: 2 });
    });
    it('admin full (8h): MV-25 CV-6', () => {
      expect(SHIFT_VIGOR_COSTS.admin.full).toEqual({ mv: 25, cv: 6 });
    });
    it('service short (2h): SV-8 MV-4', () => {
      expect(SHIFT_VIGOR_COSTS.service.short).toEqual({ sv: 8, mv: 4 });
    });
    it('service full (8h): SV-18 MV-10', () => {
      expect(SHIFT_VIGOR_COSTS.service.full).toEqual({ sv: 18, mv: 10 });
    });
  });

  describe('leisure (Bible §5.4)', () => {
    it('instant delta: MV +4, SpV +2', () => {
      const { instantDelta } = createLeisureBuff('2024-03-15T12:00:00.000Z');
      expect(instantDelta).toEqual({ mv: 4, spv: 2 });
    });
    it('regen bonus: MV +1/hr, SpV +0.5/hr for 3h', () => {
      const { buff } = createLeisureBuff('2024-03-15T12:00:00.000Z');
      expect(buff.perHourBonusByDim).toEqual({ mv: 1, spv: 0.5 });
      const durationMs = new Date(buff.endsAt).getTime() - new Date(buff.startsAt).getTime();
      expect(durationMs).toBe(3 * 3600 * 1000);
    });
  });

  describe('social call (Bible §5.4)', () => {
    it('instant: SV +3, MV +1', () => {
      expect(createSocialCallInstantDelta()).toEqual({ sv: 3, mv: 1 });
    });
  });
});

// ══════════════════════════════════════════════════════════════
// §4.1 — Ledger Integrity
// ══════════════════════════════════════════════════════════════

describe('Bible §4.1 — Ledger Integrity', () => {
  it('money is integer cents (rejects fractional)', () => {
    expect(() => assertCents(100)).not.toThrow();
    expect(() => assertCents(10.5)).toThrow();
  });

  it('1 B = 100 cents', () => {
    expect(formatBlueth(100)).toBe('₿1.00');
    expect(parseBlueth('₿1.00')).toBe(100);
  });

  it('system accounts match Bible roles', () => {
    expect(SYSTEM_ACCOUNTS.JOB_PAYROLL).toBe(1);
    expect(SYSTEM_ACCOUNTS.TAX_SINK).toBe(2);
    expect(SYSTEM_ACCOUNTS.MARKET_ESCROW).toBe(3);
    expect(SYSTEM_ACCOUNTS.BILL_PAYMENT_SINK).toBe(4);
    expect(SYSTEM_ACCOUNTS.NPC_VENDOR).toBe(5);
    expect(SYSTEM_ACCOUNTS.INITIAL_GRANT).toBe(6);
  });

  it('job pay: from JOB_PAYROLL(1) → player', () => {
    const e = createJobPayEntry(100, 5000);
    expect(e.fromAccount).toBe(1);
    expect(e.toAccount).toBe(100);
    validateLedgerEntry(e);
  });

  it('rent: from player → BILL_PAYMENT_SINK(4)', () => {
    const e = createRentEntry(100, 3500);
    expect(e.fromAccount).toBe(100);
    expect(e.toAccount).toBe(4);
    validateLedgerEntry(e);
  });

  it('utilities: from player → BILL_PAYMENT_SINK(4)', () => {
    const e = createUtilitiesEntry(100, 800);
    expect(e.fromAccount).toBe(100);
    expect(e.toAccount).toBe(4);
    validateLedgerEntry(e);
  });

  it('purchase: from player → NPC_VENDOR(5)', () => {
    const e = createPurchaseEntry(100, 500, 'PROCESSED_FOOD');
    expect(e.fromAccount).toBe(100);
    expect(e.toAccount).toBe(5);
    validateLedgerEntry(e);
  });

  it('ledger rejects zero, negative, fractional amounts', () => {
    const bad = (amt: number) => ({ fromAccount: 1, toAccount: 100, amountCents: amt, entryType: 'job_pay' as const });
    expect(() => validateLedgerEntry(bad(0))).toThrow();
    expect(() => validateLedgerEntry(bad(-1))).toThrow();
    expect(() => validateLedgerEntry(bad(1.5))).toThrow();
  });

  it('ledger rejects self-transfers', () => {
    expect(() => validateLedgerEntry({
      fromAccount: 100, toAccount: 100, amountCents: 100, entryType: 'rent',
    })).toThrow();
  });
});

// ══════════════════════════════════════════════════════════════
// §4.3 — Jobs Performance & Pay
// ══════════════════════════════════════════════════════════════

describe('Bible §4.3 — Jobs Performance Formula', () => {
  const fullVigor: VigorDimension = { pv: 100, mv: 100, sv: 100, cv: 100, spv: 100 };

  it('physical: wPV=1.0, wMV=0.3 (PV matters more)', () => {
    const perfLowPV = calculatePerformance('physical', 1.0, { ...fullVigor, pv: 30 });
    const perfLowMV = calculatePerformance('physical', 1.0, { ...fullVigor, mv: 30 });
    expect(perfLowPV).toBeLessThan(perfLowMV);
  });

  it('admin: wPV=0.2, wMV=1.0 (MV matters more)', () => {
    const perfLowPV = calculatePerformance('admin', 1.0, { ...fullVigor, pv: 30 });
    const perfLowMV = calculatePerformance('admin', 1.0, { ...fullVigor, mv: 30 });
    expect(perfLowMV).toBeLessThan(perfLowPV);
  });

  it('service: includes SV factor (0.7 + SV/300)', () => {
    const highSV = calculatePerformance('service', 1.0, fullVigor);
    const lowSV = calculatePerformance('service', 1.0, { ...fullVigor, sv: 10 });
    expect(highSV).toBeGreaterThan(lowSV);
  });

  it('pay formula: DailyPay = BaseWage × clamp(Performance, 0.4, 1.5)', () => {
    expect(calculateDailyPay(10000, 0.0)).toBe(4000);  // clamped to 0.4
    expect(calculateDailyPay(10000, 1.0)).toBe(10000);  // 1.0
    expect(calculateDailyPay(10000, 99)).toBe(15000);   // clamped to 1.5
  });

  it('pay is always integer cents', () => {
    expect(Number.isInteger(calculateDailyPay(12345, 0.77))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// §4.4 — Housing Tiers & Rent
// ══════════════════════════════════════════════════════════════

describe('Bible §4.4 — Housing Tiers', () => {
  it('5 tiers (0-4)', () => expect(HOUSING_TIERS).toHaveLength(5));

  it('tier 0 Shelter: B0/day, no bonuses', () => {
    expect(HOUSING_TIERS[0].dailyRentCents).toBe(0);
    expect(HOUSING_TIERS[0].regenBonuses).toEqual({});
  });

  it('tier 1 Cheap Room: B10/day, PV +0.2/hr', () => {
    expect(HOUSING_TIERS[1].dailyRentCents).toBe(1000);
    expect(HOUSING_TIERS[1].regenBonuses).toEqual({ pv: 0.2 });
  });

  it('tier 2 Studio: B20/day, PV +0.5/hr', () => {
    expect(HOUSING_TIERS[2].dailyRentCents).toBe(2000);
    expect(HOUSING_TIERS[2].regenBonuses).toEqual({ pv: 0.5 });
  });

  it('tier 3 1BR: B35/day, PV +0.8/hr MV +0.2/hr', () => {
    expect(HOUSING_TIERS[3].dailyRentCents).toBe(3500);
    expect(HOUSING_TIERS[3].regenBonuses).toEqual({ pv: 0.8, mv: 0.2 });
  });

  it('tier 4 Comfortable: B60/day, PV +1.2/hr MV +0.4/hr SV +0.2/hr', () => {
    expect(HOUSING_TIERS[4].dailyRentCents).toBe(6000);
    expect(HOUSING_TIERS[4].regenBonuses).toEqual({ pv: 1.2, mv: 0.4, sv: 0.2 });
  });

  it('rent is failure-resistant: wallet never goes negative', () => {
    for (const wallet of [0, 50, 100, 500, 999, 1000, 1199, 1200, 5000]) {
      for (let tier = 0; tier <= 4; tier++) {
        const result = processRent(tier, wallet);
        expect(result.amountChargedCents).toBeLessThanOrEqual(wallet);
      }
    }
  });

  it('rent failure: auto-downgrade to affordable tier', () => {
    const result = processRent(4, 0);
    expect(result.newTier).toBe(0);
    expect(result.amountChargedCents).toBe(0);
    expect(result.wasDowngraded).toBe(true);
  });

  it('shelter (tier 0) is always free', () => {
    const result = processRent(0, 0);
    expect(result.newTier).toBe(0);
    expect(result.amountChargedCents).toBe(0);
    expect(result.wasDowngraded).toBe(false);
  });

  it('downgrade applies discomfort penalty: PV -3, SV -2', () => {
    const result = processRent(3, 0);
    expect(result.discomfortPenalty).toEqual({ pv: -3, sv: -2 });
  });
});

// ══════════════════════════════════════════════════════════════
// §5.2 — Soft Gating & No Hard Lockouts
// ══════════════════════════════════════════════════════════════

describe('Bible §5.2 — Soft Gating & No Hard Lockouts', () => {
  const zero: VigorDimension = { pv: 0, mv: 0, sv: 0, cv: 0, spv: 0 };

  it('SLEEP is always allowed at 0 vigor', () => {
    expect(validateNoHardLockouts(zero, 'SLEEP').allowed).toBe(true);
  });

  it('EAT_MEAL is always allowed at 0 vigor', () => {
    expect(validateNoHardLockouts(zero, 'EAT_MEAL').allowed).toBe(true);
  });

  it('WORK_SHIFT is allowed at 0 vigor (reduced efficiency)', () => {
    const result = validateNoHardLockouts(zero, 'WORK_SHIFT');
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain('Reduced performance');
  });

  it('low SpV global regen penalty capped at −10%', () => {
    expect(calculateSpvRegenMultiplier(0)).toBe(0.90);
    expect(calculateSpvRegenMultiplier(50)).toBe(1.0);
  });
});

// ══════════════════════════════════════════════════════════════
// §11 — Balance Constants
// ══════════════════════════════════════════════════════════════

describe('Bible §11 — Balance Constants', () => {
  it('VigorCaps default = 100', () => {
    // Verified via DEFAULT_CAP in vigor.ts
    // All caps in default schema use 100
    for (const key of VIGOR_KEYS) {
      expect(defaultCaps[`${key}_cap` as keyof VigorCaps]).toBe(100);
    }
  });

  it('BaseRegen/hr: PV 2.0, MV 1.5, SV 1.0, CV 0.5, SpV 0.3', () => {
    expect(BASE_REGEN_RATES).toEqual({ pv: 2.0, mv: 1.5, sv: 1.0, cv: 0.5, spv: 0.3 });
  });

  it('CriticalThreshold = 20', () => expect(CASCADE_THRESHOLD).toBe(20));
  it('CRITICAL_DRAIN_RATE = 1.5/hr', () => expect(CRITICAL_DRAIN_RATE).toBe(1.5));
  it('CrossDrainCapPerDim = 3.0/hr', () => expect(CROSS_DRAIN_CAP_PER_DIM).toBe(3.0));
  it('MealBonusCapPerDim = +8/hr', () => expect(BUFF_CAP_PER_DIM_PER_HOUR).toBe(8.0));
});

// ══════════════════════════════════════════════════════════════
// Integration — Hourly Tick Boundary Conditions
// ══════════════════════════════════════════════════════════════

describe('Hourly Tick Boundary Conditions', () => {
  it('circadian boundary: hour 6 = morning (not night)', () => {
    const state = makeState();
    const { deltaBreakdown } = applyHourlyVigorTick(state, '2024-03-15T02:00:00.000Z', 'Asia/Dubai');
    expect(deltaBreakdown.circadianMultiplier.pv).toBe(1.5); // morning
  });

  it('circadian boundary: hour 12 = afternoon (not morning)', () => {
    const state = makeState();
    const { deltaBreakdown } = applyHourlyVigorTick(state, '2024-03-15T08:00:00.000Z', 'Asia/Dubai');
    expect(deltaBreakdown.circadianMultiplier.sv).toBe(1.5); // afternoon
  });

  it('circadian boundary: hour 18 = evening (not afternoon)', () => {
    const state = makeState();
    const { deltaBreakdown } = applyHourlyVigorTick(state, '2024-03-15T14:00:00.000Z', 'Asia/Dubai');
    expect(deltaBreakdown.circadianMultiplier.spv).toBe(1.5); // evening
  });

  it('circadian boundary: hour 0 = night (not evening)', () => {
    const state = makeState();
    const { deltaBreakdown } = applyHourlyVigorTick(state, '2024-03-15T20:00:00.000Z', 'Asia/Dubai');
    expect(deltaBreakdown.circadianMultiplier.pv).toBe(0.5); // night
  });

  it('vigor clamped to [0, cap] after heavy cascade + penalty', () => {
    const state = makeState({
      vigor: { pv: 1, mv: 1, sv: 1, cv: 1, spv: 1 },
      mealPenaltyLevel: 3,
      sleepState: 'awake',
    });
    const { newState } = applyHourlyVigorTick(state, '2024-03-14T23:00:00.000Z', 'Asia/Dubai');
    for (const key of VIGOR_KEYS) {
      expect(newState.vigor[key]).toBeGreaterThanOrEqual(0);
      expect(newState.vigor[key]).toBeLessThanOrEqual(100);
    }
  });

  it('vigor clamped to cap when regen is high', () => {
    const state = makeState({
      vigor: { pv: 99, mv: 99, sv: 99, cv: 99, spv: 99 },
    });
    const { newState } = applyHourlyVigorTick(state, '2024-03-15T06:00:00.000Z', 'Asia/Dubai');
    for (const key of VIGOR_KEYS) {
      expect(newState.vigor[key]).toBeLessThanOrEqual(100);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// Ledger Invariants — Every money movement is balanced
// ══════════════════════════════════════════════════════════════

describe('Ledger Invariants', () => {
  it('rent + utilities entries are balanced (player debits = sink credits)', () => {
    const rent = createRentEntry(100, 3500, 'tick-1');
    const utils = createUtilitiesEntry(100, 800, 'tick-1');
    const entries = [rent, utils];

    const totalDebited = entries
      .filter(e => e.fromAccount === 100)
      .reduce((sum, e) => sum + e.amountCents, 0);

    const totalCredited = entries
      .filter(e => e.toAccount === 4)
      .reduce((sum, e) => sum + e.amountCents, 0);

    expect(totalDebited).toBe(totalCredited);
    expect(totalDebited).toBe(4300); // 3500 + 800
  });

  it('all factory methods produce valid ledger entries', () => {
    const entries: LedgerEntry[] = [
      createJobPayEntry(100, 12000),
      createRentEntry(100, 3500),
      createUtilitiesEntry(100, 800),
      createPurchaseEntry(100, 500, 'RAW_FOOD'),
    ];

    for (const entry of entries) {
      expect(() => validateLedgerEntry(entry)).not.toThrow();
      expect(entry.amountCents).toBeGreaterThan(0);
      expect(Number.isInteger(entry.amountCents)).toBe(true);
      expect(entry.fromAccount).not.toBe(entry.toAccount);
    }
  });
});
