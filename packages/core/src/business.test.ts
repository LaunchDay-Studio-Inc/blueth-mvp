/**
 * Business Domain Logic — Unit Tests
 *
 * Tests for packages/core/src/business.ts
 */

import {
  updateWorkerSatisfaction,
  clampSatisfaction,
  calculateEffectiveLabor,
  hasEnoughLabor,
  applyMachineryDepreciation,
  calculateWasteDisposalFee,
  calculateLocationRent,
  SATISFACTION_MIN,
  SATISFACTION_MAX,
  SATISFACTION_DEFAULT,
  BUSINESS_REGISTRATION_FEE_CENTS,
  BUSINESS_BASE_RENT_CENTS,
  WASTE_DISPOSAL_FEE_PER_UNIT_CENTS,
  MARKET_AVERAGE_WAGE_CENTS,
  BUSINESS_VIGOR_COSTS,
} from './business';

// ── clampSatisfaction ────────────────────────────────────────

describe('clampSatisfaction', () => {
  it('returns 0 for negative values', () => {
    expect(clampSatisfaction(-0.5)).toBe(0);
  });

  it('returns 1.3 for values above max', () => {
    expect(clampSatisfaction(2.0)).toBe(1.3);
  });

  it('returns the value when in range', () => {
    expect(clampSatisfaction(0.8)).toBe(0.8);
    expect(clampSatisfaction(1.0)).toBe(1.0);
    expect(clampSatisfaction(1.3)).toBe(1.3);
    expect(clampSatisfaction(0)).toBe(0);
  });
});

// ── updateWorkerSatisfaction ─────────────────────────────────

describe('updateWorkerSatisfaction', () => {
  it('stays at 1.0 with average wage and 8h', () => {
    const result = updateWorkerSatisfaction(1.0, MARKET_AVERAGE_WAGE_CENTS, MARKET_AVERAGE_WAGE_CENTS, 8);
    // Mean reversion toward 1.0 from 1.0 = 0, wage ratio = 1.0, hours = 8 (base)
    // All deltas should be 0 or near 0
    expect(result).toBeCloseTo(1.0, 2);
  });

  it('increases with above-average wage', () => {
    const result = updateWorkerSatisfaction(
      1.0,
      MARKET_AVERAGE_WAGE_CENTS * 1.5, // 50% above average
      MARKET_AVERAGE_WAGE_CENTS,
      8,
    );
    expect(result).toBeGreaterThan(1.0);
  });

  it('decreases with below-average wage', () => {
    const result = updateWorkerSatisfaction(
      1.0,
      MARKET_AVERAGE_WAGE_CENTS * 0.5, // 50% below average
      MARKET_AVERAGE_WAGE_CENTS,
      8,
    );
    expect(result).toBeLessThan(1.0);
  });

  it('decreases with long hours (above 8)', () => {
    const result = updateWorkerSatisfaction(1.0, MARKET_AVERAGE_WAGE_CENTS, MARKET_AVERAGE_WAGE_CENTS, 12);
    expect(result).toBeLessThan(1.0);
  });

  it('increases with short hours (below 8)', () => {
    const result = updateWorkerSatisfaction(1.0, MARKET_AVERAGE_WAGE_CENTS, MARKET_AVERAGE_WAGE_CENTS, 4);
    expect(result).toBeGreaterThan(1.0);
  });

  it('is bounded to [0, 1.3]', () => {
    // Very low wage + long hours from already low satisfaction
    const lowResult = updateWorkerSatisfaction(0, 0, MARKET_AVERAGE_WAGE_CENTS, 24);
    expect(lowResult).toBeGreaterThanOrEqual(SATISFACTION_MIN);

    // Very high wage + short hours from already high satisfaction
    const highResult = updateWorkerSatisfaction(1.3, MARKET_AVERAGE_WAGE_CENTS * 3, MARKET_AVERAGE_WAGE_CENTS, 1);
    expect(highResult).toBeLessThanOrEqual(SATISFACTION_MAX);
  });

  it('has mean reversion toward 1.0', () => {
    // Starting from 0.5, should drift up even with neutral inputs
    const result = updateWorkerSatisfaction(0.5, MARKET_AVERAGE_WAGE_CENTS, MARKET_AVERAGE_WAGE_CENTS, 8);
    expect(result).toBeGreaterThan(0.5);

    // Starting from 1.2, should drift down even with neutral inputs
    const result2 = updateWorkerSatisfaction(1.2, MARKET_AVERAGE_WAGE_CENTS, MARKET_AVERAGE_WAGE_CENTS, 8);
    expect(result2).toBeLessThan(1.2);
  });
});

