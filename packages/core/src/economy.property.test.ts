import * as fc from 'fast-check';
import {
  calculateDailyPay,
  validateLedgerEntry,
  createJobPayEntry,
  createRentEntry,
  createUtilitiesEntry,
  createPurchaseEntry,
  processRent,
} from './economy';

// ── Property Tests ──────────────────────────────────────────

describe('Economy Property Tests', () => {
  it('calculateDailyPay never returns negative for any (baseWage, performance)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.double({ min: -10, max: 10, noNaN: true }),
        (baseWage, perf) => {
          const pay = calculateDailyPay(baseWage, perf);
          expect(pay).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('calculateDailyPay always returns integer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        (baseWage, perf) => {
          expect(Number.isInteger(calculateDailyPay(baseWage, perf))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ledger factory functions always produce valid entries', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 10000 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (accountId, amount) => {
          // Job pay: from system (1) to player
          expect(() => validateLedgerEntry(createJobPayEntry(accountId, amount))).not.toThrow();

          // Rent: from player to sink (4)
          expect(() => validateLedgerEntry(createRentEntry(accountId, amount))).not.toThrow();

          // Utilities: from player to sink (4)
          expect(() => validateLedgerEntry(createUtilitiesEntry(accountId, amount))).not.toThrow();

          // Purchase: from player to NPC vendor (5)
          expect(() => validateLedgerEntry(createPurchaseEntry(accountId, amount, 'RAW_FOOD'))).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('processRent never produces negative amountChargedCents', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        (tier, wallet) => {
          const result = processRent(tier, wallet);
          expect(result.amountChargedCents).toBeGreaterThanOrEqual(0);
          expect(result.amountChargedCents).toBeLessThanOrEqual(wallet);
          expect(result.newTier).toBeGreaterThanOrEqual(0);
          expect(result.newTier).toBeLessThanOrEqual(tier);
        }
      ),
      { numRuns: 100 }
    );
  });
});
