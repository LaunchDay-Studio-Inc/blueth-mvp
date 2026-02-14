import { calculateMarketPrice, calculateJobPayout } from './economy';

describe('Economy System', () => {
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
      // 1000 * (75/100) = 750.0 — should be integer
      expect(Number.isInteger(calculateMarketPrice(1000, 100, 75))).toBe(true);
      // 999 * max(0.5, 3/7) = 999 * 0.5 = 499.5 → floor = 499
      expect(calculateMarketPrice(999, 7, 3)).toBe(499);
    });
  });

  describe('calculateJobPayout', () => {
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
      // 1500 * 1 * 0.7 = 1050.0
      expect(calculateJobPayout(1500, 1, 0.7)).toBe(1050);
      // 1500 * 1 * 0.33 = 495.0
      expect(Number.isInteger(calculateJobPayout(1500, 1, 0.33))).toBe(true);
    });
  });
});
