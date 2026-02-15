import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatDetailModal } from '@/components/stat-detail-modal';
import { CashDetailModal } from '@/components/cash-detail-modal';

const mockUser = {
  playerId: 'test-id',
  username: 'testplayer',
  timezone: 'Asia/Dubai',
  vigor: { pv: 75, mv: 60, sv: 45, cv: 30, spv: 50 },
  caps: { pv_cap: 100, mv_cap: 100, sv_cap: 100, cv_cap: 100, spv_cap: 100 },
  sleepState: 'awake' as const,
  housingTier: 2,
  balanceCents: 50000,
  balanceFormatted: 'B500.00',
  skills: {},
  activeBuffs: [],
  mealsEatenToday: 3,
  mealPenaltyLevel: 0,
  pendingActions: 0,
  updatedAt: '2026-02-15T10:00:00Z',
  nextDailyReset: '2026-02-16T00:00:00+04:00',
  localTime: '2026-02-15T14:00:00+04:00',
  secondsUntilDailyReset: 36000,
  softGates: {
    mvSlippage: 0,
    svServiceMult: 1,
    cvFeeMult: 1,
    cvSpeedMult: 1,
    spvRegenMult: 1,
  },
};

describe('StatDetailModal', () => {
  it('shows vigor stat title and breakdown sections when open', () => {
    render(
      <StatDetailModal dimension="pv" onClose={vi.fn()} user={mockUser} />,
    );
    expect(screen.getByText('Physical Vigor')).toBeInTheDocument();
    expect(screen.getByText('PV')).toBeInTheDocument();
    expect(screen.getByText('Base regen')).toBeInTheDocument();
    expect(screen.getByText('Circadian')).toBeInTheDocument();
    expect(screen.getByText('How to Improve')).toBeInTheDocument();
  });

  it('computes net regen rate correctly for afternoon PV', () => {
    // localTime is 14:00 Dubai = afternoon period
    // PV base = 2.0, circadian afternoon for PV = 1.0, sleep = 1.0,
    // penalty = 1.0, spvRegen = 1.0, housing tier 2 = +0.5, no buffs, no drain
    // net = (2.0 * 1.0 * 1.0 * 1.0 * 1.0) + 0.5 + 0 - 0 = 2.50
    render(
      <StatDetailModal dimension="pv" onClose={vi.fn()} user={mockUser} />,
    );
    expect(screen.getByText('Current Regen Rate')).toBeInTheDocument();
    expect(screen.getByText('+2.50/hr')).toBeInTheDocument();
  });

  it('returns null when dimension is null', () => {
    const { container } = render(
      <StatDetailModal dimension={null} onClose={vi.fn()} user={mockUser} />,
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('CashDetailModal', () => {
  it('shows daily burn and runway when open', () => {
    render(
      <CashDetailModal open onClose={vi.fn()} user={mockUser} />,
    );
    expect(screen.getByText('Cash Balance')).toBeInTheDocument();
    expect(screen.getByText('Daily Burn')).toBeInTheDocument();
    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(screen.getByText('Utilities')).toBeInTheDocument();
    expect(screen.getByText('Runway')).toBeInTheDocument();
    // Tier 2: rent B20 + utilities B5 = B25/day, balance B500 / B25 = 20 days
    expect(screen.getByText('20 days')).toBeInTheDocument();
  });

  it('shows View Full Wallet link', () => {
    render(
      <CashDetailModal open onClose={vi.fn()} user={mockUser} />,
    );
    const link = screen.getByRole('link', { name: /view full wallet/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/wallet');
  });
});
