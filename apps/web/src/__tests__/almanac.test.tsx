import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ALMANAC_CATEGORIES } from '@/lib/almanac-data';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/almanac',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Lazy import so mocks are in place
async function renderAlmanac() {
  const mod = await import('@/app/(game)/almanac/page');
  const AlmanacPage = mod.default;
  return render(<AlmanacPage />);
}

describe('Almanac data', () => {
  it('has at least 4 categories', () => {
    expect(ALMANAC_CATEGORIES.length).toBeGreaterThanOrEqual(4);
  });

  it('every category has at least 2 entries', () => {
    for (const cat of ALMANAC_CATEGORIES) {
      expect(cat.entries.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('every entry has a non-empty body and title', () => {
    for (const cat of ALMANAC_CATEGORIES) {
      for (const entry of cat.entries) {
        expect(entry.title.length).toBeGreaterThan(0);
        expect(entry.body.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('AlmanacPage', () => {
  it('renders page heading', async () => {
    await renderAlmanac();
    expect(screen.getByText('City Almanac')).toBeDefined();
  });

  it('renders all category headings', async () => {
    await renderAlmanac();
    for (const cat of ALMANAC_CATEGORIES) {
      expect(screen.getByText(cat.label)).toBeDefined();
    }
  });

  it('renders search input', async () => {
    await renderAlmanac();
    expect(screen.getByPlaceholderText('Search the almanac...')).toBeDefined();
  });

  it('filters entries by search query', async () => {
    await renderAlmanac();
    const searchInput = screen.getByPlaceholderText('Search the almanac...');

    // Type "circadian" — only matches the Time & Actions category
    fireEvent.change(searchInput, { target: { value: 'circadian' } });

    // "Time & Actions" category should still be visible
    expect(screen.getByText('Time & Actions')).toBeDefined();

    // "Economy" category should be hidden (no entries match "circadian")
    expect(screen.queryByText('Economy')).toBeNull();
  });

  it('shows "No entries found" for unmatched search', async () => {
    await renderAlmanac();
    const searchInput = screen.getByPlaceholderText('Search the almanac...');

    fireEvent.change(searchInput, { target: { value: 'zzzzxyznonexistent' } });

    expect(screen.getByText(/No entries found/)).toBeDefined();
  });
});
