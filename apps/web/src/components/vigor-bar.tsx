'use client';

import { cn } from '@/lib/utils';
import { VIGOR_LABELS, VIGOR_TEXT_COLORS } from '@/lib/constants';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { VigorKey } from '@blueth/core';

interface VigorBarProps {
  dimension: VigorKey;
  value: number;
  cap: number;
  compact?: boolean;
}

export function VigorBar({ dimension, value, cap, compact = false }: VigorBarProps) {
  const pct = cap > 0 ? Math.min((value / cap) * 100, 100) : 0;
  const colorClass = pct > 60 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <span className={cn('text-xs font-medium w-6', VIGOR_TEXT_COLORS[dimension])}>
                {dimension.toUpperCase()}
              </span>
              <div className="h-2 w-16 rounded-full bg-secondary overflow-hidden">
                <div className={cn('h-full transition-all', colorClass)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{VIGOR_LABELS[dimension]}: {Math.round(value)}/{cap}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className={cn('text-sm font-medium', VIGOR_TEXT_COLORS[dimension])}>
          {VIGOR_LABELS[dimension]}
        </span>
        <span className="text-sm text-muted-foreground">
          {Math.round(value)} / {cap}
        </span>
      </div>
      <div className="h-3 rounded-full bg-secondary overflow-hidden">
        <div className={cn('h-full transition-all rounded-full', colorClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
