import {
  // Skills
  addSkillXP,
  defaultSkillSet,
  SKILL_NAMES,
  // Jobs
  calculatePerformance,
  calculateDailyPay,
  calculateShiftPay,
  getShiftVigorCost,
  applyShiftSkillXP,
  JOBS_CATALOG,
  JOB_FAMILIES,
  SHIFT_VIGOR_COSTS,
  SHIFT_HOURS,
  // Bills / Housing
  HOUSING_TIERS,
  UTILITIES_DAILY_COST,
  getHousingTier,
  getHousingRegenBonuses,
  getDailyRent,
  getDailyUtilities,
  getDailyHousingCost,
  processRent,
  // Goods / District pricing
  calculateMarketPrice,
  applyDistrictModifier,
  calculateFinalGoodPrice,
  GOOD_BASE_PRICES,
  DISTRICT_MODIFIERS,
  // Legacy
  calculateJobPayout,
  // Ledger
  LEDGER_ENTRY_TYPES,
  validateLedgerEntry,
  validateLedgerBalance,
  createJobPayEntry,
  createRentEntry,
  createUtilitiesEntry,
  createPurchaseEntry,
} from './economy';
import type { LedgerEntry } from './economy';
import type { VigorDimension } from './types';
import { ValidationError } from './errors';

// ── Test fixtures ────────────────────────────────────────────

const fullVigor: VigorDimension = { pv: 100, mv: 100, sv: 100, cv: 100, spv: 100 };
const halfVigor: VigorDimension = { pv: 50, mv: 50, sv: 50, cv: 50, spv: 50 };
const lowVigor: VigorDimension = { pv: 20, mv: 20, sv: 20, cv: 20, spv: 20 };

// ══════════════════════════════════════════════════════════════
// A) SKILLS
// ══════════════════════════════════════════════════════════════

