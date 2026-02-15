import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { extractActionDeltas } from '@/lib/action-results';
import {
  GIGS_CATALOG,
  GIG_DURATION_SECONDS,
  GIG_DIMINISH_THRESHOLD,
  getGigVigorCost,
  calculateGigPay,
  calculatePerformance,
  JOB_FAMILIES,
} from '@blueth/core';

// ── Unit tests: GIG_JOB action result extraction ──

describe('GIG_JOB extractActionDeltas', () => {
  it('extracts pay and vigor cost from GIG_JOB result', () => {
    const result = {
      gigId: 'courier_run',
      jobFamily: 'physical',
      payCents: 345,
      vigorCost: { pv: 3, mv: 1 },
      vigorAfter: { pv: 97, mv: 99, sv: 100, cv: 100, spv: 100 },
    };
    const deltas = extractActionDeltas('GIG_JOB', result);
    expect(deltas.moneyCents).toBe(345);
    expect(deltas.vigorDelta).toEqual({ pv: -3, mv: -1 });
  });

  it('handles GIG_JOB with no vigor cost gracefully', () => {
    const result = {
      gigId: 'data_entry_burst',
      payCents: 400,
    };
    const deltas = extractActionDeltas('GIG_JOB', result);
    expect(deltas.moneyCents).toBe(400);
    expect(deltas.vigorDelta).toBeUndefined();
  });
});

// ── Data tests: Gig catalog ──

describe('GIGS_CATALOG data', () => {
  it('has exactly 4 entries', () => {
    expect(GIGS_CATALOG).toHaveLength(4);
  });

  it('each gig has a valid job family', () => {
    for (const gig of GIGS_CATALOG) {
      expect(JOB_FAMILIES).toContain(gig.family);
    }
  });

  it('each gig has a baseWageDaily higher than the standard job in the same family', () => {
    // Standard jobs: physical=12000, admin=14400, service=11000, management=18000
    const standardWages: Record<string, number> = {
      physical: 12000,
      admin: 14400,
      service: 11000,
      management: 18000,
    };
    for (const gig of GIGS_CATALOG) {
      expect(gig.baseWageDaily).toBeGreaterThan(standardWages[gig.family]);
    }
  });

  it('gig vigor costs are non-negative', () => {
    for (const family of JOB_FAMILIES) {
      const cost = getGigVigorCost(family);
      for (const val of Object.values(cost)) {
        expect(val).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ── Gig Board rendering ──

vi.mock('next/navigation', () => ({
  usePathname: () => '/jobs',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: {
      vigor: { pv: 100, mv: 100, sv: 100, cv: 100, spv: 100 },
      skills: { labor: 0.5, admin: 0.5, service: 0.5, management: 0.5, trading: 0.1 },
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/use-submit-action', () => ({
  useSubmitAction: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
  useMutation: (opts: Record<string, unknown>) => ({
    mutate: vi.fn(),
    isPending: false,
    ...opts,
  }),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

async function renderJobsPage() {
  const mod = await import('@/app/(game)/jobs/page');
  return render(<mod.default />);
}

describe('Gig Board UI', () => {
  it('renders "Gig Board" heading', async () => {
    await renderJobsPage();
    expect(screen.getByText('Gig Board')).toBeDefined();
  });

  it('renders all 4 gig cards', async () => {
    await renderJobsPage();
    for (const gig of GIGS_CATALOG) {
      expect(screen.getByText(gig.label)).toBeDefined();
    }
  });

  it('shows "10 min" duration on gig cards', async () => {
    await renderJobsPage();
    const durationBadges = screen.getAllByText('10 min');
    expect(durationBadges.length).toBe(4);
  });

  it('shows family label on each gig card', async () => {
    await renderJobsPage();
    // Each gig has a description like "physical gig", "admin gig", etc.
    for (const gig of GIGS_CATALOG) {
      expect(screen.getByText(`${gig.family} gig`)).toBeDefined();
    }
  });

  it('also renders standard "Available Jobs" section', async () => {
    await renderJobsPage();
    expect(screen.getByText('Available Jobs')).toBeDefined();
  });
});
