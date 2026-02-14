import {
  getLocalDate,
  getNextLocalMidnight,
  getPreviousLocalMidnight,
  shouldDailyReset,
  fullHoursElapsed,
  DEFAULT_TIMEZONE,
} from './time';
import { ValidationError } from './errors';

describe('Time Model', () => {
  // ── getLocalDate ──

  describe('getLocalDate', () => {
    it('returns correct date for Asia/Dubai (UTC+4)', () => {
      // 2024-03-15T22:00:00Z = 2024-03-16T02:00:00 Dubai time
      expect(getLocalDate(new Date('2024-03-15T22:00:00Z'), 'Asia/Dubai')).toBe('2024-03-16');
    });

    it('returns correct date when UTC and local are the same day', () => {
      // 2024-03-15T12:00:00Z = 2024-03-15T16:00:00 Dubai time
      expect(getLocalDate(new Date('2024-03-15T12:00:00Z'), 'Asia/Dubai')).toBe('2024-03-15');
    });

    it('handles string input', () => {
      expect(getLocalDate('2024-03-15T22:00:00Z', 'Asia/Dubai')).toBe('2024-03-16');
    });

    it('defaults to Asia/Dubai', () => {
      expect(getLocalDate(new Date('2024-03-15T22:00:00Z'))).toBe('2024-03-16');
    });

    it('handles America/New_York (DST-aware)', () => {
      // 2024-03-15T03:00:00Z = 2024-03-14T23:00:00 EST (before spring-forward, UTC-5)
      expect(getLocalDate(new Date('2024-03-15T03:00:00Z'), 'America/New_York')).toBe(
        '2024-03-14'
      );

      // 2024-07-15T03:00:00Z = 2024-07-14T23:00:00 EDT (summer, UTC-4)
      expect(getLocalDate(new Date('2024-07-15T03:00:00Z'), 'America/New_York')).toBe(
        '2024-07-14'
      );
    });
  });

  // ── getNextLocalMidnight ──

  describe('getNextLocalMidnight', () => {
    it('returns next midnight in Asia/Dubai', () => {
      // 2024-03-15T14:30:00Z = 2024-03-15T18:30:00 Dubai
      // Next midnight = 2024-03-16T00:00:00 Dubai = 2024-03-15T20:00:00Z
      const result = getNextLocalMidnight(new Date('2024-03-15T14:30:00Z'), 'Asia/Dubai');
      expect(result.toISOString()).toBe('2024-03-15T20:00:00.000Z');
    });

    it('at exactly midnight, returns next day midnight', () => {
      // 2024-03-15T20:00:00Z = 2024-03-16T00:00:00 Dubai (exactly midnight)
      // Next midnight = 2024-03-17T00:00:00 Dubai = 2024-03-16T20:00:00Z
      const result = getNextLocalMidnight(new Date('2024-03-15T20:00:00Z'), 'Asia/Dubai');
      expect(result.toISOString()).toBe('2024-03-16T20:00:00.000Z');
    });

    it('handles DST transition in America/New_York', () => {
      // 2024-03-10 is DST spring-forward day in US (2:00 AM -> 3:00 AM)
      // 2024-03-09T23:00:00 EST = 2024-03-10T04:00:00Z
      // Next midnight = 2024-03-10T00:00:00 EST... but that's DST day
      // After spring forward, 2024-03-11T00:00:00 EDT = 2024-03-11T04:00:00Z
      const result = getNextLocalMidnight(
        new Date('2024-03-10T06:00:00Z'), // 2024-03-10 01:00 EST
        'America/New_York'
      );
      // Next midnight = 2024-03-11 00:00 EDT = 2024-03-11T04:00:00Z
      expect(result.toISOString()).toBe('2024-03-11T04:00:00.000Z');
    });
  });

  // ── getPreviousLocalMidnight ──

  describe('getPreviousLocalMidnight', () => {
    it('returns start of today in Dubai', () => {
      // 2024-03-15T14:30:00Z = 2024-03-15T18:30:00 Dubai
      // Start of day = 2024-03-15T00:00:00 Dubai = 2024-03-14T20:00:00Z
      const result = getPreviousLocalMidnight(new Date('2024-03-15T14:30:00Z'), 'Asia/Dubai');
      expect(result.toISOString()).toBe('2024-03-14T20:00:00.000Z');
    });
  });

  // ── shouldDailyReset ──

  describe('shouldDailyReset', () => {
    it('returns true when lastDailyReset is null', () => {
      expect(shouldDailyReset(new Date('2024-03-15T12:00:00Z'), null, 'Asia/Dubai')).toBe(true);
    });

    it('returns true when local date has advanced', () => {
      // 2024-03-16T01:00:00 Dubai → local date = 2024-03-16
      expect(
        shouldDailyReset(new Date('2024-03-15T21:00:00Z'), '2024-03-15', 'Asia/Dubai')
      ).toBe(true);
    });

    it('returns false when still same local day', () => {
      // 2024-03-15T18:00:00 Dubai → local date = 2024-03-15
      expect(
        shouldDailyReset(new Date('2024-03-15T14:00:00Z'), '2024-03-15', 'Asia/Dubai')
      ).toBe(false);
    });
  });

  // ── fullHoursElapsed ──

  describe('fullHoursElapsed', () => {
    it('returns floor of hours difference', () => {
      const from = new Date('2024-03-15T10:00:00Z');
      const to = new Date('2024-03-15T13:45:00Z');
      expect(fullHoursElapsed(from, to)).toBe(3);
    });

    it('returns 0 for less than one hour', () => {
      const from = new Date('2024-03-15T10:00:00Z');
      const to = new Date('2024-03-15T10:59:59Z');
      expect(fullHoursElapsed(from, to)).toBe(0);
    });

    it('returns 0 if to is before from', () => {
      const from = new Date('2024-03-15T12:00:00Z');
      const to = new Date('2024-03-15T10:00:00Z');
      expect(fullHoursElapsed(from, to)).toBe(0);
    });

    it('handles string dates', () => {
      expect(fullHoursElapsed('2024-03-15T10:00:00Z', '2024-03-15T15:30:00Z')).toBe(5);
    });

    it('handles exact hour boundaries', () => {
      const from = new Date('2024-03-15T00:00:00Z');
      const to = new Date('2024-03-16T00:00:00Z');
      expect(fullHoursElapsed(from, to)).toBe(24);
    });
  });

  // ── Dubai-specific midnight regression ──

  describe('Asia/Dubai midnight regression', () => {
    it('midnight is always at 20:00Z (UTC+4, no DST)', () => {
      // Dubai has no DST — always UTC+4
      for (const month of ['01', '03', '06', '09', '11']) {
        const midnight = getNextLocalMidnight(
          new Date(`2024-${month}-15T12:00:00Z`),
          'Asia/Dubai'
        );
        // 2024-MM-15T16:00 Dubai -> next midnight = 2024-MM-15T20:00Z
        expect(midnight.toISOString()).toMatch(/T20:00:00\.000Z$/);
      }
    });
  });
});
