import {
  GIGS_CATALOG,
  GIG_IDS,
  GIG_DURATION_SECONDS,
  GIG_DURATION_HOURS,
  GIG_DIMINISH_THRESHOLD,
  GIG_PAY_FLOOR,
  GIG_VIGOR_COSTS,
  gigPayMultiplier,
  calculateGigPay,
  getGigVigorCost,
  applyGigSkillXP,
  JOB_FAMILIES,
} from './economy';

// ══════════════════════════════════════════════════════════════
// GIG ECONOMY
// ══════════════════════════════════════════════════════════════

describe('Gig Catalog', () => {
  it('has exactly 4 gigs', () => {
    expect(GIGS_CATALOG).toHaveLength(4);
  });

  it('each gig maps to a valid job family', () => {
    for (const gig of GIGS_CATALOG) {
      expect(JOB_FAMILIES).toContain(gig.family);
    }
  });

  it('each gig has a positive baseWageDaily', () => {
    for (const gig of GIGS_CATALOG) {
      expect(gig.baseWageDaily).toBeGreaterThan(0);
    }
  });

  it('GIG_IDS matches catalog ids', () => {
    const catalogIds = GIGS_CATALOG.map((g) => g.id);
    expect([...GIG_IDS]).toEqual(catalogIds);
  });
});

describe('gigPayMultiplier', () => {
  it('returns 1.0 for gig counts 0 through 11', () => {
    for (let i = 0; i < GIG_DIMINISH_THRESHOLD; i++) {
      expect(gigPayMultiplier(i)).toBe(1.0);
    }
  });

  it('returns 1.0 at exactly the threshold (12th gig is the first at full pay)', () => {
    // gigsCompletedToday = 11 means this is the 12th gig, still full pay
    expect(gigPayMultiplier(11)).toBe(1.0);
  });

  it('decreases by 0.05 per gig over the threshold', () => {
    // gigsCompletedToday=12 → overage=0 → 1.0 (boundary: still full pay)
    expect(gigPayMultiplier(12)).toBeCloseTo(1.0, 10);
    // gigsCompletedToday=13 → overage=1 → 0.95
    expect(gigPayMultiplier(13)).toBeCloseTo(0.95, 10);
    expect(gigPayMultiplier(14)).toBeCloseTo(0.90, 10);
    expect(gigPayMultiplier(15)).toBeCloseTo(0.85, 10);
  });

  it('never goes below the pay floor (0.70)', () => {
    expect(gigPayMultiplier(20)).toBe(GIG_PAY_FLOOR);
    expect(gigPayMultiplier(50)).toBe(GIG_PAY_FLOOR);
    expect(gigPayMultiplier(100)).toBe(GIG_PAY_FLOOR);
  });

  it('hits exactly the floor at 18 gigs (6 over threshold)', () => {
    // 1.0 - 6 * 0.05 = 0.70
    expect(gigPayMultiplier(18)).toBeCloseTo(0.70, 10);
  });
});

describe('calculateGigPay', () => {
  const testBase = 13800; // courier_run baseWageDaily

  it('returns correct pay at performance=1.0 with 0 gigs today', () => {
    const expected = Math.round(testBase * 1.0 * (GIG_DURATION_HOURS / 8));
    expect(calculateGigPay(testBase, 1.0, 0)).toBe(expected);
  });

  it('clamps performance to minimum 0.4', () => {
    const expected = Math.round(testBase * 0.4 * (GIG_DURATION_HOURS / 8));
    expect(calculateGigPay(testBase, 0.1, 0)).toBe(expected);
    expect(calculateGigPay(testBase, -5, 0)).toBe(expected);
  });

  it('clamps performance to maximum 1.5', () => {
    const expected = Math.round(testBase * 1.5 * (GIG_DURATION_HOURS / 8));
    expect(calculateGigPay(testBase, 3.0, 0)).toBe(expected);
    expect(calculateGigPay(testBase, 100, 0)).toBe(expected);
  });

  it('applies diminishing returns multiplier', () => {
    const basePay = calculateGigPay(testBase, 1.0, 0);
    const diminished = calculateGigPay(testBase, 1.0, 13);
    // 13 gigs today = 0.95 multiplier (1 over threshold)
    expect(diminished).toBeLessThan(basePay);
    // Allow ±1 cent for rounding differences
    const expectedApprox = basePay * 0.95;
    expect(Math.abs(diminished - expectedApprox)).toBeLessThanOrEqual(1);
  });

  it('returns integer cents', () => {
    for (const gig of GIGS_CATALOG) {
      const pay = calculateGigPay(gig.baseWageDaily, 0.73, 5);
      expect(Number.isInteger(pay)).toBe(true);
    }
  });
});

describe('getGigVigorCost', () => {
  it('returns a copy for each job family', () => {
    for (const family of JOB_FAMILIES) {
      const cost = getGigVigorCost(family);
      expect(cost).toEqual(GIG_VIGOR_COSTS[family]);
      // Verify it's a copy, not a reference
      cost.pv = 999;
      expect(GIG_VIGOR_COSTS[family].pv).not.toBe(999);
    }
  });
});

describe('applyGigSkillXP', () => {
  it('returns the correct primary skill for each family', () => {
    expect(applyGigSkillXP('physical', 0.1).skill).toBe('labor');
    expect(applyGigSkillXP('admin', 0.1).skill).toBe('admin');
    expect(applyGigSkillXP('service', 0.1).skill).toBe('service');
    expect(applyGigSkillXP('management', 0.1).skill).toBe('management');
  });

  it('increases skill value', () => {
    const result = applyGigSkillXP('physical', 0.1);
    expect(result.newValue).toBeGreaterThan(0.1);
  });

  it('gives less XP than a short shift (10 min vs 120 min)', () => {
    // A gig is 10 minutes vs a short shift at 120 minutes
    // So gig XP should be much smaller
    const gigXP = applyGigSkillXP('physical', 0.5);
    // Short shift XP: addSkillXP(0.5, 120, 1.0)
    // Gig XP: addSkillXP(0.5, 10, 1.0)
    expect(gigXP.newValue - 0.5).toBeLessThan(0.01);
  });
});

describe('GIG_DURATION constants', () => {
  it('GIG_DURATION_SECONDS is 600', () => {
    expect(GIG_DURATION_SECONDS).toBe(600);
  });

  it('GIG_DURATION_HOURS is 10/60', () => {
    expect(GIG_DURATION_HOURS).toBeCloseTo(10 / 60, 10);
  });
});
