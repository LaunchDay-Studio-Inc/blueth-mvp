import { applyVigorRegen, depleteVigor, calculateEfficiency, canAffordVigorCost } from './vigor';

describe('Vigor System', () => {
  describe('applyVigorRegen', () => {
    it('should regenerate vigor by 5 points per hour per dimension', () => {
      const current = { pv: 50, mv: 40, sv: 30, cv: 20, spv: 10 };
      const result = applyVigorRegen(current, 1);

      expect(result.vigor).toEqual({ pv: 55, mv: 45, sv: 35, cv: 25, spv: 15 });
    });

    it('should cap vigor at default cap (100)', () => {
      const current = { pv: 98, mv: 97, sv: 96, cv: 95, spv: 94 };
      const result = applyVigorRegen(current, 2);

      expect(result.vigor).toEqual({ pv: 100, mv: 100, sv: 100, cv: 100, spv: 100 });
    });

    it('should respect custom caps', () => {
      const current = { pv: 50, mv: 50, sv: 50, cv: 50, spv: 50 };
      const caps = { pv_cap: 60, mv_cap: 55, sv_cap: 100, cv_cap: 100, spv_cap: 100 };
      const result = applyVigorRegen(current, 4); // +20 regen
      const resultCapped = applyVigorRegen(current, 4, caps);

      expect(result.vigor.pv).toBe(70);
      expect(resultCapped.vigor.pv).toBe(60); // capped at 60
      expect(resultCapped.vigor.mv).toBe(55); // capped at 55
    });

    it('should handle multiple hours of regeneration', () => {
      const current = { pv: 0, mv: 0, sv: 0, cv: 0, spv: 0 };
      const result = applyVigorRegen(current, 5);

      expect(result.vigor).toEqual({ pv: 25, mv: 25, sv: 25, cv: 25, spv: 25 });
    });

    it('should report correct regenApplied amounts', () => {
      const current = { pv: 98, mv: 50, sv: 0, cv: 100, spv: 10 };
      const result = applyVigorRegen(current, 1);

      expect(result.regenApplied.pv).toBe(2);   // capped at 100
      expect(result.regenApplied.mv).toBe(5);
      expect(result.regenApplied.sv).toBe(5);
      expect(result.regenApplied.cv).toBe(0);   // already at cap
      expect(result.regenApplied.spv).toBe(5);
    });
  });

  describe('depleteVigor', () => {
    it('should deplete specified vigor dimensions', () => {
      const current = { pv: 50, mv: 50, sv: 50, cv: 50, spv: 50 };
      const cost = { pv: 10, mv: 20 };
      const result = depleteVigor(current, cost);

      expect(result).toEqual({ pv: 40, mv: 30, sv: 50, cv: 50, spv: 50 });
    });

    it('should not go below 0', () => {
      const current = { pv: 5, mv: 5, sv: 5, cv: 5, spv: 5 };
      const cost = { pv: 10, mv: 10 };
      const result = depleteVigor(current, cost);

      expect(result.pv).toBe(0);
      expect(result.mv).toBe(0);
      expect(result.sv).toBe(5); // untouched
    });
  });

  describe('calculateEfficiency', () => {
    it('should return 1.0 when all vigor dimensions are healthy', () => {
      const vigor = { pv: 50, mv: 50, sv: 50, cv: 50, spv: 50 };
      expect(calculateEfficiency(vigor)).toBe(1.0);
    });

    it('should reduce efficiency when one dimension falls below threshold', () => {
      const vigor = { pv: 15, mv: 50, sv: 50, cv: 50, spv: 50 };
      expect(calculateEfficiency(vigor)).toBe(0.9);
    });

    it('should reduce efficiency further with more dimensions below threshold', () => {
      const vigor = { pv: 10, mv: 10, sv: 50, cv: 50, spv: 50 };
      expect(calculateEfficiency(vigor)).toBe(0.8);
    });

    it('should have minimum efficiency of 0.5', () => {
      const vigor = { pv: 0, mv: 0, sv: 0, cv: 0, spv: 0 };
      expect(calculateEfficiency(vigor)).toBe(0.5);
    });
  });

  describe('canAffordVigorCost', () => {
    it('should return true when player can afford the cost', () => {
      const vigor = { pv: 50, mv: 50, sv: 50, cv: 50, spv: 50 };
      const cost = { pv: 10, mv: 20 };
      expect(canAffordVigorCost(vigor, cost)).toBe(true);
    });

    it('should return false when player cannot afford the cost', () => {
      const vigor = { pv: 5, mv: 50, sv: 50, cv: 50, spv: 50 };
      const cost = { pv: 10 };
      expect(canAffordVigorCost(vigor, cost)).toBe(false);
    });

    it('should return true when cost dimensions are omitted (cost = 0)', () => {
      const vigor = { pv: 0, mv: 0, sv: 0, cv: 0, spv: 0 };
      const cost = {}; // no cost
      expect(canAffordVigorCost(vigor, cost)).toBe(true);
    });
  });
});
