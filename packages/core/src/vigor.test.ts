import {
  addVigor,
  subVigor,
  applyVigorRegen,
  depleteVigor,
  calculateEfficiency,
  canAffordVigorCost,
  assertVigorCost,
  HOURLY_REGEN_RATE,
} from './vigor';
import { InsufficientVigorError } from './errors';
import type { VigorDimension, VigorCaps } from './types';

const full: VigorDimension = { pv: 100, mv: 100, sv: 100, cv: 100, spv: 100 };
const half: VigorDimension = { pv: 50, mv: 50, sv: 50, cv: 50, spv: 50 };
const zero: VigorDimension = { pv: 0, mv: 0, sv: 0, cv: 0, spv: 0 };
const mixed: VigorDimension = { pv: 80, mv: 30, sv: 60, cv: 10, spv: 45 };

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
    it('regenerates 5 points per hour per dimension', () => {
      const { vigor } = applyVigorRegen(half, 1);
      expect(vigor.pv).toBe(55);
      expect(vigor.mv).toBe(55);
    });

    it('caps at 100 by default', () => {
      const { vigor } = applyVigorRegen({ ...half, pv: 98 }, 2);
      expect(vigor.pv).toBe(100);
    });

    it('respects custom caps', () => {
      const caps: VigorCaps = { pv_cap: 60, mv_cap: 55, sv_cap: 100, cv_cap: 100, spv_cap: 100 };
      const { vigor } = applyVigorRegen(half, 4, caps); // +20
      expect(vigor.pv).toBe(60);
      expect(vigor.mv).toBe(55);
      expect(vigor.sv).toBe(70);
    });

    it('multi-hour regen from zero', () => {
      const { vigor } = applyVigorRegen(zero, 5);
      expect(vigor.pv).toBe(25);
    });

    it('audit shows correct regen amounts', () => {
      const { audit } = applyVigorRegen({ ...half, cv: 100 }, 1);
      // cv is already at cap, should not appear in audit
      expect(audit.find((a) => a.dimension === 'cv')).toBeUndefined();
      expect(audit.find((a) => a.dimension === 'pv')?.delta).toBe(5);
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
