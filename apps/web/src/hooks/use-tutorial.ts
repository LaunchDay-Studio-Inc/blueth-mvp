'use client';

import { useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLocalStorage } from './use-local-storage';

interface TutorialState {
  completed: string[];
  dismissed: boolean;
}

const DEFAULT_STATE: TutorialState = { completed: [], dismissed: false };

export interface TutorialStep {
  id: string;
  label: string;
  href: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'eat_meal', label: 'Eat a meal', href: '/food' },
  { id: 'do_job', label: 'Do a short job', href: '/jobs' },
  { id: 'check_bills', label: 'Check Bills', href: '/bills' },
  { id: 'vigor_detail', label: 'Open Vigor details', href: '/vigor' },
  { id: 'view_summary', label: 'View Summary', href: '/summary' },
];

const PATH_TO_STEP: Record<string, string> = {
  '/food': 'eat_meal',
  '/jobs': 'do_job',
  '/bills': 'check_bills',
  '/vigor': 'vigor_detail',
  '/summary': 'view_summary',
};

export function useTutorial() {
  const [state, setState] = useLocalStorage<TutorialState>(
    'blueth_tutorial_state',
    DEFAULT_STATE,
  );

  const pathname = usePathname();

  // Auto-complete steps when player visits matching pages
  useEffect(() => {
    const stepId = PATH_TO_STEP[pathname];
    if (stepId && !state.completed.includes(stepId)) {
      setState((prev) => ({
        ...prev,
        completed: [...prev.completed, stepId],
      }));
    }
  }, [pathname, state.completed, setState]);

  const allComplete = state.completed.length >= TUTORIAL_STEPS.length;

  // Auto-dismiss when all steps complete
  useEffect(() => {
    if (allComplete && !state.dismissed) {
      const timeout = setTimeout(() => {
        setState((prev) => ({ ...prev, dismissed: true }));
      }, 3000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [allComplete, state.dismissed, setState]);

  const dismiss = useCallback(() => {
    setState((prev) => ({ ...prev, dismissed: true }));
  }, [setState]);

  const reset = useCallback(() => {
    setState({ completed: [], dismissed: false });
  }, [setState]);

  const isVisible = !state.dismissed;

  return {
    state,
    steps: TUTORIAL_STEPS,
    dismiss,
    reset,
    isVisible,
    allComplete,
  };
}
