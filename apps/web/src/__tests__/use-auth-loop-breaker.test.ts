import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthLoopBreaker } from '@/hooks/use-auth-loop-breaker';

describe('useAuthLoopBreaker', () => {
  it('does not trip on normal transitions', () => {
    const { result } = renderHook(() => useAuthLoopBreaker());

    act(() => result.current.recordTransition('loading'));
    act(() => result.current.recordTransition('unauthenticated'));
    act(() => result.current.recordTransition('authenticated'));

    expect(result.current.isTripped()).toBe(false);
  });

  it('trips after 3 rapid flips in 5 seconds', () => {
    const { result } = renderHook(() => useAuthLoopBreaker());

    // Simulate rapid flipping
    act(() => result.current.recordTransition('authenticated'));
    act(() => result.current.recordTransition('unauthenticated'));
    act(() => result.current.recordTransition('authenticated'));
    act(() => result.current.recordTransition('unauthenticated'));

    expect(result.current.isTripped()).toBe(true);
  });

  it('ignores loading transitions', () => {
    const { result } = renderHook(() => useAuthLoopBreaker());

    act(() => result.current.recordTransition('authenticated'));
    act(() => result.current.recordTransition('loading'));
    act(() => result.current.recordTransition('loading'));
    act(() => result.current.recordTransition('loading'));

    expect(result.current.isTripped()).toBe(false);
  });

  it('resets correctly', () => {
    const { result } = renderHook(() => useAuthLoopBreaker());

    // Trip it
    act(() => result.current.recordTransition('authenticated'));
    act(() => result.current.recordTransition('unauthenticated'));
    act(() => result.current.recordTransition('authenticated'));
    act(() => result.current.recordTransition('unauthenticated'));
    expect(result.current.isTripped()).toBe(true);

    // Reset
    act(() => result.current.reset());
    expect(result.current.isTripped()).toBe(false);
  });

  it('does not trip for repeated same-status transitions', () => {
    const { result } = renderHook(() => useAuthLoopBreaker());

    act(() => result.current.recordTransition('unauthenticated'));
    act(() => result.current.recordTransition('unauthenticated'));
    act(() => result.current.recordTransition('unauthenticated'));
    act(() => result.current.recordTransition('unauthenticated'));

    expect(result.current.isTripped()).toBe(false);
  });
});
