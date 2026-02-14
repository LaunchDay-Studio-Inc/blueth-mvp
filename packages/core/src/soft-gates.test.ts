import {
  calculateMvTradingSlippage,
  calculateMvTradeEfficiency,
  calculateSvServiceMultiplier,
  calculateCvFeeMultiplier,
  calculateCvAdminSpeedMultiplier,
  calculateSpvRegenMultiplier,
  computeSoftGates,
  SOFT_GATE_THRESHOLD,
} from './soft-gates';

// ════════════════════════════════════════════════════════════════
// Soft-Gating System Tests
// ════════════════════════════════════════════════════════════════

describe('Soft-Gating System', () => {
  // ── MV Trading Slippage ──────────────────────────────────────

  describe('calculateMvTradingSlippage', () => {
    it('returns 0 when mv >= threshold (50)', () => {
      expect(calculateMvTradingSlippage(50)).toBe(0);
      expect(calculateMvTradingSlippage(75)).toBe(0);
      expect(calculateMvTradingSlippage(100)).toBe(0);
    });

    it('returns 0.15 (max slippage) at mv = 0', () => {
      expect(calculateMvTradingSlippage(0)).toBe(0.15);
    });

    it('scales linearly between 0 and threshold', () => {
      // At mv = 25 (midpoint): (1 - 25/50) * 0.15 = 0.5 * 0.15 = 0.075
      expect(calculateMvTradingSlippage(25)).toBeCloseTo(0.075, 6);
    });

    it('handles fractional mv values', () => {
      const result = calculateMvTradingSlippage(10);
      // (1 - 10/50) * 0.15 = 0.8 * 0.15 = 0.12
      expect(result).toBeCloseTo(0.12, 6);
    });

    it('clamps to [0, 0.15] for negative inputs', () => {
      expect(calculateMvTradingSlippage(-10)).toBe(0.15);
    });

    it('never exceeds 0.15', () => {
      for (let mv = -100; mv <= 200; mv += 5) {
        const result = calculateMvTradingSlippage(mv);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(0.15);
      }
    });
  });

  // ── MV Trade Efficiency ──────────────────────────────────────

  describe('calculateMvTradeEfficiency', () => {
    it('returns 1.0 at mv >= threshold', () => {
      expect(calculateMvTradeEfficiency(50)).toBe(1.0);
      expect(calculateMvTradeEfficiency(100)).toBe(1.0);
    });

    it('returns 0.85 at mv = 0 (minimum efficiency)', () => {
      expect(calculateMvTradeEfficiency(0)).toBeCloseTo(0.85, 6);
    });

    it('is always 1 - slippage', () => {
      for (let mv = 0; mv <= 100; mv += 10) {
        const slippage = calculateMvTradingSlippage(mv);
        const efficiency = calculateMvTradeEfficiency(mv);
        expect(efficiency).toBeCloseTo(1 - slippage, 10);
      }
    });

    it('is always in [0.85, 1.0]', () => {
      for (let mv = -50; mv <= 200; mv += 5) {
        const result = calculateMvTradeEfficiency(mv);
        expect(result).toBeGreaterThanOrEqual(0.85);
        expect(result).toBeLessThanOrEqual(1.0);
      }
    });
  });

  // ── SV Service Multiplier ────────────────────────────────────

  describe('calculateSvServiceMultiplier', () => {
    it('returns 1.0 at sv >= threshold', () => {
      expect(calculateSvServiceMultiplier(50)).toBe(1.0);
      expect(calculateSvServiceMultiplier(100)).toBe(1.0);
    });

    it('returns 0.70 at sv = 0', () => {
      expect(calculateSvServiceMultiplier(0)).toBeCloseTo(0.70, 6);
    });

    it('scales linearly between 0.70 and 1.00', () => {
      // At sv = 25 (midpoint): 0.70 + (25/50) * 0.30 = 0.70 + 0.15 = 0.85
      expect(calculateSvServiceMultiplier(25)).toBeCloseTo(0.85, 6);
    });

    it('never goes below 0.70', () => {
      expect(calculateSvServiceMultiplier(-50)).toBeGreaterThanOrEqual(0.70);
    });

    it('is always in [0.70, 1.00]', () => {
      for (let sv = -50; sv <= 200; sv += 5) {
        const result = calculateSvServiceMultiplier(sv);
        expect(result).toBeGreaterThanOrEqual(0.70);
        expect(result).toBeLessThanOrEqual(1.0);
      }
    });
  });

  // ── CV Fee Multiplier ────────────────────────────────────────

  describe('calculateCvFeeMultiplier', () => {
    it('returns 1.0 at cv >= threshold (no surcharge)', () => {
      expect(calculateCvFeeMultiplier(50)).toBe(1.0);
      expect(calculateCvFeeMultiplier(100)).toBe(1.0);
    });

    it('returns 1.25 at cv = 0 (25% surcharge)', () => {
      expect(calculateCvFeeMultiplier(0)).toBeCloseTo(1.25, 6);
    });

    it('scales linearly between 1.0 and 1.25', () => {
      // At cv = 25: 1.0 + (1 - 25/50) * 0.25 = 1.0 + 0.125 = 1.125
      expect(calculateCvFeeMultiplier(25)).toBeCloseTo(1.125, 6);
    });

    it('never exceeds 1.25', () => {
      expect(calculateCvFeeMultiplier(-100)).toBeLessThanOrEqual(1.25);
    });

    it('is always in [1.00, 1.25]', () => {
      for (let cv = -50; cv <= 200; cv += 5) {
        const result = calculateCvFeeMultiplier(cv);
        expect(result).toBeGreaterThanOrEqual(1.0);
        expect(result).toBeLessThanOrEqual(1.25);
      }
    });
  });

  // ── CV Admin Speed Multiplier ────────────────────────────────

  describe('calculateCvAdminSpeedMultiplier', () => {
    it('returns 1.0 at cv >= threshold (normal speed)', () => {
      expect(calculateCvAdminSpeedMultiplier(50)).toBe(1.0);
      expect(calculateCvAdminSpeedMultiplier(100)).toBe(1.0);
    });

    it('returns 1.5 at cv = 0 (50% slower)', () => {
      expect(calculateCvAdminSpeedMultiplier(0)).toBeCloseTo(1.5, 6);
    });

    it('scales linearly between 1.0 and 1.5', () => {
      // At cv = 25: 1.0 + (1 - 25/50) * 0.5 = 1.0 + 0.25 = 1.25
      expect(calculateCvAdminSpeedMultiplier(25)).toBeCloseTo(1.25, 6);
    });

    it('never exceeds 1.5', () => {
      expect(calculateCvAdminSpeedMultiplier(-100)).toBeLessThanOrEqual(1.5);
    });

    it('is always in [1.0, 1.5]', () => {
      for (let cv = -50; cv <= 200; cv += 5) {
        const result = calculateCvAdminSpeedMultiplier(cv);
        expect(result).toBeGreaterThanOrEqual(1.0);
        expect(result).toBeLessThanOrEqual(1.5);
      }
    });
  });

  // ── SpV Regen Multiplier ─────────────────────────────────────

  describe('calculateSpvRegenMultiplier', () => {
    it('returns 1.0 at spv >= threshold', () => {
      expect(calculateSpvRegenMultiplier(50)).toBe(1.0);
      expect(calculateSpvRegenMultiplier(100)).toBe(1.0);
    });

    it('returns 0.90 at spv = 0 (max penalty -10%)', () => {
      expect(calculateSpvRegenMultiplier(0)).toBeCloseTo(0.90, 6);
    });

    it('scales linearly between 0.90 and 1.00', () => {
      // At spv = 25: 0.90 + (25/50) * 0.10 = 0.90 + 0.05 = 0.95
      expect(calculateSpvRegenMultiplier(25)).toBeCloseTo(0.95, 6);
    });

    it('never goes below 0.90', () => {
      expect(calculateSpvRegenMultiplier(-100)).toBeGreaterThanOrEqual(0.90);
    });

    it('is always in [0.90, 1.00]', () => {
      for (let spv = -50; spv <= 200; spv += 5) {
        const result = calculateSpvRegenMultiplier(spv);
        expect(result).toBeGreaterThanOrEqual(0.90);
        expect(result).toBeLessThanOrEqual(1.0);
      }
    });
  });

  // ── Threshold constant ───────────────────────────────────────

  describe('SOFT_GATE_THRESHOLD', () => {
    it('is 50', () => {
      expect(SOFT_GATE_THRESHOLD).toBe(50);
    });
  });

  // ── computeSoftGates (integration) ───────────────────────────

  describe('computeSoftGates', () => {
    it('returns all-nominal values when all vigor >= 50', () => {
      const result = computeSoftGates({ pv: 100, mv: 100, sv: 100, cv: 100, spv: 100 });
      expect(result.mvSlippage).toBe(0);
      expect(result.svServiceMult).toBe(1.0);
      expect(result.cvFeeMult).toBe(1.0);
      expect(result.cvSpeedMult).toBe(1.0);
      expect(result.spvRegenMult).toBe(1.0);
    });

    it('returns all-worst values when all vigor = 0', () => {
      const result = computeSoftGates({ pv: 0, mv: 0, sv: 0, cv: 0, spv: 0 });
      expect(result.mvSlippage).toBeCloseTo(0.15, 6);
      expect(result.svServiceMult).toBeCloseTo(0.70, 6);
      expect(result.cvFeeMult).toBeCloseTo(1.25, 6);
      expect(result.cvSpeedMult).toBeCloseTo(1.5, 6);
      expect(result.spvRegenMult).toBeCloseTo(0.90, 6);
    });

    it('computes correctly from mixed vigor values', () => {
      const result = computeSoftGates({ pv: 80, mv: 25, sv: 50, cv: 10, spv: 0 });

      // mv=25: slippage = (1 - 25/50) * 0.15 = 0.075
      expect(result.mvSlippage).toBeCloseTo(0.075, 6);

      // sv=50: at threshold, service mult = 1.0
      expect(result.svServiceMult).toBe(1.0);

      // cv=10: fee = 1.0 + (1 - 10/50) * 0.25 = 1.0 + 0.20 = 1.20
      expect(result.cvFeeMult).toBeCloseTo(1.20, 6);

      // cv=10: speed = 1.0 + (1 - 10/50) * 0.5 = 1.0 + 0.40 = 1.40
      expect(result.cvSpeedMult).toBeCloseTo(1.40, 6);

      // spv=0: regen = 0.90
      expect(result.spvRegenMult).toBeCloseTo(0.90, 6);
    });

    it('pv has no direct soft-gate effect (handled by economy weights)', () => {
      const low = computeSoftGates({ pv: 0, mv: 50, sv: 50, cv: 50, spv: 50 });
      const high = computeSoftGates({ pv: 100, mv: 50, sv: 50, cv: 50, spv: 50 });
      // pv doesn't affect any soft-gate value
      expect(low).toEqual(high);
    });
  });
});
