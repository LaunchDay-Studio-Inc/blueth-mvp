'use client';

import { useRef, useCallback } from 'react';
import type { AuthStatus } from '@/lib/auth-context';

const MAX_FLIPS = 3;
const WINDOW_MS = 5_000;

/**
 * Circuit breaker that detects auth state flip-flopping.
 * If status flips between authenticated/unauthenticated more than
 * MAX_FLIPS times within WINDOW_MS, it trips and blocks auto-navigation.
 */
export function useAuthLoopBreaker() {
  const flips = useRef<number[]>([]);
  const lastStatus = useRef<AuthStatus | null>(null);
  const tripped = useRef(false);

  const recordTransition = useCallback((status: AuthStatus) => {
    if (status === 'loading') return;

    if (lastStatus.current !== null && lastStatus.current !== status) {
      const now = Date.now();
      flips.current.push(now);
      // Keep only flips within the window
      flips.current = flips.current.filter((t) => now - t < WINDOW_MS);

      if (flips.current.length >= MAX_FLIPS) {
        tripped.current = true;
      }
    }
    lastStatus.current = status;
  }, []);

  const isTripped = useCallback(() => tripped.current, []);

  const reset = useCallback(() => {
    flips.current = [];
    lastStatus.current = null;
    tripped.current = false;
  }, []);

  return { recordTransition, isTripped, reset };
}
