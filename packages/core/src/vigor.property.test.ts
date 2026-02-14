import * as fc from 'fast-check';
import {
  addVigor,
  subVigor,
  applyHourlyVigorTick,
} from './vigor';
import type { VigorDimension, VigorCaps, VigorState, Buff } from './types';

// ── Arbitraries ─────────────────────────────────────────────

const dimKeys = ['pv', 'mv', 'sv', 'cv', 'spv'] as const;

const vigorDimArb: fc.Arbitrary<VigorDimension> = fc.record({
  pv: fc.double({ min: 0, max: 100, noNaN: true }),
  mv: fc.double({ min: 0, max: 100, noNaN: true }),
  sv: fc.double({ min: 0, max: 100, noNaN: true }),
  cv: fc.double({ min: 0, max: 100, noNaN: true }),
  spv: fc.double({ min: 0, max: 100, noNaN: true }),
});

const capsArb: fc.Arbitrary<VigorCaps> = fc.record({
  pv_cap: fc.integer({ min: 50, max: 150 }),
  mv_cap: fc.integer({ min: 50, max: 150 }),
  sv_cap: fc.integer({ min: 50, max: 150 }),
  cv_cap: fc.integer({ min: 50, max: 150 }),
  spv_cap: fc.integer({ min: 50, max: 150 }),
});

const partialDimArb: fc.Arbitrary<Partial<VigorDimension>> = fc.record({
  pv: fc.double({ min: 0, max: 200, noNaN: true }),
  mv: fc.double({ min: 0, max: 200, noNaN: true }),
  sv: fc.double({ min: 0, max: 200, noNaN: true }),
  cv: fc.double({ min: 0, max: 200, noNaN: true }),
  spv: fc.double({ min: 0, max: 200, noNaN: true }),
});

const defaultCaps: VigorCaps = { pv_cap: 100, mv_cap: 100, sv_cap: 100, cv_cap: 100, spv_cap: 100 };

// ── Property Tests ──────────────────────────────────────────

describe('Vigor Property Tests', () => {
  it('addVigor result is always in [0, cap]', () => {
    fc.assert(
      fc.property(vigorDimArb, partialDimArb, capsArb, (vigor, delta, caps) => {
        const { vigor: result } = addVigor(vigor, delta, caps);
        for (const key of dimKeys) {
          const capKey = `${key}_cap` as keyof VigorCaps;
          expect(result[key]).toBeGreaterThanOrEqual(0);
          expect(result[key]).toBeLessThanOrEqual(caps[capKey]);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('subVigor result is always in [0, cap]', () => {
    fc.assert(
      fc.property(vigorDimArb, partialDimArb, (vigor, cost) => {
        const { vigor: result } = subVigor(vigor, cost);
        for (const key of dimKeys) {
          expect(result[key]).toBeGreaterThanOrEqual(0);
          expect(result[key]).toBeLessThanOrEqual(100);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('applyHourlyVigorTick result is always in [0, cap]', () => {
    const sleepStates = ['awake', 'sleeping'] as const;
    const penaltyLevels = [0, 1, 2, 3];

    fc.assert(
      fc.property(
        vigorDimArb,
        fc.constantFrom(...sleepStates),
        fc.constantFrom(...penaltyLevels),
        (vigor, sleep, penalty) => {
          const state: VigorState = {
            vigor,
            caps: { ...defaultCaps },
            sleepState: sleep,
            activeBuffs: [],
            lastMealTimes: [],
            mealsEatenToday: 3,
            mealPenaltyLevel: penalty,
            lastDailyResetLocalDate: '2024-03-15',
          };
          const { newState } = applyHourlyVigorTick(
            state,
            '2024-03-15T10:00:00.000Z',
            'Asia/Dubai'
          );
          for (const key of dimKeys) {
            expect(newState.vigor[key]).toBeGreaterThanOrEqual(0);
            expect(newState.vigor[key]).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('random add/sub sequence: vigor bounds maintained throughout', () => {
    fc.assert(
      fc.property(
        vigorDimArb,
        fc.array(
          fc.tuple(fc.boolean(), partialDimArb),
          { minLength: 1, maxLength: 20 }
        ),
        (startVigor, ops) => {
          let vigor = { ...startVigor };
          for (const [isAdd, delta] of ops) {
            if (isAdd) {
              ({ vigor } = addVigor(vigor, delta));
            } else {
              ({ vigor } = subVigor(vigor, delta));
            }
            for (const key of dimKeys) {
              expect(vigor[key]).toBeGreaterThanOrEqual(0);
              expect(vigor[key]).toBeLessThanOrEqual(100);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