describe('Skills', () => {
  it('has 5 skill names: labor, admin, service, management, trading', () => {
    expect(SKILL_NAMES).toEqual(['labor', 'admin', 'service', 'management', 'trading']);
  });

  describe('addSkillXP', () => {
    it('increases skill from base 0.1', () => {
      const result = addSkillXP(0.1, 480, 1.0); // 8 hours full intensity
      expect(result).toBeGreaterThan(0.1);
      expect(result).toBeLessThanOrEqual(2.0);
    });

    it('returns same value for 0 minutes', () => {
      expect(addSkillXP(0.5, 0, 1.0)).toBe(0.5);
    });

    it('returns same value for 0 intensity', () => {
      expect(addSkillXP(0.5, 480, 0)).toBe(0.5);
    });

    it('clamps intensity to [0, 1]', () => {
      const normal = addSkillXP(0.5, 60, 1.0);
      const over = addSkillXP(0.5, 60, 5.0); // clamped to 1.0
      expect(over).toBe(normal);
    });

    it('never exceeds soft cap 2.0', () => {
      const result = addSkillXP(1.99, 99999, 1.0);
      expect(result).toBeLessThanOrEqual(2.0);
    });

    it('never goes below 0.1', () => {
      const result = addSkillXP(0.05, 0, 1.0);
      expect(result).toBeGreaterThanOrEqual(0.1);
    });

    it('has diminishing returns as skill increases', () => {
      const lowGain = addSkillXP(0.1, 60, 1.0) - 0.1;
      const highGain = addSkillXP(1.5, 60, 1.0) - 1.5;
      expect(lowGain).toBeGreaterThan(highGain);
    });

    it('at soft cap (2.0), gain is 0', () => {
      const result = addSkillXP(2.0, 480, 1.0);
      expect(result).toBe(2.0);
    });

    it('higher intensity yields more XP', () => {
      const low = addSkillXP(0.5, 60, 0.3);
      const high = addSkillXP(0.5, 60, 0.9);
      expect(high).toBeGreaterThan(low);
    });

    it('negative minutes return current value', () => {
      expect(addSkillXP(0.5, -60, 1.0)).toBe(0.5);
    });
  });

  describe('defaultSkillSet', () => {
    it('all skills start at 0.1', () => {
      const skills = defaultSkillSet();
      for (const name of SKILL_NAMES) {
        expect(skills[name]).toBe(0.1);
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════
// B) JOBS
// ══════════════════════════════════════════════════════════════

describe('Jobs', () => {
  describe('calculatePerformance', () => {
    it('full vigor + skill 1.0 + defaults = close to 1.0', () => {
      const perf = calculatePerformance('physical', 1.0, fullVigor);
      // Skill 1.0 * (100/100)^1.0 * (100/100)^0.3 * clamp(1.0, 0.5, 1.3) * clamp(1.0, 0.5, 1.5)
      // = 1.0 * 1.0 * 1.0 * 1.0 * 1.0 = 1.0
      expect(perf).toBeCloseTo(1.0, 10);
    });

    it('physical: low PV hurts more than low MV', () => {
      const lowPV = calculatePerformance('physical', 1.0, { ...fullVigor, pv: 30 });
      const lowMV = calculatePerformance('physical', 1.0, { ...fullVigor, mv: 30 });
      // wPV=1.0 (strong), wMV=0.3 (weak) — lowPV should hurt more
      expect(lowPV).toBeLessThan(lowMV);
    });

    it('admin: low MV hurts more than low PV', () => {
      const lowPV = calculatePerformance('admin', 1.0, { ...fullVigor, pv: 30 });
      const lowMV = calculatePerformance('admin', 1.0, { ...fullVigor, mv: 30 });
      // wPV=0.2 (weak), wMV=1.0 (strong) — lowMV should hurt more
      expect(lowMV).toBeLessThan(lowPV);
    });

    it('service: SV factor multiplier applies', () => {
      const highSV = calculatePerformance('service', 1.0, fullVigor);
      const lowSV = calculatePerformance('service', 1.0, { ...fullVigor, sv: 10 });
      // SV factor: (0.7 + SV/300)
      // high: 0.7 + 100/300 = 1.033
      // low:  0.7 + 10/300  = 0.733
      expect(highSV).toBeGreaterThan(lowSV);
    });

    it('satisfaction is clamped to [0.5, 1.3]', () => {
      const low = calculatePerformance('physical', 1.0, fullVigor, 0.1);
      const high = calculatePerformance('physical', 1.0, fullVigor, 5.0);
      const atMin = calculatePerformance('physical', 1.0, fullVigor, 0.5);
      const atMax = calculatePerformance('physical', 1.0, fullVigor, 1.3);
      expect(low).toBe(atMin);
      expect(high).toBe(atMax);
    });

    it('equipment quality is clamped to [0.5, 1.5]', () => {
      const low = calculatePerformance('physical', 1.0, fullVigor, 1.0, 0.1);
      const high = calculatePerformance('physical', 1.0, fullVigor, 1.0, 10.0);
      const atMin = calculatePerformance('physical', 1.0, fullVigor, 1.0, 0.5);
      const atMax = calculatePerformance('physical', 1.0, fullVigor, 1.0, 1.5);
      expect(low).toBe(atMin);
      expect(high).toBe(atMax);
    });

    it('higher skill yields higher performance', () => {
      const low = calculatePerformance('physical', 0.5, fullVigor);
      const high = calculatePerformance('physical', 1.5, fullVigor);
      expect(high).toBeGreaterThan(low);
    });

    it('performance is always positive when vigor > 0', () => {
      for (const family of JOB_FAMILIES) {
        const perf = calculatePerformance(family, 0.1, lowVigor, 0.5, 0.5);
        expect(perf).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateDailyPay', () => {
    it('pay is bounded by performance clamp [0.4, 1.5]', () => {
      const minPay = calculateDailyPay(10000, 0.0); // clamped to 0.4
      const maxPay = calculateDailyPay(10000, 99.0); // clamped to 1.5
      expect(minPay).toBe(4000);
      expect(maxPay).toBe(15000);
    });

    it('pay at performance 1.0 equals base wage', () => {
      expect(calculateDailyPay(12000, 1.0)).toBe(12000);
    });

    it('pay is always an integer', () => {
      expect(Number.isInteger(calculateDailyPay(12345, 0.77))).toBe(true);
    });

    it('pay is always >= baseWage * 0.4', () => {
      for (const job of JOBS_CATALOG) {
        const pay = calculateDailyPay(job.baseWageDaily, 0.001);
        expect(pay).toBe(Math.floor(job.baseWageDaily * 0.4));
      }
    });

    it('pay is always <= baseWage * 1.5', () => {
      for (const job of JOBS_CATALOG) {
        const pay = calculateDailyPay(job.baseWageDaily, 999);
        expect(pay).toBe(Math.floor(job.baseWageDaily * 1.5));
      }
    });
  });

  describe('calculateShiftPay', () => {
    it('full shift = full daily pay', () => {
      const daily = calculateDailyPay(12000, 1.0);
      const shift = calculateShiftPay(12000, 1.0, 'full');
      expect(shift).toBe(daily); // 8/8 = 1.0
    });

    it('short shift = 1/4 of daily pay', () => {
      const daily = calculateDailyPay(12000, 1.0);
      const shift = calculateShiftPay(12000, 1.0, 'short');
      expect(shift).toBe(Math.floor(daily * 0.25)); // 2/8 = 0.25
    });

    it('shift pay is always integer', () => {
      expect(Number.isInteger(calculateShiftPay(12345, 0.77, 'short'))).toBe(true);
    });
  });

  describe('shift vigor costs', () => {
    it('physical short shift: PV -10, MV -3', () => {
      const cost = getShiftVigorCost('physical', 'short');
      expect(cost).toEqual({ pv: 10, mv: 3 });
    });

    it('physical full shift: PV -25, MV -8', () => {
      const cost = getShiftVigorCost('physical', 'full');
      expect(cost).toEqual({ pv: 25, mv: 8 });
    });

    it('admin short shift: MV -10, CV -2', () => {
      const cost = getShiftVigorCost('admin', 'short');
      expect(cost).toEqual({ mv: 10, cv: 2 });
    });

    it('admin full shift: MV -25, CV -6', () => {
      const cost = getShiftVigorCost('admin', 'full');
      expect(cost).toEqual({ mv: 25, cv: 6 });
    });

    it('service short shift: SV -8, MV -4', () => {
      const cost = getShiftVigorCost('service', 'short');
      expect(cost).toEqual({ sv: 8, mv: 4 });
    });

    it('service full shift: SV -18, MV -10', () => {
      const cost = getShiftVigorCost('service', 'full');
      expect(cost).toEqual({ sv: 18, mv: 10 });
    });

    it('management short shift: MV heavy', () => {
      const cost = getShiftVigorCost('management', 'short');
      expect(cost.mv).toBeGreaterThanOrEqual(10);
    });

    it('management full shift: MV heavy with SV and SpV', () => {
      const cost = getShiftVigorCost('management', 'full');
      expect(cost.mv).toBeGreaterThanOrEqual(20);
      expect(cost.sv).toBeGreaterThan(0);
      expect(cost.spv).toBeGreaterThan(0);
    });

    it('full shift costs more than short for every family', () => {
      for (const family of JOB_FAMILIES) {
        const shortCost = getShiftVigorCost(family, 'short');
        const fullCost = getShiftVigorCost(family, 'full');
        const shortTotal = Object.values(shortCost).reduce((a, b) => a + (b ?? 0), 0);
        const fullTotal = Object.values(fullCost).reduce((a, b) => a + (b ?? 0), 0);
        expect(fullTotal).toBeGreaterThan(shortTotal);
      }
    });

    it('returns a copy, not a reference to SHIFT_VIGOR_COSTS', () => {
      const cost = getShiftVigorCost('physical', 'short');
      cost.pv = 999;
      const cost2 = getShiftVigorCost('physical', 'short');
      expect(cost2.pv).toBe(10); // unchanged
    });
  });

  describe('applyShiftSkillXP', () => {
    it('returns primary skill name for the family', () => {
      expect(applyShiftSkillXP('physical', 0.5, 'full').skill).toBe('labor');
      expect(applyShiftSkillXP('admin', 0.5, 'full').skill).toBe('admin');
      expect(applyShiftSkillXP('service', 0.5, 'full').skill).toBe('service');
      expect(applyShiftSkillXP('management', 0.5, 'full').skill).toBe('management');
    });

    it('increases skill after a shift', () => {
      const result = applyShiftSkillXP('physical', 0.5, 'full');
      expect(result.newValue).toBeGreaterThan(0.5);
    });

    it('full shift gives more XP than short shift', () => {
      const short = applyShiftSkillXP('physical', 0.5, 'short');
      const full = applyShiftSkillXP('physical', 0.5, 'full');
      expect(full.newValue).toBeGreaterThan(short.newValue);
    });
  });

  describe('JOBS_CATALOG', () => {
    it('has 4 jobs', () => {
      expect(JOBS_CATALOG).toHaveLength(4);
    });

    it('each job has a valid family', () => {
      for (const job of JOBS_CATALOG) {
        expect(JOB_FAMILIES).toContain(job.family);
      }
    });

    it('each job has a positive base wage', () => {
      for (const job of JOBS_CATALOG) {
        expect(job.baseWageDaily).toBeGreaterThan(0);
        expect(Number.isInteger(job.baseWageDaily)).toBe(true);
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════
// C) BILLS — Housing & Utilities
// ══════════════════════════════════════════════════════════════

describe('Bills — Housing & Utilities', () => {
  describe('HOUSING_TIERS', () => {
    it('has 5 tiers (0-4)', () => {
      expect(HOUSING_TIERS).toHaveLength(5);
    });

    it('tier 0 (Shelter) is free', () => {
      expect(HOUSING_TIERS[0].dailyRentCents).toBe(0);
    });

    it('tier rents match spec exactly', () => {
      expect(HOUSING_TIERS[0].dailyRentCents).toBe(0);
      expect(HOUSING_TIERS[1].dailyRentCents).toBe(1000);  // ₿10
      expect(HOUSING_TIERS[2].dailyRentCents).toBe(2000);  // ₿20
      expect(HOUSING_TIERS[3].dailyRentCents).toBe(3500);  // ₿35
      expect(HOUSING_TIERS[4].dailyRentCents).toBe(6000);  // ₿60
    });

    it('regen bonuses match spec exactly', () => {
      expect(HOUSING_TIERS[0].regenBonuses).toEqual({});
      expect(HOUSING_TIERS[1].regenBonuses).toEqual({ pv: 0.2 });
      expect(HOUSING_TIERS[2].regenBonuses).toEqual({ pv: 0.5 });
      expect(HOUSING_TIERS[3].regenBonuses).toEqual({ pv: 0.8, mv: 0.2 });
      expect(HOUSING_TIERS[4].regenBonuses).toEqual({ pv: 1.2, mv: 0.4, sv: 0.2 });
    });
  });

  describe('getHousingTier', () => {
    it('returns correct tier', () => {
      expect(getHousingTier(3).name).toBe('1BR');
    });

    it('out-of-bounds tier returns Shelter', () => {
      expect(getHousingTier(-1).tier).toBe(0);
      expect(getHousingTier(99).tier).toBe(0);
    });
  });

  describe('getHousingRegenBonuses', () => {
    it('tier 4 has PV, MV, and SV bonuses', () => {
      const bonuses = getHousingRegenBonuses(4);
      expect(bonuses.pv).toBe(1.2);
      expect(bonuses.mv).toBe(0.4);
      expect(bonuses.sv).toBe(0.2);
    });

    it('returns a copy, not a reference', () => {
      const a = getHousingRegenBonuses(4);
      a.pv = 999;
      const b = getHousingRegenBonuses(4);
      expect(b.pv).toBe(1.2);
    });
  });

  describe('getDailyHousingCost', () => {
    it('tier 0: free', () => {
      expect(getDailyHousingCost(0)).toBe(0);
    });

    it('tier 1: rent + utilities', () => {
      expect(getDailyHousingCost(1)).toBe(1000 + 200);
    });

    it('tier 4: rent + utilities', () => {
      expect(getDailyHousingCost(4)).toBe(6000 + 1200);
    });
  });

  describe('processRent (failure-resistant)', () => {
    it('player can afford tier 4: no downgrade', () => {
      const result = processRent(4, 100000); // has ₿1000, tier 4 costs ₿72
      expect(result.newTier).toBe(4);
      expect(result.amountChargedCents).toBe(7200); // 6000 + 1200
      expect(result.wasDowngraded).toBe(false);
      expect(result.discomfortPenalty).toBeNull();
    });

    it('player cannot afford tier 4: downgrade to affordable tier', () => {
      const result = processRent(4, 3000); // can afford tier 2 (₿25 cost)
      expect(result.newTier).toBe(2);
      expect(result.amountChargedCents).toBe(2500); // 2000 + 500
      expect(result.wasDowngraded).toBe(true);
    });

    it('downgrade applies discomfort penalty PV -3, SV -2', () => {
      const result = processRent(4, 500);
      expect(result.wasDowngraded).toBe(true);
      expect(result.discomfortPenalty).toEqual({ pv: -3, sv: -2 });
    });

    it('player with 0 money ends at Shelter, no charge', () => {
      const result = processRent(4, 0);
      expect(result.newTier).toBe(0);
      expect(result.amountChargedCents).toBe(0);
      expect(result.wasDowngraded).toBe(true);
    });

    it('player already at Shelter: no downgrade, no charge', () => {
      const result = processRent(0, 0);
      expect(result.newTier).toBe(0);
      expect(result.amountChargedCents).toBe(0);
      expect(result.wasDowngraded).toBe(false);
      expect(result.discomfortPenalty).toBeNull();
    });

    it('wallet never goes negative', () => {
      // Test various wallet amounts
      for (const wallet of [0, 50, 100, 500, 999, 1000, 1199, 1200, 5000]) {
        for (let tier = 0; tier <= 4; tier++) {
          const result = processRent(tier, wallet);
          expect(result.amountChargedCents).toBeLessThanOrEqual(wallet);
        }
      }
    });

    it('multi-tier downgrade works (tier 4 -> tier 0)', () => {
      const result = processRent(4, 50); // can't afford anything above shelter
      expect(result.newTier).toBe(0);
      expect(result.amountChargedCents).toBe(0);
    });

    it('exactly affordable tier is kept', () => {
      // Tier 1 costs 1200 (1000 rent + 200 utilities)
      const result = processRent(1, 1200);
      expect(result.newTier).toBe(1);
      expect(result.amountChargedCents).toBe(1200);
      expect(result.wasDowngraded).toBe(false);
    });

    it('1 cent short forces downgrade', () => {
      // Tier 1 costs 1200
      const result = processRent(1, 1199);
      expect(result.newTier).toBe(0);
      expect(result.wasDowngraded).toBe(true);
    });

    it('summary contains useful info', () => {
      const result = processRent(3, 500);
      expect(result.summary).toContain('downgraded');
      expect(result.summary).toContain('Discomfort');
    });
  });
});

// ══════════════════════════════════════════════════════════════
// D) GOODS & DISTRICT PRICING
// ══════════════════════════════════════════════════════════════

describe('Goods & District Pricing', () => {
  describe('calculateMarketPrice', () => {
    it('should return base price when supply equals demand', () => {
      expect(calculateMarketPrice(1000, 100, 100)).toBe(1000);
    });

    it('should increase price when demand exceeds supply', () => {
      const price = calculateMarketPrice(1000, 50, 100);
      expect(price).toBeGreaterThan(1000);
    });

    it('should decrease price when supply exceeds demand', () => {
      const price = calculateMarketPrice(1000, 100, 50);
      expect(price).toBeLessThan(1000);
    });

    it('should cap price at 2x base when supply is 0', () => {
      expect(calculateMarketPrice(1000, 0, 100)).toBe(2000);
    });

    it('should floor price at 0.5x base when demand is 0', () => {
      expect(calculateMarketPrice(1000, 100, 0)).toBe(500);
    });

    it('should always return an integer', () => {
      expect(Number.isInteger(calculateMarketPrice(1000, 100, 75))).toBe(true);
      expect(calculateMarketPrice(999, 7, 3)).toBe(499);
    });
  });

  describe('applyDistrictModifier', () => {
    it('CBD applies 1.5x', () => {
      expect(applyDistrictModifier(1000, 'CBD')).toBe(1500);
    });

    it('OUTSKIRTS applies 0.7x', () => {
      expect(applyDistrictModifier(1000, 'OUTSKIRTS')).toBe(700);
    });

    it('MARKET_SQ applies 1.0x (neutral)', () => {
      expect(applyDistrictModifier(1000, 'MARKET_SQ')).toBe(1000);
    });

    it('unknown district defaults to 1.0x', () => {
      expect(applyDistrictModifier(1000, 'UNKNOWN')).toBe(1000);
    });

    it('always returns integer', () => {
      expect(Number.isInteger(applyDistrictModifier(999, 'CBD'))).toBe(true);
    });
  });

  describe('calculateFinalGoodPrice', () => {
    it('combines market and district modifiers', () => {
      // PROCESSED_FOOD base = 500, supply=demand -> price 500, CBD 1.5x = 750
      const price = calculateFinalGoodPrice('PROCESSED_FOOD', 100, 100, 'CBD');
      expect(price).toBe(750);
    });

    it('always returns integer', () => {
      const price = calculateFinalGoodPrice('RAW_FOOD', 73, 91, 'UNIVERSITY');
      expect(Number.isInteger(price)).toBe(true);
    });
  });

  describe('GOOD_BASE_PRICES', () => {
    it('all 9 goods have prices', () => {
      const goods: string[] = [
        'RAW_FOOD', 'PROCESSED_FOOD', 'FRESH_WATER', 'ENERGY',
        'MATERIALS', 'BUILDING_MATERIALS', 'INDUSTRIAL_MACHINERY',
        'ENTERTAINMENT', 'WASTE',
      ];
      for (const g of goods) {
        expect(GOOD_BASE_PRICES[g as keyof typeof GOOD_BASE_PRICES]).toBeGreaterThan(0);
      }
    });
  });

  describe('DISTRICT_MODIFIERS', () => {
    it('all 12 districts have modifiers', () => {
      expect(Object.keys(DISTRICT_MODIFIERS)).toHaveLength(12);
    });

    it('all modifiers are positive', () => {
      for (const mod of Object.values(DISTRICT_MODIFIERS)) {
        expect(mod).toBeGreaterThan(0);
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════
// E) LEDGER — Double-entry integrity
// ══════════════════════════════════════════════════════════════

describe('Ledger', () => {
  describe('validateLedgerEntry', () => {
    it('accepts valid entry', () => {
      expect(() =>
        validateLedgerEntry({
          fromAccount: 1,
          toAccount: 100,
          amountCents: 5000,
          entryType: 'job_pay',
        })
      ).not.toThrow();
    });

    it('rejects zero amount', () => {
      expect(() =>
        validateLedgerEntry({
          fromAccount: 1,
          toAccount: 100,
          amountCents: 0,
          entryType: 'job_pay',
        })
      ).toThrow(ValidationError);
    });

    it('rejects negative amount', () => {
      expect(() =>
        validateLedgerEntry({
          fromAccount: 1,
          toAccount: 100,
          amountCents: -500,
          entryType: 'job_pay',
        })
      ).toThrow(ValidationError);
    });

    it('rejects fractional amount', () => {
      expect(() =>
        validateLedgerEntry({
          fromAccount: 1,
          toAccount: 100,
          amountCents: 10.5,
          entryType: 'job_pay',
        })
      ).toThrow(ValidationError);
    });

    it('rejects self-transfer', () => {
      expect(() =>
        validateLedgerEntry({
          fromAccount: 100,
          toAccount: 100,
          amountCents: 5000,
          entryType: 'job_pay',
        })
      ).toThrow(ValidationError);
    });
  });

  describe('validateLedgerBalance', () => {
    it('accepts balanced entries', () => {
      const entries: LedgerEntry[] = [
        { fromAccount: 1, toAccount: 100, amountCents: 5000, entryType: 'job_pay' },
        { fromAccount: 100, toAccount: 4, amountCents: 1200, entryType: 'rent' },
      ];
      expect(() => validateLedgerBalance(entries)).not.toThrow();
    });

    it('rejects if any entry is invalid', () => {
      const entries: LedgerEntry[] = [
        { fromAccount: 1, toAccount: 100, amountCents: 5000, entryType: 'job_pay' },
        { fromAccount: 100, toAccount: 100, amountCents: 500, entryType: 'rent' }, // self!
      ];
      expect(() => validateLedgerBalance(entries)).toThrow(ValidationError);
    });
  });

  describe('createJobPayEntry', () => {
    it('creates entry from JOB_PAYROLL to player', () => {
      const entry = createJobPayEntry(100, 5000, 'action-123');
      expect(entry.fromAccount).toBe(1); // JOB_PAYROLL
      expect(entry.toAccount).toBe(100);
      expect(entry.amountCents).toBe(5000);
      expect(entry.entryType).toBe('job_pay');
      expect(entry.actionId).toBe('action-123');
    });

    it('created entry passes validation', () => {
      const entry = createJobPayEntry(100, 5000);
      expect(() => validateLedgerEntry(entry)).not.toThrow();
    });
  });

  describe('createRentEntry', () => {
    it('creates entry from player to BILL_PAYMENT_SINK', () => {
      const entry = createRentEntry(100, 3500);
      expect(entry.fromAccount).toBe(100);
      expect(entry.toAccount).toBe(4); // BILL_PAYMENT_SINK
      expect(entry.amountCents).toBe(3500);
      expect(entry.entryType).toBe('rent');
    });

    it('created entry passes validation', () => {
      const entry = createRentEntry(100, 3500);
      expect(() => validateLedgerEntry(entry)).not.toThrow();
    });
  });

  describe('createUtilitiesEntry', () => {
    it('creates entry from player to BILL_PAYMENT_SINK', () => {
      const entry = createUtilitiesEntry(100, 800);
      expect(entry.fromAccount).toBe(100);
      expect(entry.toAccount).toBe(4);
      expect(entry.amountCents).toBe(800);
      expect(entry.entryType).toBe('utilities');
    });
  });

  describe('createPurchaseEntry', () => {
    it('creates entry from player to NPC_VENDOR', () => {
      const entry = createPurchaseEntry(100, 500, 'PROCESSED_FOOD');
      expect(entry.fromAccount).toBe(100);
      expect(entry.toAccount).toBe(5);
      expect(entry.amountCents).toBe(500);
      expect(entry.entryType).toBe('purchase');
    });
  });

  describe('ledger entries always balanced per action', () => {
    it('job pay: single entry, from system source to player (money creation)', () => {
      const entry = createJobPayEntry(100, 12000, 'job-1');
      validateLedgerEntry(entry);
      expect(entry.amountCents).toBeGreaterThan(0);
      expect(entry.fromAccount).not.toBe(entry.toAccount);
    });

    it('rent + utilities: paired entries from player to sink', () => {
      const rent = createRentEntry(100, 3500, 'daily-tick-1');
      const utils = createUtilitiesEntry(100, 800, 'daily-tick-1');
      const entries = [rent, utils];
      validateLedgerBalance(entries);

      // Sum debited from player account
      const totalDebited = entries
        .filter((e) => e.fromAccount === 100)
        .reduce((sum, e) => sum + e.amountCents, 0);

      // Sum credited to sink
      const totalCredited = entries
        .filter((e) => e.toAccount === 4)
        .reduce((sum, e) => sum + e.amountCents, 0);

      expect(totalDebited).toBe(totalCredited);
      expect(totalDebited).toBe(4300);
    });
  });
});

// ══════════════════════════════════════════════════════════════
// Legacy compatibility
// ══════════════════════════════════════════════════════════════

describe('Legacy calculateJobPayout', () => {
  it('should calculate payout with full efficiency', () => {
    expect(calculateJobPayout(1500, 8, 1.0)).toBe(12000);
  });

  it('should reduce payout with lower efficiency', () => {
    expect(calculateJobPayout(1500, 8, 0.5)).toBe(6000);
  });

  it('should handle fractional hours', () => {
    expect(calculateJobPayout(1500, 0.5, 1.0)).toBe(750);
  });

  it('should always floor to integer cents', () => {
    expect(calculateJobPayout(1500, 1, 0.7)).toBe(1050);
    expect(Number.isInteger(calculateJobPayout(1500, 1, 0.33))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// Integration: full work-shift-to-pay pipeline
// ══════════════════════════════════════════════════════════════

describe('Work shift pipeline integration', () => {
  it('complete shift: performance -> pay -> vigor cost -> skill XP -> ledger', () => {
    const job = JOBS_CATALOG[0]; // factory_worker, physical
    const vigor = fullVigor;
    const skill = 1.0;

    // 1. Calculate performance
    const perf = calculatePerformance(job.family, skill, vigor);
    expect(perf).toBeCloseTo(1.0, 5);

    // 2. Calculate pay
    const pay = calculateShiftPay(job.baseWageDaily, perf, 'full');
    expect(pay).toBe(12000);
    expect(Number.isInteger(pay)).toBe(true);

    // 3. Get vigor cost
    const cost = getShiftVigorCost(job.family, 'full');
    expect(cost.pv).toBe(25);
    expect(cost.mv).toBe(8);

    // 4. Skill XP
    const xp = applyShiftSkillXP(job.family, skill, 'full');
    expect(xp.skill).toBe('labor');
    expect(xp.newValue).toBeGreaterThan(skill);

    // 5. Create ledger entry
    const ledger = createJobPayEntry(100, pay, 'work-action-1');
    validateLedgerEntry(ledger);
    expect(ledger.amountCents).toBe(12000);
    expect(ledger.fromAccount).toBe(1); // system source
    expect(ledger.toAccount).toBe(100); // player
  });

  it('low skill + low vigor = minimum pay floor', () => {
    const perf = calculatePerformance('physical', 0.1, lowVigor);
    const pay = calculateDailyPay(12000, perf);
    // Performance is very low, but pay is floored at 0.4 * baseWage
    expect(pay).toBeGreaterThanOrEqual(Math.floor(12000 * 0.4));
    expect(pay).toBeLessThanOrEqual(Math.floor(12000 * 1.5));
  });
});