// ── calculateEffectiveLabor ─────────────────────────────────

describe('calculateEffectiveLabor', () => {
  it('returns 0 for empty workers array', () => {
    expect(calculateEffectiveLabor([])).toBe(0);
  });

  it('multiplies hours by satisfaction', () => {
    const workers = [
      { hoursPerDay: 8, satisfaction: 1.0 },
      { hoursPerDay: 8, satisfaction: 1.0 },
    ];
    expect(calculateEffectiveLabor(workers)).toBe(16);
  });

  it('scales with satisfaction', () => {
    const workers = [
      { hoursPerDay: 8, satisfaction: 0.5 },
    ];
    expect(calculateEffectiveLabor(workers)).toBe(4);
  });

  it('clamps satisfaction for calculation', () => {
    const workers = [
      { hoursPerDay: 8, satisfaction: 2.0 }, // above max, clamped to 1.3
    ];
    expect(calculateEffectiveLabor(workers)).toBeCloseTo(10.4);
  });
});

// ── hasEnoughLabor ───────────────────────────────────────────

describe('hasEnoughLabor', () => {
  it('returns true when effective >= required', () => {
    expect(hasEnoughLabor(10, 8)).toBe(true);
    expect(hasEnoughLabor(8, 8)).toBe(true);
  });

  it('returns false when effective < required', () => {
    expect(hasEnoughLabor(6, 8)).toBe(false);
  });
});

// ── applyMachineryDepreciation ───────────────────────────────

describe('applyMachineryDepreciation', () => {
  it('reduces machinery by depreciation amount', () => {
    expect(applyMachineryDepreciation(1.0, 0.01)).toBeCloseTo(0.99);
  });

  it('does not go below zero', () => {
    expect(applyMachineryDepreciation(0.005, 0.01)).toBe(0);
    expect(applyMachineryDepreciation(0, 0.02)).toBe(0);
  });
});

// ── calculateWasteDisposalFee ────────────────────────────────

describe('calculateWasteDisposalFee', () => {
  it('calculates fee correctly', () => {
    expect(calculateWasteDisposalFee(1)).toBe(WASTE_DISPOSAL_FEE_PER_UNIT_CENTS);
    expect(calculateWasteDisposalFee(5)).toBe(5 * WASTE_DISPOSAL_FEE_PER_UNIT_CENTS);
  });

  it('returns 0 for 0 waste', () => {
    expect(calculateWasteDisposalFee(0)).toBe(0);
  });
});

// ── calculateLocationRent ────────────────────────────────────

describe('calculateLocationRent', () => {
  it('multiplies base rent by district modifier', () => {
    expect(calculateLocationRent(1.0)).toBe(BUSINESS_BASE_RENT_CENTS);
    expect(calculateLocationRent(1.5)).toBe(Math.floor(BUSINESS_BASE_RENT_CENTS * 1.5));
    expect(calculateLocationRent(0.8)).toBe(Math.floor(BUSINESS_BASE_RENT_CENTS * 0.8));
  });
});

// ── Constants ────────────────────────────────────────────────

describe('Business constants', () => {
  it('has correct satisfaction bounds', () => {
    expect(SATISFACTION_MIN).toBe(0);
    expect(SATISFACTION_MAX).toBe(1.3);
    expect(SATISFACTION_DEFAULT).toBe(1.0);
  });

  it('registration fee is positive', () => {
    expect(BUSINESS_REGISTRATION_FEE_CENTS).toBeGreaterThan(0);
  });

  it('vigor costs are defined', () => {
    expect(BUSINESS_VIGOR_COSTS.PLAN_PRODUCTION).toEqual({ mv: 6, cv: 2 });
    expect(BUSINESS_VIGOR_COSTS.HIRE_SESSION).toEqual({ sv: 6, mv: 4 });
    expect(BUSINESS_VIGOR_COSTS.COMPLIANCE_ADMIN).toEqual({ cv: 6, mv: 2 });
  });
});
