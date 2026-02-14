import {
  assertCents,
  assertNonNegativeCents,
  addMoney,
  subMoney,
  clampNonNegative,
  assertSufficientFunds,
  formatBlueth,
  parseBlueth,
} from './money';
import { ValidationError, InsufficientFundsError } from './errors';

describe('Money Model', () => {
  // ── assertCents ──

  describe('assertCents', () => {
    it('accepts valid integers', () => {
      expect(() => assertCents(0)).not.toThrow();
      expect(() => assertCents(100)).not.toThrow();
      expect(() => assertCents(-500)).not.toThrow();
      expect(() => assertCents(999999999)).not.toThrow();
    });

    it('rejects fractional numbers', () => {
      expect(() => assertCents(1.5)).toThrow(ValidationError);
      expect(() => assertCents(0.01)).toThrow(ValidationError);
      expect(() => assertCents(99.99)).toThrow(ValidationError);
    });

    it('rejects NaN and Infinity', () => {
      expect(() => assertCents(NaN)).toThrow(ValidationError);
      expect(() => assertCents(Infinity)).toThrow(ValidationError);
      expect(() => assertCents(-Infinity)).toThrow(ValidationError);
    });
  });

  // ── assertNonNegativeCents ──

  describe('assertNonNegativeCents', () => {
    it('accepts zero and positive', () => {
      expect(() => assertNonNegativeCents(0)).not.toThrow();
      expect(() => assertNonNegativeCents(1)).not.toThrow();
    });

    it('rejects negative', () => {
      expect(() => assertNonNegativeCents(-1)).toThrow(ValidationError);
    });

    it('rejects fractional', () => {
      expect(() => assertNonNegativeCents(0.5)).toThrow(ValidationError);
    });
  });

  // ── addMoney ──

  describe('addMoney', () => {
    it('adds two integer amounts', () => {
      expect(addMoney(100, 200)).toBe(300);
      expect(addMoney(0, 0)).toBe(0);
      expect(addMoney(-100, 50)).toBe(-50);
    });

    it('never produces fractional results', () => {
      const result = addMoney(333, 666);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('rejects fractional inputs', () => {
      expect(() => addMoney(1.5, 100)).toThrow(ValidationError);
      expect(() => addMoney(100, 0.01)).toThrow(ValidationError);
    });
  });

  // ── subMoney ──

  describe('subMoney', () => {
    it('subtracts two integer amounts', () => {
      expect(subMoney(500, 200)).toBe(300);
      expect(subMoney(100, 100)).toBe(0);
    });

    it('can produce negative results (caller must enforce if needed)', () => {
      expect(subMoney(50, 200)).toBe(-150);
    });

    it('never produces fractional results', () => {
      const result = subMoney(1001, 333);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('rejects fractional inputs', () => {
      expect(() => subMoney(1.5, 100)).toThrow(ValidationError);
    });
  });

  // ── clampNonNegative ──

  describe('clampNonNegative', () => {
    it('returns value if non-negative', () => {
      expect(clampNonNegative(100)).toBe(100);
      expect(clampNonNegative(0)).toBe(0);
    });

    it('clamps negative to 0', () => {
      expect(clampNonNegative(-500)).toBe(0);
    });

    it('rejects fractional inputs', () => {
      expect(() => clampNonNegative(1.5)).toThrow(ValidationError);
    });
  });

  // ── assertSufficientFunds ──

  describe('assertSufficientFunds', () => {
    it('passes when available >= required', () => {
      expect(() => assertSufficientFunds(100, 200)).not.toThrow();
      expect(() => assertSufficientFunds(100, 100)).not.toThrow();
      expect(() => assertSufficientFunds(0, 0)).not.toThrow();
    });

    it('throws InsufficientFundsError when available < required', () => {
      expect(() => assertSufficientFunds(200, 100)).toThrow(InsufficientFundsError);
    });

    it('populates required and available on the error', () => {
      try {
        assertSufficientFunds(1000, 500);
        fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(InsufficientFundsError);
        const err = e as InsufficientFundsError;
        expect(err.required).toBe(1000);
        expect(err.available).toBe(500);
        expect(err.code).toBe('INSUFFICIENT_FUNDS');
      }
    });
  });

  // ── formatBlueth ──

  describe('formatBlueth', () => {
    it('formats positive amounts', () => {
      expect(formatBlueth(12345)).toBe('₿123.45');
      expect(formatBlueth(100)).toBe('₿1.00');
      expect(formatBlueth(7)).toBe('₿0.07');
      expect(formatBlueth(0)).toBe('₿0.00');
      expect(formatBlueth(1)).toBe('₿0.01');
      expect(formatBlueth(10)).toBe('₿0.10');
    });

    it('formats negative amounts', () => {
      expect(formatBlueth(-500)).toBe('-₿5.00');
      expect(formatBlueth(-1)).toBe('-₿0.01');
    });

    it('rejects fractional input', () => {
      expect(() => formatBlueth(1.5)).toThrow(ValidationError);
    });
  });

  // ── parseBlueth ──

  describe('parseBlueth', () => {
    it('parses ₿ prefixed strings', () => {
      expect(parseBlueth('₿123.45')).toBe(12345);
      expect(parseBlueth('₿1.00')).toBe(100);
      expect(parseBlueth('₿0.07')).toBe(7);
      expect(parseBlueth('₿0.00')).toBe(0);
    });

    it('parses plain decimal strings', () => {
      expect(parseBlueth('123.45')).toBe(12345);
      expect(parseBlueth('0.07')).toBe(7);
    });

    it('parses whole numbers as whole BCE (100x cents)', () => {
      expect(parseBlueth('100')).toBe(10000);
      expect(parseBlueth('₿5')).toBe(500);
    });

    it('parses negative amounts', () => {
      expect(parseBlueth('-₿5.00')).toBe(-500);
    });

    it('handles single-digit fractional part by padding', () => {
      expect(parseBlueth('1.5')).toBe(150); // 1.5 -> 1.50 -> 150 cents
    });

    it('throws on invalid input', () => {
      expect(() => parseBlueth('abc')).toThrow(ValidationError);
      expect(() => parseBlueth('1.234')).toThrow(ValidationError); // >2 decimal places
      expect(() => parseBlueth('')).toThrow(ValidationError);
    });

    it('roundtrips with formatBlueth', () => {
      for (const cents of [0, 1, 7, 10, 99, 100, 12345, 999999]) {
        expect(parseBlueth(formatBlueth(cents))).toBe(cents);
      }
    });
  });

  // ── Property: money never becomes fractional ──

  describe('integer invariant', () => {
    it('addMoney always returns integer', () => {
      const values = [0, 1, 7, 99, 100, 12345, -500, -1];
      for (const a of values) {
        for (const b of values) {
          expect(Number.isInteger(addMoney(a, b))).toBe(true);
        }
      }
    });

    it('subMoney always returns integer', () => {
      const values = [0, 1, 7, 99, 100, 12345, -500, -1];
      for (const a of values) {
        for (const b of values) {
          expect(Number.isInteger(subMoney(a, b))).toBe(true);
        }
      }
    });
  });
});
