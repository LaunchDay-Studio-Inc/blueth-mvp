'use client';

import Link from 'next/link';
import { useTutorial } from '@/hooks/use-tutorial';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TutorialChecklist() {
  const { state, steps, dismiss, isVisible, allComplete } = useTutorial();

  if (!isVisible) return null;

  return (
    <div
      role="complementary"
      aria-label="Getting started checklist"
      className={
        'fixed bottom-20 right-4 lg:bottom-4 z-30 w-72 '
        + 'glass-elevated rounded-xl p-4 shadow-lg '
        + 'animate-slide-up'
      }
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">
          {allComplete ? "You're all set!" : 'Welcome to Blueth City'}
        </h3>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground p-1 rounded"
          aria-label="Close tutorial"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!allComplete && (
        <p className="text-xs text-muted-foreground mb-3">
          Complete these steps to get started:
        </p>
      )}

      <ul className="space-y-2">
        {steps.map((step) => {
          const done = state.completed.includes(step.id);
          return (
            <li key={step.id}>
              <Link
                href={step.href}
                className={
                  'flex items-center gap-2 text-xs rounded px-2 py-1.5 '
                  + 'hover:bg-white/5 transition-colors '
                  + (done ? 'text-muted-foreground' : 'text-foreground')
                }
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={done ? 'line-through' : ''}>
                  {step.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {!allComplete && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3 text-xs h-8"
          onClick={dismiss}
        >
          Skip for now
        </Button>
      )}
    </div>
  );
}
