import {
  addVigor,
  subVigor,
  applyVigorRegen,
  depleteVigor,
  calculateEfficiency,
  canAffordVigorCost,
  assertVigorCost,
  BASE_REGEN_RATES,
  HOURLY_REGEN_RATE,
  applyHourlyVigorTick,
  applyDailyReset,
  createMealBuff,
  createLeisureBuff,
  createSocialCallInstantDelta,
  validateNoHardLockouts,
  projectActionOutcome,
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
} from './vigor';
import { InsufficientVigorError } from './errors';
import type { VigorDimension, VigorCaps, VigorState, Buff, MealQuality } from './types';

// ── Test fixtures ────────────────────────────────────────────

const full: VigorDimension = { pv: 100, mv: 100, sv: 100, cv: 100, spv: 100 };
const half: VigorDimension = { pv: 50, mv: 50, sv: 50, cv: 50, spv: 50 };
const zero: VigorDimension = { pv: 0, mv: 0, sv: 0, cv: 0, spv: 0 };
const mixed: VigorDimension = { pv: 80, mv: 30, sv: 60, cv: 10, spv: 45 };
const defaultCaps: VigorCaps = { pv_cap: 100, mv_cap: 100, sv_cap: 100, cv_cap: 100, spv_cap: 100 };

function makeState(overrides: Partial<VigorState> = {}): VigorState {
  return {
    vigor: { ...half },
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
// BASIC VIGOR OPERATIONS (preserved API)
// ══════════════════════════════════════════════════════════════

describe('Vigor System', () => {
  // ── addVigor ──

  describe('addVigor', () => {
    it('adds delta to each dimension', () => {
      const { vigor } = addVigor(half, { pv: 10, mv: 20 });
      expect(vigor.pv).toBe(60);
      expect(vigor.mv).toBe(70);
      expect(vigor.sv).toBe(50); // untouched
    });

    it('clamps at default cap (100)', () => {
      const { vigor } = addVigor({ ...half, pv: 95 }, { pv: 20 });
      expect(vigor.pv).toBe(100);
    });

    it('clamps at custom cap', () => {
      const caps: VigorCaps = { pv_cap: 80, mv_cap: 100, sv_cap: 100, cv_cap: 100, spv_cap: 100 };
      const { vigor } = addVigor(half, { pv: 50 }, caps);
      expect(vigor.pv).toBe(80);
    });

    it('returns audit entries only for changed dimensions', () => {
      const { audit } = addVigor(half, { pv: 10 });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toEqual({ dimension: 'pv', before: 50, after: 60, delta: 10 });
    });

    it('returns empty audit when nothing changes', () => {
      const { audit } = addVigor(full, { pv: 10 }); // already at cap
      expect(audit).toHaveLength(0);
    });

    it('clamps at 0 on the low end (no negative from weird delta)', () => {
      const { vigor } = addVigor(half, { pv: -200 });
      expect(vigor.pv).toBe(0);
    });
  });

  // ── subVigor ──

  describe('subVigor', () => {
    it('subtracts cost from each dimension', () => {
      const { vigor } = subVigor(half, { pv: 10, mv: 20 });
      expect(vigor.pv).toBe(40);
      expect(vigor.mv).toBe(30);
    });

    it('clamps at 0, never negative', () => {
      const { vigor } = subVigor(half, { pv: 999 });
      expect(vigor.pv).toBe(0);
    });

    it('returns audit with negative deltas', () => {
      const { audit } = subVigor(half, { pv: 10 });
      expect(audit[0].delta).toBe(-10);
    });
  });

  // ── applyVigorRegen ──

  describe('applyVigorRegen', () => {
    it('regenerates using BASE_REGEN_RATES per hour', () => {
      const { vigor } = applyVigorRegen(half, 1);
      expect(vigor.pv).toBe(52);   // 50 + 2.0
      expect(vigor.mv).toBe(51.5); // 50 + 1.5
      expect(vigor.sv).toBe(51);   // 50 + 1.0
      expect(vigor.cv).toBe(50.5); // 50 + 0.5
      expect(vigor.spv).toBe(50.3); // 50 + 0.3
    });

    it('caps at 100 by default', () => {
      const { vigor } = applyVigorRegen({ ...half, pv: 99 }, 2);
      expect(vigor.pv).toBe(100);
    });

    it('respects custom caps', () => {
      const caps: VigorCaps = { pv_cap: 60, mv_cap: 55, sv_cap: 100, cv_cap: 100, spv_cap: 100 };
      const { vigor } = applyVigorRegen(half, 10, caps);
      expect(vigor.pv).toBe(60);
      expect(vigor.mv).toBe(55);
    });

    it('multi-hour regen from zero', () => {
      const { vigor } = applyVigorRegen(zero, 5);
      expect(vigor.pv).toBe(10);  // 2.0 * 5
      expect(vigor.mv).toBe(7.5); // 1.5 * 5
    });

    it('audit shows correct regen amounts', () => {
      const { audit } = applyVigorRegen({ ...half, cv: 100 }, 1);
      // cv: 100 + 0.5 = clamped at 100, no change in audit... wait 100.5 -> 100
      // Actually cv goes from 100 to 100 (capped) so no audit
      expect(audit.find((a) => a.dimension === 'pv')?.delta).toBe(2);
    });
  });

  // ── depleteVigor ──

  describe('depleteVigor', () => {
    it('is an alias for subVigor', () => {
      const result1 = depleteVigor(half, { pv: 10, mv: 20 });
      const result2 = subVigor(half, { pv: 10, mv: 20 });
      expect(result1.vigor).toEqual(result2.vigor);
    });
  });

  // ── calculateEfficiency ──

  describe('calculateEfficiency', () => {
    it('returns 1.0 when all dimensions healthy', () => {
      expect(calculateEfficiency(full)).toBe(1.0);
      expect(calculateEfficiency(half)).toBe(1.0);
    });

    it('reduces by 0.1 per dimension below 20', () => {
      expect(calculateEfficiency({ ...half, pv: 15 })).toBe(0.9);
      expect(calculateEfficiency({ ...half, pv: 10, mv: 10 })).toBe(0.8);
    });

    it('floors at 0.5 (no hard lockout)', () => {
      expect(calculateEfficiency(zero)).toBe(0.5);
    });

    it('dimension at exactly 20 is NOT below threshold', () => {
      expect(calculateEfficiency({ ...half, pv: 20 })).toBe(1.0);
    });

    it('dimension at 19 IS below threshold', () => {
      expect(calculateEfficiency({ ...half, pv: 19 })).toBe(0.9);
    });
  });

  // ── canAffordVigorCost ──

  describe('canAffordVigorCost', () => {
    it('returns true when all dimensions sufficient', () => {
      expect(canAffordVigorCost(half, { pv: 10, mv: 20 })).toBe(true);
    });

    it('returns false when any dimension insufficient', () => {
      expect(canAffordVigorCost(half, { pv: 60 })).toBe(false);
    });

    it('returns true for empty cost', () => {
      expect(canAffordVigorCost(zero, {})).toBe(true);
    });
  });

  // ── assertVigorCost ──

  describe('assertVigorCost', () => {
    it('does not throw when cost is affordable', () => {
      expect(() => assertVigorCost(half, { pv: 10 })).not.toThrow();
    });

    it('throws InsufficientVigorError when cost exceeds', () => {
      expect(() => assertVigorCost(half, { pv: 60 })).toThrow(InsufficientVigorError);
    });

    it('error has correct dimension, required, available', () => {
      try {
        assertVigorCost(mixed, { cv: 50 }); // cv=10, need 50
        fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(InsufficientVigorError);
        const err = e as InsufficientVigorError;
        expect(err.dimension).toBe('cv');
        expect(err.required).toBe(50);
        expect(err.available).toBe(10);
      }
    });
  });

  // ── Clamp property tests ──

  describe('clamp invariants', () => {
    it('vigor dimensions are always >= 0 after subVigor', () => {
      const bigCost: Partial<VigorDimension> = { pv: 999, mv: 999, sv: 999, cv: 999, spv: 999 };
      const { vigor } = subVigor(half, bigCost);
      for (const key of ['pv', 'mv', 'sv', 'cv', 'spv'] as const) {
        expect(vigor[key]).toBeGreaterThanOrEqual(0);
      }
    });

    it('vigor dimensions are always <= cap after addVigor', () => {
      const bigDelta: Partial<VigorDimension> = {
        pv: 999,
        mv: 999,
        sv: 999,
        cv: 999,
        spv: 999,
      };
      const caps: VigorCaps = { pv_cap: 80, mv_cap: 90, sv_cap: 60, cv_cap: 70, spv_cap: 50 };
      const { vigor } = addVigor(half, bigDelta, caps);
      expect(vigor.pv).toBe(80);
      expect(vigor.mv).toBe(90);
      expect(vigor.sv).toBe(60);
      expect(vigor.cv).toBe(70);
      expect(vigor.spv).toBe(50);
    });
  });
});

// ══════════════════════════════════════════════════════════════
// BIBLE V2 — EXTENSIVE TEST SUITE
// ══════════════════════════════════════════════════════════════

describe('Vigor Bible V2', () => {
  // ── Constants sanity ──

  describe('constants', () => {
    it('BASE_REGEN_RATES match spec', () => {
      expect(BASE_REGEN_RATES.pv).toBe(2.0);
      expect(BASE_REGEN_RATES.mv).toBe(1.5);
      expect(BASE_REGEN_RATES.sv).toBe(1.0);
      expect(BASE_REGEN_RATES.cv).toBe(0.5);
      expect(BASE_REGEN_RATES.spv).toBe(0.3);
    });

    it('cascade threshold is 20', () => {
      expect(CASCADE_THRESHOLD).toBe(20);
    });

    it('HOURLY_REGEN_RATE compat constant is 5', () => {
      expect(HOURLY_REGEN_RATE).toBe(5);
    });
  });

  // ── Circadian period boundaries ──

  describe('circadian boundaries', () => {
    it('morning (06-12): PV and MV get x1.5', () => {
      // 10:00 Dubai time = 06:00 UTC
      const state = makeState();
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z', // 10:00 Dubai
        'Asia/Dubai'
      );
      expect(deltaBreakdown.circadianMultiplier.pv).toBe(1.5);
      expect(deltaBreakdown.circadianMultiplier.mv).toBe(1.5);
      expect(deltaBreakdown.circadianMultiplier.sv).toBe(1.0);
      expect(deltaBreakdown.circadianMultiplier.cv).toBe(1.0);
      expect(deltaBreakdown.circadianMultiplier.spv).toBe(1.0);
    });

    it('afternoon (12-18): SV and CV get x1.5', () => {
      // 14:00 Dubai time = 10:00 UTC
      const state = makeState();
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T10:00:00.000Z', // 14:00 Dubai
        'Asia/Dubai'
      );
      expect(deltaBreakdown.circadianMultiplier.sv).toBe(1.5);
      expect(deltaBreakdown.circadianMultiplier.cv).toBe(1.5);
      expect(deltaBreakdown.circadianMultiplier.pv).toBe(1.0);
    });

    it('evening (18-24): SpV x1.5, SV x1.2', () => {
      // 20:00 Dubai time = 16:00 UTC
      const state = makeState();
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T16:00:00.000Z', // 20:00 Dubai
        'Asia/Dubai'
      );
      expect(deltaBreakdown.circadianMultiplier.spv).toBe(1.5);
      expect(deltaBreakdown.circadianMultiplier.sv).toBe(1.2);
      expect(deltaBreakdown.circadianMultiplier.pv).toBe(1.0);
    });

    it('night (00-06) awake: all x0.5', () => {
      // 03:00 Dubai time = 23:00 UTC (previous day)
      const state = makeState({ sleepState: 'awake' });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-14T23:00:00.000Z', // 03:00 Dubai on 3/15
        'Asia/Dubai'
      );
      expect(deltaBreakdown.circadianMultiplier.pv).toBe(0.5);
      expect(deltaBreakdown.circadianMultiplier.mv).toBe(0.5);
      expect(deltaBreakdown.circadianMultiplier.sv).toBe(0.5);
      expect(deltaBreakdown.circadianMultiplier.cv).toBe(0.5);
      expect(deltaBreakdown.circadianMultiplier.spv).toBe(0.5);
    });

    it('exact boundary: hour 6 is morning, not night', () => {
      // 06:00 Dubai = 02:00 UTC
      const state = makeState();
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T02:00:00.000Z', // 06:00 Dubai
        'Asia/Dubai'
      );
      expect(deltaBreakdown.circadianMultiplier.pv).toBe(1.5); // morning
    });

    it('exact boundary: hour 12 is afternoon, not morning', () => {
      // 12:00 Dubai = 08:00 UTC
      const state = makeState();
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T08:00:00.000Z', // 12:00 Dubai
        'Asia/Dubai'
      );
      expect(deltaBreakdown.circadianMultiplier.sv).toBe(1.5); // afternoon
    });

    it('exact boundary: hour 18 is evening, not afternoon', () => {
      // 18:00 Dubai = 14:00 UTC
      const state = makeState();
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T14:00:00.000Z', // 18:00 Dubai
        'Asia/Dubai'
      );
      expect(deltaBreakdown.circadianMultiplier.spv).toBe(1.5); // evening
    });

    it('hour 23 is still evening', () => {
      // 23:00 Dubai = 19:00 UTC
      const state = makeState();
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T19:00:00.000Z', // 23:00 Dubai
        'Asia/Dubai'
      );
      expect(deltaBreakdown.circadianMultiplier.spv).toBe(1.5); // evening
    });
  });

  // ── Sleep behavior ──

  describe('sleep behavior at night (00-06)', () => {
    it('sleeping at night: PV gets x2.0 instead of x0.5', () => {
      const state = makeState({ sleepState: 'sleeping' });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-14T23:00:00.000Z', // 03:00 Dubai
        'Asia/Dubai'
      );
      expect(deltaBreakdown.circadianMultiplier.pv).toBe(2.0);
    });

    it('sleeping at night: MV circadian stays 0.5 (x1.2 is separate sleep effect)', () => {
      const state = makeState({ sleepState: 'sleeping' });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-14T23:00:00.000Z', // 03:00 Dubai
        'Asia/Dubai'
      );
      // Bible §3.3: only PV gets a night override (2.0). MV stays at 0.5.
      // Bible §3.7: MV x1.2 is a general sleep effect (sleepAdjustment, not circadian).
      expect(deltaBreakdown.circadianMultiplier.mv).toBe(0.5);
      expect(deltaBreakdown.sleepAdjustment.mv).toBe(1.2);
    });

    it('sleeping at night: SV/CV/SpV still x0.5 (no override)', () => {
      const state = makeState({ sleepState: 'sleeping' });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-14T23:00:00.000Z', // 03:00 Dubai
        'Asia/Dubai'
      );
      expect(deltaBreakdown.circadianMultiplier.sv).toBe(0.5);
      expect(deltaBreakdown.circadianMultiplier.cv).toBe(0.5);
      expect(deltaBreakdown.circadianMultiplier.spv).toBe(0.5);
    });

    it('sleeping during daytime: MV sleep multiplier x1.2 still applies', () => {
      const state = makeState({ sleepState: 'sleeping' });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z', // 10:00 Dubai (morning)
        'Asia/Dubai'
      );
      // Circadian is morning (PV 1.5, MV 1.5)
      // Sleep MV multiplier compounds: MV regen = 1.5 * 1.5 * 1.2
      expect(deltaBreakdown.sleepAdjustment.mv).toBe(1.2);
      expect(deltaBreakdown.circadianMultiplier.mv).toBe(1.5);
    });

    it('sleeping at night: actual PV regen value is correct', () => {
      // Use vigor above cascade threshold to isolate regen calculation
      // PV = base 2.0 * circadian 2.0 * sleep 1.0 * penalty 1.0 = 4.0
      const state = makeState({
        sleepState: 'sleeping',
        vigor: { ...half }, // start at 50 (above cascade threshold)
      });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-14T23:00:00.000Z', // 03:00 Dubai
        'Asia/Dubai'
      );
      // Net PV = 2.0 * 2.0 * 1.0 * 1.0 + 0 buff - 0 drain = 4.0
      expect(deltaBreakdown.netDelta.pv).toBeCloseTo(4.0, 10);
    });

    it('sleeping at night: MV regen = base × night(0.5) × sleep(1.2)', () => {
      // MV: base 1.5 * circadian(night) 0.5 * sleep 1.2 * penalty 1.0 = 0.9
      const state = makeState({
        sleepState: 'sleeping',
        vigor: { ...half }, // above cascade threshold
      });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-14T23:00:00.000Z',
        'Asia/Dubai'
      );
      expect(deltaBreakdown.netDelta.mv).toBeCloseTo(0.9, 10);
    });
  });

  // ── Meal buff creation ──

  describe('createMealBuff', () => {
    it('STREET_FOOD: PV +2/hr for 2h', () => {
      const buffs = createMealBuff('STREET_FOOD', '2024-03-15T12:00:00.000Z');
      expect(buffs).toHaveLength(1);
      expect(buffs[0].perHourBonusByDim).toEqual({ pv: 2 });
      const durationMs = new Date(buffs[0].endsAt).getTime() - new Date(buffs[0].startsAt).getTime();
      expect(durationMs).toBe(2 * 60 * 60 * 1000);
    });

    it('HOME_COOKED: PV +3/hr for 4h, MV +1/hr for 2h (separate buffs)', () => {
      const buffs = createMealBuff('HOME_COOKED', '2024-03-15T12:00:00.000Z');
      expect(buffs).toHaveLength(2);

      // PV buff (default duration = 4h)
      const pvBuff = buffs.find((b) => b.perHourBonusByDim.pv !== undefined);
      expect(pvBuff).toBeDefined();
      expect(pvBuff!.perHourBonusByDim.pv).toBe(3);
      const pvDuration = new Date(pvBuff!.endsAt).getTime() - new Date(pvBuff!.startsAt).getTime();
      expect(pvDuration).toBe(4 * 60 * 60 * 1000);

      // MV buff (override = 2h)
      const mvBuff = buffs.find((b) => b.perHourBonusByDim.mv !== undefined);
      expect(mvBuff).toBeDefined();
      expect(mvBuff!.perHourBonusByDim.mv).toBe(1);
      const mvDuration = new Date(mvBuff!.endsAt).getTime() - new Date(mvBuff!.startsAt).getTime();
      expect(mvDuration).toBe(2 * 60 * 60 * 1000);
    });

    it('RESTAURANT: PV +4/hr, MV +2/hr for 3h', () => {
      const buffs = createMealBuff('RESTAURANT', '2024-03-15T12:00:00.000Z');
      expect(buffs).toHaveLength(1);
      expect(buffs[0].perHourBonusByDim).toEqual({ pv: 4, mv: 2 });
      const durationMs = new Date(buffs[0].endsAt).getTime() - new Date(buffs[0].startsAt).getTime();
      expect(durationMs).toBe(3 * 60 * 60 * 1000);
    });

    it('FINE_DINING: PV +5/hr, MV +3/hr for 4h, instant SV +2', () => {
      const buffs = createMealBuff('FINE_DINING', '2024-03-15T12:00:00.000Z');
      expect(buffs).toHaveLength(1);
      expect(buffs[0].perHourBonusByDim).toEqual({ pv: 5, mv: 3 });
      expect(buffs[0].instantDeltaByDim).toEqual({ sv: 2 });
      const durationMs = new Date(buffs[0].endsAt).getTime() - new Date(buffs[0].startsAt).getTime();
      expect(durationMs).toBe(4 * 60 * 60 * 1000);
    });

    it('NUTRIENT_OPTIMAL: PV +6/hr, MV +4/hr for 6h', () => {
      const buffs = createMealBuff('NUTRIENT_OPTIMAL', '2024-03-15T12:00:00.000Z');
      expect(buffs).toHaveLength(1);
      expect(buffs[0].perHourBonusByDim).toEqual({ pv: 6, mv: 4 });
      const durationMs = new Date(buffs[0].endsAt).getTime() - new Date(buffs[0].startsAt).getTime();
      expect(durationMs).toBe(6 * 60 * 60 * 1000);
    });

    it('all meal buffs have source MEAL', () => {
      const qualities: MealQuality[] = [
        'STREET_FOOD', 'HOME_COOKED', 'RESTAURANT', 'FINE_DINING', 'NUTRIENT_OPTIMAL',
      ];
      for (const q of qualities) {
        const buffs = createMealBuff(q, '2024-03-15T12:00:00.000Z');
        for (const b of buffs) {
          expect(b.source).toBe('MEAL');
        }
      }
    });
  });

  // ── Leisure buff ──

  describe('createLeisureBuff', () => {
    it('creates MV +1/hr, SpV +0.5/hr for 3h', () => {
      const { buff } = createLeisureBuff('2024-03-15T12:00:00.000Z');
      expect(buff.source).toBe('LEISURE');
      expect(buff.perHourBonusByDim).toEqual({ mv: 1, spv: 0.5 });
      const durationMs = new Date(buff.endsAt).getTime() - new Date(buff.startsAt).getTime();
      expect(durationMs).toBe(3 * 60 * 60 * 1000);
    });

    it('returns instant delta MV +4, SpV +2', () => {
      const { instantDelta } = createLeisureBuff('2024-03-15T12:00:00.000Z');
      expect(instantDelta).toEqual({ mv: 4, spv: 2 });
    });
  });

  // ── Social call ──

  describe('createSocialCallInstantDelta', () => {
    it('returns SV +3, MV +1', () => {
      const delta = createSocialCallInstantDelta();
      expect(delta).toEqual({ sv: 3, mv: 1 });
    });
  });

  // ── Buff cap enforcement (+8/hr) ──

  describe('meal cap enforcement (+8/hr per dim)', () => {
    it('single buff under cap is fully applied', () => {
      const buffs = createMealBuff('NUTRIENT_OPTIMAL', '2024-03-15T12:00:00.000Z');
      const state = makeState({
        activeBuffs: buffs,
      });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T13:00:00.000Z', // within buff duration — afternoon period
        'Asia/Dubai'                  // 13:00 UTC = 17:00 Dubai (still afternoon)
      );
      expect(deltaBreakdown.buffBonus.pv).toBe(6); // under cap
      expect(deltaBreakdown.buffBonus.mv).toBe(4); // under cap
    });

    it('stacked buffs are capped at +8/hr per dimension', () => {
      const now = '2024-03-15T12:00:00.000Z';
      const buf1 = createMealBuff('NUTRIENT_OPTIMAL', now);  // PV +6, MV +4
      const buf2 = createMealBuff('RESTAURANT', now);         // PV +4, MV +2

      const state = makeState({
        activeBuffs: [...buf1, ...buf2],
      });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T13:00:00.000Z',
        'Asia/Dubai'
      );
      // PV: 6+4=10 -> capped at 8
      expect(deltaBreakdown.buffBonus.pv).toBe(8);
      // MV: 4+2=6 -> under cap
      expect(deltaBreakdown.buffBonus.mv).toBe(6);
    });

    it('expired buffs are not counted toward cap', () => {
      const expiredBuff: Buff = {
        id: 'expired',
        source: 'MEAL',
        startsAt: '2024-03-15T08:00:00.000Z',
        endsAt: '2024-03-15T10:00:00.000Z', // expired
        perHourBonusByDim: { pv: 10 },
      };
      const activeBuff: Buff = {
        id: 'active',
        source: 'MEAL',
        startsAt: '2024-03-15T12:00:00.000Z',
        endsAt: '2024-03-15T18:00:00.000Z',
        perHourBonusByDim: { pv: 3 },
      };
      const state = makeState({
        activeBuffs: [expiredBuff, activeBuff],
      });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T13:00:00.000Z',
        'Asia/Dubai'
      );
      expect(deltaBreakdown.buffBonus.pv).toBe(3); // only active buff
    });
  });

  // ── Cascade cross-drain ──

  describe('cascade cross-drain', () => {
    it('no cascade when all dims >= 20', () => {
      const state = makeState({ vigor: { ...half } }); // all 50
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z',
        'Asia/Dubai'
      );
      for (const key of ['pv', 'mv', 'sv', 'cv', 'spv'] as const) {
        expect(deltaBreakdown.cascadeDrain[key]).toBe(0);
      }
    });

    it('single critical dim triggers drain on others', () => {
      const state = makeState({
        vigor: { pv: 10, mv: 50, sv: 50, cv: 50, spv: 50 }, // PV critical
      });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z',
        'Asia/Dubai'
      );
      // From Bible §3.6 CASCADE_MATRIX.pv: mv 0.3, sv 0.1, cv 0 (absent), spv 0.1
      // Drain = coefficient * CRITICAL_DRAIN_RATE(1.5)
      expect(deltaBreakdown.cascadeDrain.mv).toBeCloseTo(0.3 * 1.5, 10);
      expect(deltaBreakdown.cascadeDrain.cv).toBeCloseTo(0, 10);
      expect(deltaBreakdown.cascadeDrain.sv).toBeCloseTo(0.1 * 1.5, 10);
      expect(deltaBreakdown.cascadeDrain.spv).toBeCloseTo(0.1 * 1.5, 10);
      expect(deltaBreakdown.cascadeDrain.pv).toBe(0); // source is not drained by itself
    });

    it('cross-drain cap at 3.0 per dim per hour', () => {
      // All dims critical -> each target accumulates drain from 4 sources
      const state = makeState({
        vigor: { pv: 5, mv: 5, sv: 5, cv: 5, spv: 5 },
      });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z',
        'Asia/Dubai'
      );
      for (const key of ['pv', 'mv', 'sv', 'cv', 'spv'] as const) {
        expect(deltaBreakdown.cascadeDrain[key]).toBeLessThanOrEqual(3.0);
      }
    });

    it('cascade matrix is symmetric-ish: each source drains only others, not self', () => {
      for (const sourceKey of ['pv', 'mv', 'sv', 'cv', 'spv'] as const) {
        expect(CASCADE_MATRIX[sourceKey][sourceKey]).toBeUndefined();
      }
    });

    it('dim at exactly 20 does NOT trigger cascade', () => {
      const state = makeState({
        vigor: { pv: 20, mv: 50, sv: 50, cv: 50, spv: 50 },
      });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z',
        'Asia/Dubai'
      );
      // PV is at threshold, should NOT trigger drain
      expect(deltaBreakdown.cascadeDrain.mv).toBe(0);
    });

    it('dim at 19 triggers cascade', () => {
      const state = makeState({
        vigor: { pv: 19, mv: 50, sv: 50, cv: 50, spv: 50 },
      });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z',
        'Asia/Dubai'
      );
      expect(deltaBreakdown.cascadeDrain.mv).toBeGreaterThan(0);
    });
  });

  // ── Meal penalty & daily reset ──

  describe('applyDailyReset', () => {
    it('3+ meals: no penalty, reduces existing penalty level', () => {
      const state = makeState({
        mealsEatenToday: 3,
        mealPenaltyLevel: 2,
      });
      const { newState, penaltyApplied } = applyDailyReset(
        state,
        '2024-03-16T20:00:00.000Z' // midnight Dubai
      );
      expect(penaltyApplied).toBeNull();
      expect(newState.mealPenaltyLevel).toBe(1); // reduced by 1
      expect(newState.mealsEatenToday).toBe(0); // reset
      expect(newState.lastMealTimes).toEqual([]); // reset
    });

    it('2 meals: mild penalty multipliers', () => {
      const state = makeState({
        mealsEatenToday: 2,
        mealPenaltyLevel: 0,
      });
      const { penaltyApplied, newState } = applyDailyReset(
        state,
        '2024-03-16T20:00:00.000Z'
      );
      expect(penaltyApplied).not.toBeNull();
      expect(penaltyApplied!.regenMultipliers.pv).toBe(0.9);
      expect(penaltyApplied!.regenMultipliers.mv).toBe(0.95);
      expect(newState.mealPenaltyLevel).toBe(1);
    });

    it('1 meal: moderate penalty multipliers', () => {
      const state = makeState({
        mealsEatenToday: 1,
        mealPenaltyLevel: 0,
      });
      const { penaltyApplied } = applyDailyReset(
        state,
        '2024-03-16T20:00:00.000Z'
      );
      expect(penaltyApplied!.regenMultipliers.pv).toBe(0.75);
      expect(penaltyApplied!.regenMultipliers.mv).toBe(0.85);
      expect(penaltyApplied!.regenMultipliers.spv).toBe(0.9);
    });

    it('0 meals: severe penalty with immediate PV -10', () => {
      const state = makeState({
        mealsEatenToday: 0,
        mealPenaltyLevel: 0,
        vigor: { ...half },
      });
      const { newState, penaltyApplied } = applyDailyReset(
        state,
        '2024-03-16T20:00:00.000Z'
      );
      expect(penaltyApplied!.regenMultipliers.pv).toBe(0.5);
      expect(penaltyApplied!.immediateDelta).toEqual({ pv: -10 });
      expect(newState.vigor.pv).toBe(40); // 50 - 10
    });

    it('0 meals PV -10 clamps at 0 (no negative)', () => {
      const state = makeState({
        mealsEatenToday: 0,
        mealPenaltyLevel: 0,
        vigor: { pv: 5, mv: 50, sv: 50, cv: 50, spv: 50 },
      });
      const { newState } = applyDailyReset(
        state,
        '2024-03-16T20:00:00.000Z'
      );
      expect(newState.vigor.pv).toBe(0); // 5 - 10 clamped to 0
    });

    it('updates lastDailyResetLocalDate', () => {
      const state = makeState();
      const { newState } = applyDailyReset(
        state,
        '2024-03-16T20:00:00.000Z' // midnight Dubai = 2024-03-17
      );
      expect(newState.lastDailyResetLocalDate).toBe('2024-03-17');
    });
  });

  // ── Penalty clamping (no death spiral) ──

  describe('penalty clamping beyond 3 days', () => {
    it('penalty level never exceeds MAX_PENALTY_LEVEL (3)', () => {
      let state = makeState({
        mealsEatenToday: 0,
        mealPenaltyLevel: 0,
      });

      // Simulate 5 consecutive days of 0 meals
      for (let day = 0; day < 5; day++) {
        const { newState } = applyDailyReset(state, `2024-03-${16 + day}T20:00:00.000Z`);
        state = { ...newState, mealsEatenToday: 0 }; // simulate eating 0 meals again
      }

      expect(state.mealPenaltyLevel).toBe(MAX_PENALTY_LEVEL); // capped at 3
    });

    it('penalty multipliers at max level match 0-meals penalty', () => {
      // Penalty level 3 => meals equivalent = max(0, 3-3) = 0
      const state = makeState({
        mealPenaltyLevel: 3,
        vigor: { ...half },
      });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z', // morning
        'Asia/Dubai'
      );
      // PV penalty = 0.5 (from 0-meals table)
      expect(deltaBreakdown.penaltyMultiplier.pv).toBe(0.5);
      expect(deltaBreakdown.penaltyMultiplier.mv).toBe(0.7);
      expect(deltaBreakdown.penaltyMultiplier.spv).toBe(0.8);
    });

    it('good compliance reduces penalty level over time', () => {
      let state = makeState({
        mealsEatenToday: 3,
        mealPenaltyLevel: 3,
      });

      // 3 days of good eating
      for (let day = 0; day < 3; day++) {
        const { newState } = applyDailyReset(state, `2024-03-${16 + day}T20:00:00.000Z`);
        state = { ...newState, mealsEatenToday: 3 };
      }

      expect(state.mealPenaltyLevel).toBe(0); // fully recovered
    });
  });

  // ── Hourly tick integration ──

  describe('applyHourlyVigorTick integration', () => {
    it('morning awake no buffs no penalty: correct PV regen', () => {
      // PV base 2.0 * morning 1.5 = 3.0 (no cascade since vigor >= 20)
      const state = makeState({ vigor: { ...half } });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z', // 10:00 Dubai morning
        'Asia/Dubai'
      );
      expect(deltaBreakdown.netDelta.pv).toBeCloseTo(3.0, 10);
    });

    it('morning awake no buffs no penalty: correct MV regen', () => {
      // MV base 1.5 * morning 1.5 = 2.25
      const state = makeState({ vigor: { ...half } });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z',
        'Asia/Dubai'
      );
      expect(deltaBreakdown.netDelta.mv).toBeCloseTo(2.25, 10);
    });

    it('afternoon with meal buff: PV and MV boosted', () => {
      const now = '2024-03-15T09:00:00.000Z'; // 13:00 Dubai (afternoon)
      const buffs = createMealBuff('RESTAURANT', now);
      const state = makeState({
        vigor: { ...half }, // above cascade threshold
        activeBuffs: buffs,
      });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        now,
        'Asia/Dubai'
      );
      // PV: base 2.0 * afternoon 1.0 + buff 4 = 6.0
      expect(deltaBreakdown.netDelta.pv).toBeCloseTo(6.0, 10);
      // MV: base 1.5 * afternoon 1.0 + buff 2 = 3.5
      expect(deltaBreakdown.netDelta.mv).toBeCloseTo(3.5, 10);
    });

    it('buffs are expired after tick', () => {
      const expiredBuff: Buff = {
        id: 'will-expire',
        source: 'MEAL',
        startsAt: '2024-03-15T08:00:00.000Z',
        endsAt: '2024-03-15T12:00:00.000Z', // exactly at tick time
        perHourBonusByDim: { pv: 5 },
      };
      const state = makeState({ activeBuffs: [expiredBuff] });
      const { newState } = applyHourlyVigorTick(
        state,
        '2024-03-15T12:00:00.000Z',
        'Asia/Dubai'
      );
      expect(newState.activeBuffs).toHaveLength(0);
    });

    it('vigor never goes below 0', () => {
      // Create a scenario where cascade drain is heavy
      const state = makeState({
        vigor: { pv: 1, mv: 1, sv: 1, cv: 1, spv: 1 },
        mealPenaltyLevel: 3,
      });
      const { newState } = applyHourlyVigorTick(
        state,
        '2024-03-14T23:00:00.000Z', // night (x0.5 for awake = low regen)
        'Asia/Dubai'
      );
      for (const key of ['pv', 'mv', 'sv', 'cv', 'spv'] as const) {
        expect(newState.vigor[key]).toBeGreaterThanOrEqual(0);
      }
    });

    it('vigor never exceeds cap', () => {
      const caps: VigorCaps = { pv_cap: 80, mv_cap: 80, sv_cap: 80, cv_cap: 80, spv_cap: 80 };
      const state = makeState({
        vigor: { pv: 79, mv: 79, sv: 79, cv: 79, spv: 79 },
        caps,
      });
      const { newState } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z', // morning, high regen
        'Asia/Dubai'
      );
      for (const key of ['pv', 'mv', 'sv', 'cv', 'spv'] as const) {
        expect(newState.vigor[key]).toBeLessThanOrEqual(80);
      }
    });
  });

  // ── Fine dining instant SV +2 ──

  describe('fine dining instant SV bonus', () => {
    it('FINE_DINING buff has instantDeltaByDim with SV +2', () => {
      const buffs = createMealBuff('FINE_DINING', '2024-03-15T12:00:00.000Z');
      expect(buffs[0].instantDeltaByDim).toEqual({ sv: 2 });
    });

    it('applying instant delta with addVigor gives SV +2', () => {
      const buffs = createMealBuff('FINE_DINING', '2024-03-15T12:00:00.000Z');
      const instantDelta = buffs[0].instantDeltaByDim!;
      const { vigor } = addVigor(half, instantDelta);
      expect(vigor.sv).toBe(52);
    });
  });

  // ── Determinism ──

  describe('determinism', () => {
    it('same inputs produce identical output', () => {
      const state = makeState({
        vigor: { pv: 33, mv: 67, sv: 12, cv: 88, spv: 45 },
        sleepState: 'sleeping',
        mealPenaltyLevel: 1,
        activeBuffs: [{
          id: 'test-buff',
          source: 'MEAL',
          startsAt: '2024-03-15T10:00:00.000Z',
          endsAt: '2024-03-15T16:00:00.000Z',
          perHourBonusByDim: { pv: 3, mv: 2 },
        }],
      });
      const now = '2024-03-15T12:00:00.000Z';

      const result1 = applyHourlyVigorTick(state, now, 'Asia/Dubai');
      const result2 = applyHourlyVigorTick(state, now, 'Asia/Dubai');

      expect(result1.newState.vigor).toEqual(result2.newState.vigor);
      expect(result1.deltaBreakdown).toEqual(result2.deltaBreakdown);
    });

    it('daily reset is deterministic', () => {
      const state = makeState({
        mealsEatenToday: 1,
        mealPenaltyLevel: 2,
        vigor: { ...mixed },
      });
      const now = '2024-03-16T20:00:00.000Z';

      const result1 = applyDailyReset(state, now);
      const result2 = applyDailyReset(state, now);

      expect(result1.newState).toEqual(result2.newState);
      expect(result1.penaltyApplied).toEqual(result2.penaltyApplied);
      expect(result1.summary).toEqual(result2.summary);
    });
  });

  // ── validateNoHardLockouts ──

  describe('validateNoHardLockouts', () => {
    it('SLEEP is always allowed even at 0 vigor', () => {
      const result = validateNoHardLockouts(zero, 'SLEEP');
      expect(result.allowed).toBe(true);
    });

    it('EAT_MEAL is always allowed even at 0 vigor', () => {
      const result = validateNoHardLockouts(zero, 'EAT_MEAL');
      expect(result.allowed).toBe(true);
    });

    it('WORK_SHIFT is allowed at 0 vigor with reduced performance note', () => {
      const result = validateNoHardLockouts(zero, 'WORK_SHIFT');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Reduced performance');
    });

    it('WORK_SHIFT at full vigor has no reason', () => {
      const result = validateNoHardLockouts(full, 'WORK_SHIFT');
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('LEISURE is blocked when any dim is 0', () => {
      const result = validateNoHardLockouts(
        { pv: 0, mv: 50, sv: 50, cv: 50, spv: 50 },
        'LEISURE'
      );
      expect(result.allowed).toBe(false);
    });

    it('non-essential action is allowed when all dims > 0', () => {
      const result = validateNoHardLockouts(
        { pv: 1, mv: 1, sv: 1, cv: 1, spv: 1 },
        'MARKET_PLACE_ORDER'
      );
      expect(result.allowed).toBe(true);
    });
  });

  // ── Penalty regen multiplier in tick ──

  describe('penalty regen multipliers in hourly tick', () => {
    it('penalty level 0: no multiplier reduction', () => {
      const state = makeState({ mealPenaltyLevel: 0 });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z',
        'Asia/Dubai'
      );
      expect(deltaBreakdown.penaltyMultiplier.pv).toBe(1.0);
      expect(deltaBreakdown.penaltyMultiplier.mv).toBe(1.0);
    });

    it('penalty level 1: 2-meals penalty (PV x0.9, MV x0.95)', () => {
      const state = makeState({ mealPenaltyLevel: 1 });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z',
        'Asia/Dubai'
      );
      expect(deltaBreakdown.penaltyMultiplier.pv).toBe(0.9);
      expect(deltaBreakdown.penaltyMultiplier.mv).toBe(0.95);
    });

    it('penalty level 2: 1-meal penalty (PV x0.75)', () => {
      const state = makeState({ mealPenaltyLevel: 2 });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z',
        'Asia/Dubai'
      );
      expect(deltaBreakdown.penaltyMultiplier.pv).toBe(0.75);
      expect(deltaBreakdown.penaltyMultiplier.mv).toBe(0.85);
      expect(deltaBreakdown.penaltyMultiplier.spv).toBe(0.9);
    });

    it('penalty level 3 (max): 0-meals penalty (PV x0.5)', () => {
      const state = makeState({ mealPenaltyLevel: 3 });
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z',
        'Asia/Dubai'
      );
      expect(deltaBreakdown.penaltyMultiplier.pv).toBe(0.5);
      expect(deltaBreakdown.penaltyMultiplier.mv).toBe(0.7);
      expect(deltaBreakdown.penaltyMultiplier.spv).toBe(0.8);
    });
  });

  // ── Tick breakdown structure ──

  describe('tick breakdown structure', () => {
    it('breakdown has all required fields', () => {
      const state = makeState();
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z',
        'Asia/Dubai'
      );
      expect(deltaBreakdown).toHaveProperty('baseRegen');
      expect(deltaBreakdown).toHaveProperty('circadianMultiplier');
      expect(deltaBreakdown).toHaveProperty('sleepAdjustment');
      expect(deltaBreakdown).toHaveProperty('buffBonus');
      expect(deltaBreakdown).toHaveProperty('penaltyMultiplier');
      expect(deltaBreakdown).toHaveProperty('cascadeDrain');
      expect(deltaBreakdown).toHaveProperty('netDelta');
    });

    it('all breakdown records have all 5 dimensions', () => {
      const state = makeState();
      const { deltaBreakdown } = applyHourlyVigorTick(
        state,
        '2024-03-15T06:00:00.000Z',
        'Asia/Dubai'
      );
      const dims = ['pv', 'mv', 'sv', 'cv', 'spv'] as const;
      for (const field of [
        'baseRegen', 'circadianMultiplier', 'sleepAdjustment',
        'buffBonus', 'penaltyMultiplier', 'cascadeDrain', 'netDelta',
      ] as const) {
        for (const dim of dims) {
          expect(typeof (deltaBreakdown as Record<string, Record<string, number>>)[field][dim]).toBe('number');
        }
      }
    });
  });

  // ══════════════════════════════════════════════════════════════
  // projectActionOutcome
  // ══════════════════════════════════════════════════════════════

  describe('projectActionOutcome', () => {
    const baseOpts = {
      currentVigor: { pv: 100, mv: 100, sv: 100, cv: 100, spv: 100 } as VigorDimension,
      caps: { pv_cap: 100, mv_cap: 100, sv_cap: 100, cv_cap: 100, spv_cap: 100 } as VigorCaps,
      vigorCost: {} as Partial<VigorDimension>,
      vigorGain: {} as Partial<VigorDimension>,
      moneyCostCents: 0,
      moneyGainCents: 0,
      durationSeconds: 300,
      currentBalanceCents: 50000,
      queueEndTime: new Date('2024-03-15T10:00:00Z'),
    };

    it('calculates vigorAfter correctly (cost subtracted, gain added)', () => {
      const result = projectActionOutcome({
        ...baseOpts,
        vigorCost: { pv: 20, mv: 10 },
        vigorGain: { sv: 5 },
      });
      expect(result.vigorAfter.pv).toBe(80);
      expect(result.vigorAfter.mv).toBe(90);
      expect(result.vigorAfter.sv).toBe(100);
    });

    it('clamps vigorAfter to [0, cap]', () => {
      const result = projectActionOutcome({
        ...baseOpts,
        currentVigor: { pv: 5, mv: 100, sv: 100, cv: 100, spv: 100 },
        vigorCost: { pv: 50 },
      });
      expect(result.vigorAfter.pv).toBe(0);
    });

    it('populates vigorDelta only for non-zero changes', () => {
      const result = projectActionOutcome({
        ...baseOpts,
        vigorCost: { pv: 10 },
      });
      expect(result.vigorDelta.pv).toBe(-10);
      expect(result.vigorDelta.mv).toBeUndefined();
    });

    it('generates cascade warning when dimension drops below CASCADE_THRESHOLD', () => {
      const result = projectActionOutcome({
        ...baseOpts,
        currentVigor: { pv: 25, mv: 100, sv: 100, cv: 100, spv: 100 },
        vigorCost: { pv: 10 },
      });
      expect(result.warnings.some(w => w.includes('PV') && w.includes('cascade'))).toBe(true);
    });

    it('generates exhaustion warning when dimension hits 0', () => {
      const result = projectActionOutcome({
        ...baseOpts,
        currentVigor: { pv: 5, mv: 100, sv: 100, cv: 100, spv: 100 },
        vigorCost: { pv: 10 },
      });
      expect(result.warnings.some(w => w.includes('PV') && w.includes('0'))).toBe(true);
    });

    it('generates insufficient funds warning', () => {
      const result = projectActionOutcome({
        ...baseOpts,
        moneyCostCents: 10000,
        currentBalanceCents: 5000,
      });
      expect(result.warnings.some(w => w.includes('Insufficient funds'))).toBe(true);
    });

    it('returns empty warnings when all is fine', () => {
      const result = projectActionOutcome(baseOpts);
      expect(result.warnings).toEqual([]);
    });

    it('calculates completionTime from queueEndTime + durationSeconds', () => {
      // Use a future date so Date.now() doesn't override queueEndTime
      const futureBase = new Date(Date.now() + 3600_000); // 1 hour from now
      const result = projectActionOutcome({
        ...baseOpts,
        durationSeconds: 600,
        queueEndTime: futureBase,
      });
      const expected = new Date(futureBase.getTime() + 600_000).toISOString();
      expect(result.completionTime).toBe(expected);
    });

    it('preserves money fields in output', () => {
      const result = projectActionOutcome({
        ...baseOpts,
        moneyCostCents: 500,
        moneyGainCents: 1200,
      });
      expect(result.moneyCostCents).toBe(500);
      expect(result.moneyGainCents).toBe(1200);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // Boundary Invariants
  // ══════════════════════════════════════════════════════════════

  describe('Boundary Invariants', () => {
    describe('Meal buff cap', () => {
      it('total buff bonus per dim per hour does not exceed BUFF_CAP_PER_DIM_PER_HOUR', () => {
        const now = '2024-03-15T10:00:00.000Z';
        const buffs1 = createMealBuff('NUTRIENT_OPTIMAL', now);
        const buffs2 = createMealBuff('FINE_DINING', now);
        const allBuffs = [...buffs1, ...buffs2];

        const state = makeState({
          vigor: { pv: 50, mv: 50, sv: 50, cv: 50, spv: 50 },
          activeBuffs: allBuffs,
        });

        const { deltaBreakdown } = applyHourlyVigorTick(state, now, 'Asia/Dubai');

        expect(deltaBreakdown.buffBonus.pv).toBeLessThanOrEqual(BUFF_CAP_PER_DIM_PER_HOUR);
        expect(deltaBreakdown.buffBonus.mv).toBeLessThanOrEqual(BUFF_CAP_PER_DIM_PER_HOUR);
      });
    });

    describe('Cascade cross-drain cap', () => {
      it('cross-drain per target dim does not exceed CROSS_DRAIN_CAP_PER_DIM', () => {
        const critical: VigorDimension = { pv: 5, mv: 5, sv: 5, cv: 5, spv: 50 };
        const state = makeState({ vigor: critical });

        const { deltaBreakdown } = applyHourlyVigorTick(
          state,
          '2024-03-15T10:00:00.000Z',
          'Asia/Dubai'
        );

        for (const key of ['pv', 'mv', 'sv', 'cv', 'spv'] as const) {
          expect(deltaBreakdown.cascadeDrain[key]).toBeLessThanOrEqual(CROSS_DRAIN_CAP_PER_DIM);
        }
      });
    });

    describe('Daily penalty level clamp', () => {
      it('penalty level never exceeds MAX_PENALTY_LEVEL after many missed meals', () => {
        let state = makeState({ mealPenaltyLevel: 0, mealsEatenToday: 0 });

        for (let day = 0; day < 10; day++) {
          const date = `2024-03-${String(15 + day).padStart(2, '0')}`;
          const { newState } = applyDailyReset(state, `${date}T00:00:00.000Z`);
          state = { ...newState, mealsEatenToday: 0 };
          expect(state.mealPenaltyLevel).toBeLessThanOrEqual(MAX_PENALTY_LEVEL);
        }

        expect(state.mealPenaltyLevel).toBe(MAX_PENALTY_LEVEL);
      });
    });

    describe('Determinism', () => {
      it('applyHourlyVigorTick produces identical output for identical input 100 times', () => {
        const state = makeState({
          vigor: { pv: 75, mv: 30, sv: 45, cv: 60, spv: 20 },
          sleepState: 'awake',
          mealPenaltyLevel: 1,
        });
        const now = '2024-03-15T14:00:00.000Z';

        const firstResult = applyHourlyVigorTick(state, now, 'Asia/Dubai');

        for (let i = 0; i < 100; i++) {
          const result = applyHourlyVigorTick(state, now, 'Asia/Dubai');
          expect(result.newState.vigor).toEqual(firstResult.newState.vigor);
          expect(result.deltaBreakdown).toEqual(firstResult.deltaBreakdown);
        }
      });
    });
  });
});
