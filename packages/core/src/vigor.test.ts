import { applyVigorRegen, depleteVigor, calculateEfficiency, canAffordVigorCost } from './vigor';

describe('Vigor System', () => {
  describe('applyVigorRegen', () => {
    it('should regenerate vigor by 5 points per hour per dimension', () => {
      const current = { physical: 50, mental: 40, social: 30, creative: 20, spiritual: 10 };
      const result = applyVigorRegen(current, 1);

      expect(result.vigor).toEqual({
        physical: 55,
        mental: 45,
        social: 35,
        creative: 25,
        spiritual: 15,
      });
    });

    it('should cap vigor at 100', () => {
      const current = { physical: 98, mental: 97, social: 96, creative: 95, spiritual: 94 };
      const result = applyVigorRegen(current, 2);

      expect(result.vigor).toEqual({
        physical: 100,
        mental: 100,
        social: 100,
        creative: 100,
        spiritual: 100,
      });
    });

    it('should handle multiple hours of regeneration', () => {
      const current = { physical: 0, mental: 0, social: 0, creative: 0, spiritual: 0 };
      const result = applyVigorRegen(current, 5);

      expect(result.vigor).toEqual({
        physical: 25,
        mental: 25,
        social: 25,
        creative: 25,
        spiritual: 25,
      });
    });
  });

  describe('depleteVigor', () => {
    it('should deplete specified vigor dimensions', () => {
      const current = { physical: 50, mental: 50, social: 50, creative: 50, spiritual: 50 };
      const cost = { physical: 10, mental: 20 };
      const result = depleteVigor(current, cost);

      expect(result).toEqual({
        physical: 40,
        mental: 30,
        social: 50,
        creative: 50,
        spiritual: 50,
      });
    });

    it('should not go below 0', () => {
      const current = { physical: 5, mental: 5, social: 5, creative: 5, spiritual: 5 };
      const cost = { physical: 10, mental: 10 };
      const result = depleteVigor(current, cost);

      expect(result.physical).toBe(0);
      expect(result.mental).toBe(0);
    });
  });

  describe('calculateEfficiency', () => {
    it('should return 1.0 when all vigor dimensions are healthy', () => {
      const vigor = { physical: 50, mental: 50, social: 50, creative: 50, spiritual: 50 };
      expect(calculateEfficiency(vigor)).toBe(1.0);
    });

    it('should reduce efficiency when dimensions fall below threshold', () => {
      const vigor = { physical: 15, mental: 50, social: 50, creative: 50, spiritual: 50 };
      expect(calculateEfficiency(vigor)).toBe(0.9);
    });

    it('should have minimum efficiency of 0.5', () => {
      const vigor = { physical: 0, mental: 0, social: 0, creative: 0, spiritual: 0 };
      expect(calculateEfficiency(vigor)).toBe(0.5);
    });
  });

  describe('canAffordVigorCost', () => {
    it('should return true when player can afford the cost', () => {
      const vigor = { physical: 50, mental: 50, social: 50, creative: 50, spiritual: 50 };
      const cost = { physical: 10, mental: 20 };
      expect(canAffordVigorCost(vigor, cost)).toBe(true);
    });

    it('should return false when player cannot afford the cost', () => {
      const vigor = { physical: 5, mental: 50, social: 50, creative: 50, spiritual: 50 };
      const cost = { physical: 10 };
      expect(canAffordVigorCost(vigor, cost)).toBe(false);
    });
  });
});
