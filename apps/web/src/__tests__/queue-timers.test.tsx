import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { extractActionDeltas, formatDeltaSummary } from '@/lib/action-results';

/* ── Unit tests: extractActionDeltas ────────────── */

describe('extractActionDeltas', () => {
  it('extracts WORK_SHIFT pay and vigor cost', () => {
    const result = {
      payCents: 5000,
      vigorCost: { pv: 25, mv: 8 },
      vigorAfter: { pv: 50, mv: 42, sv: 50, cv: 50, spv: 50 },
    };
    const deltas = extractActionDeltas('WORK_SHIFT', result);
    expect(deltas.moneyCents).toBe(5000);
    expect(deltas.vigorDelta).toEqual({ pv: -25, mv: -8 });
  });

  it('extracts EAT_MEAL cost and optional vigor delta', () => {
    const result = {
      quality: 'STREET_FOOD',
      costCents: 500,
      buffsCreated: 1,
      instantDelta: null,
    };
    const deltas = extractActionDeltas('EAT_MEAL', result);
    expect(deltas.moneyCents).toBe(-500);
    expect(deltas.vigorDelta).toBeUndefined();
  });

  it('extracts EAT_MEAL with instant vigor delta', () => {
    const result = {
      quality: 'FINE_DINING',
      costCents: 2000,
      buffsCreated: 1,
      instantDelta: { sv: 2 },
    };
    const deltas = extractActionDeltas('EAT_MEAL', result);
    expect(deltas.moneyCents).toBe(-2000);
    expect(deltas.vigorDelta).toEqual({ sv: 2 });
  });

  it('extracts SLEEP vigor gained', () => {
    const result = {
      hoursSlept: 8,
      vigorGained: { pv: 16, mv: 12, sv: 2, cv: 1, spv: 1 },
      vigorAfter: { pv: 90, mv: 80, sv: 52, cv: 41, spv: 51 },
    };
    const deltas = extractActionDeltas('SLEEP', result);
    expect(deltas.moneyCents).toBeUndefined();
    expect(deltas.vigorDelta).toEqual({ pv: 16, mv: 12, sv: 2, cv: 1, spv: 1 });
  });

  it('extracts LEISURE instant delta', () => {
    const result = {
      instantDelta: { mv: 4, spv: 2 },
      buffCreated: true,
    };
    const deltas = extractActionDeltas('LEISURE', result);
    expect(deltas.vigorDelta).toEqual({ mv: 4, spv: 2 });
  });

  it('extracts SOCIAL_CALL vigor delta', () => {
    const result = {
      vigorDelta: { sv: 3, mv: 1 },
      audit: {},
    };
    const deltas = extractActionDeltas('SOCIAL_CALL', result);
    expect(deltas.vigorDelta).toEqual({ sv: 3, mv: 1 });
  });

  it('returns empty for unknown action types', () => {
    const deltas = extractActionDeltas('UNKNOWN_ACTION', { foo: 'bar' });
    expect(deltas).toEqual({});
  });

  it('returns empty for null result', () => {
    const deltas = extractActionDeltas('WORK_SHIFT', null);
    expect(deltas).toEqual({});
  });
});

/* ── Unit tests: formatDeltaSummary ─────────────── */

describe('formatDeltaSummary', () => {
  it('formats money earned', () => {
    expect(formatDeltaSummary({ moneyCents: 5000 })).toBe('+₿50.00');
  });

  it('formats money spent', () => {
    expect(formatDeltaSummary({ moneyCents: -500 })).toBe('-₿5.00');
  });

  it('formats vigor delta', () => {
    const s = formatDeltaSummary({ vigorDelta: { pv: -25, mv: -8 } });
    expect(s).toBe('-25 PV, -8 MV');
  });

  it('formats money and vigor together', () => {
    const s = formatDeltaSummary({ moneyCents: 5000, vigorDelta: { pv: -25 } });
    expect(s).toBe('+₿50.00, -25 PV');
  });

  it('returns empty string for no deltas', () => {
    expect(formatDeltaSummary({})).toBe('');
  });

  it('skips zero values', () => {
    expect(formatDeltaSummary({ moneyCents: 0, vigorDelta: { pv: 0 } })).toBe('');
  });
});
