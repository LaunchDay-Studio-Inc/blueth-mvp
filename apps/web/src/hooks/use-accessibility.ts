'use client';

import { useEffect, useCallback } from 'react';
import { useLocalStorage } from './use-local-storage';

export interface AccessibilityPrefs {
  reduceMotion: boolean;
  textSize: 100 | 110 | 125;
  highContrast: boolean;
  enhancedFocus: boolean;
}

const DEFAULT_PREFS: AccessibilityPrefs = {
  reduceMotion: false,
  textSize: 100,
  highContrast: false,
  enhancedFocus: false,
};

export function useAccessibility() {
  const [prefs, setPrefs] = useLocalStorage<AccessibilityPrefs>(
    'blueth_a11y_prefs',
    DEFAULT_PREFS,
  );

  // Apply data attributes to <html> on every change
  useEffect(() => {
    const el = document.documentElement;

    if (prefs.reduceMotion) {
      el.setAttribute('data-reduce-motion', 'true');
    } else {
      el.removeAttribute('data-reduce-motion');
    }

    if (prefs.highContrast) {
      el.setAttribute('data-high-contrast', 'true');
    } else {
      el.removeAttribute('data-high-contrast');
    }

    if (prefs.enhancedFocus) {
      el.setAttribute('data-focus-enhanced', 'true');
    } else {
      el.removeAttribute('data-focus-enhanced');
    }

    if (prefs.textSize !== 100) {
      el.style.fontSize = `${prefs.textSize}%`;
    } else {
      el.style.fontSize = '';
    }
  }, [prefs]);

  const setReduceMotion = useCallback(
    (v: boolean) => setPrefs((p) => ({ ...p, reduceMotion: v })),
    [setPrefs],
  );
  const setTextSize = useCallback(
    (v: 100 | 110 | 125) => setPrefs((p) => ({ ...p, textSize: v })),
    [setPrefs],
  );
  const setHighContrast = useCallback(
    (v: boolean) => setPrefs((p) => ({ ...p, highContrast: v })),
    [setPrefs],
  );
  const setEnhancedFocus = useCallback(
    (v: boolean) => setPrefs((p) => ({ ...p, enhancedFocus: v })),
    [setPrefs],
  );

  return { prefs, setReduceMotion, setTextSize, setHighContrast, setEnhancedFocus };
}
