import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('useAccessibility', () => {
  beforeEach(() => {
    // Clear localStorage and reset <html> attributes
    localStorage.clear();
    document.documentElement.removeAttribute('data-reduce-motion');
    document.documentElement.removeAttribute('data-high-contrast');
    document.documentElement.removeAttribute('data-focus-enhanced');
    document.documentElement.style.fontSize = '';
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-reduce-motion');
    document.documentElement.removeAttribute('data-high-contrast');
    document.documentElement.removeAttribute('data-focus-enhanced');
    document.documentElement.style.fontSize = '';
  });

  it('starts with default preferences', async () => {
    const { useAccessibility } = await import('@/hooks/use-accessibility');
    const { result } = renderHook(() => useAccessibility());

    expect(result.current.prefs).toEqual({
      reduceMotion: false,
      textSize: 100,
      highContrast: false,
      enhancedFocus: false,
    });
  });

  it('applies data-reduce-motion when enabled', async () => {
    const { useAccessibility } = await import('@/hooks/use-accessibility');
    const { result } = renderHook(() => useAccessibility());

    act(() => {
      result.current.setReduceMotion(true);
    });

    expect(document.documentElement.getAttribute('data-reduce-motion')).toBe('true');
  });

  it('removes data-reduce-motion when disabled', async () => {
    const { useAccessibility } = await import('@/hooks/use-accessibility');
    const { result } = renderHook(() => useAccessibility());

    act(() => {
      result.current.setReduceMotion(true);
    });
    expect(document.documentElement.getAttribute('data-reduce-motion')).toBe('true');

    act(() => {
      result.current.setReduceMotion(false);
    });
    expect(document.documentElement.hasAttribute('data-reduce-motion')).toBe(false);
  });

  it('sets fontSize on html when textSize changes', async () => {
    const { useAccessibility } = await import('@/hooks/use-accessibility');
    const { result } = renderHook(() => useAccessibility());

    act(() => {
      result.current.setTextSize(125);
    });

    expect(document.documentElement.style.fontSize).toBe('125%');
  });

  it('resets fontSize when textSize returns to 100', async () => {
    const { useAccessibility } = await import('@/hooks/use-accessibility');
    const { result } = renderHook(() => useAccessibility());

    act(() => {
      result.current.setTextSize(110);
    });
    expect(document.documentElement.style.fontSize).toBe('110%');

    act(() => {
      result.current.setTextSize(100);
    });
    expect(document.documentElement.style.fontSize).toBe('');
  });

  it('applies data-high-contrast when enabled', async () => {
    const { useAccessibility } = await import('@/hooks/use-accessibility');
    const { result } = renderHook(() => useAccessibility());

    act(() => {
      result.current.setHighContrast(true);
    });

    expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true');
  });

  it('applies data-focus-enhanced when enabled', async () => {
    const { useAccessibility } = await import('@/hooks/use-accessibility');
    const { result } = renderHook(() => useAccessibility());

    act(() => {
      result.current.setEnhancedFocus(true);
    });

    expect(document.documentElement.getAttribute('data-focus-enhanced')).toBe('true');
  });
});

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default value when localStorage is empty', async () => {
    const { useLocalStorage } = await import('@/hooks/use-local-storage');
    const { result } = renderHook(() => useLocalStorage('test_key', 42));

    expect(result.current[0]).toBe(42);
  });

  it('persists value to localStorage', async () => {
    const { useLocalStorage } = await import('@/hooks/use-local-storage');
    const { result } = renderHook(() => useLocalStorage('test_key', 'hello'));

    act(() => {
      result.current[1]('world');
    });

    expect(result.current[0]).toBe('world');
    expect(JSON.parse(localStorage.getItem('test_key')!)).toBe('world');
  });

  it('supports updater function', async () => {
    const { useLocalStorage } = await import('@/hooks/use-local-storage');
    const { result } = renderHook(() => useLocalStorage('test_counter', 0));

    act(() => {
      result.current[1]((prev: number) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
  });
});
