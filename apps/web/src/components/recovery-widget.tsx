'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, BedDouble, UtensilsCrossed, Briefcase, ArrowDown } from 'lucide-react';
import type { PlayerStateData } from '@/lib/auth-context';
import { VIGOR_KEYS, CASCADE_THRESHOLD } from '@blueth/core';

interface RecoveryWidgetProps {
  player: PlayerStateData;
}

interface Suggestion {
  icon: React.ReactNode;
  text: string;
  priority: number;
}

export function RecoveryWidget({ player }: RecoveryWidgetProps) {
  const suggestions: Suggestion[] = [];
  const vigor = player.vigor;

  // Check for low vigor
  const lowDims = VIGOR_KEYS.filter((k) => vigor[k] < CASCADE_THRESHOLD);
  if (lowDims.length > 0) {
    if (vigor.pv < CASCADE_THRESHOLD) {
      suggestions.push({
        icon: <UtensilsCrossed className="h-4 w-4" />,
        text: 'Eat a meal to restore Physical Vigor',
        priority: 1,
      });
    }
    if (player.sleepState !== 'sleeping') {
      suggestions.push({
        icon: <BedDouble className="h-4 w-4" />,
        text: 'Sleep to regenerate all vigor dimensions',
        priority: 2,
      });
    }
  }

  // Check for low money
  if (player.balanceCents < 5000) {
    suggestions.push({
      icon: <Briefcase className="h-4 w-4" />,
      text: 'Take a work shift to earn money',
      priority: 3,
    });
    if (player.housingTier > 0) {
      suggestions.push({
        icon: <ArrowDown className="h-4 w-4" />,
        text: 'Consider downgrading housing to reduce costs',
        priority: 4,
      });
    }
  }

  if (suggestions.length === 0) return null;

  suggestions.sort((a, b) => a.priority - b.priority);

  return (
    <Card className="border-amber-500/30 bg-amber-950/30">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          Recovery Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ul className="space-y-1.5">
          {suggestions.map((s, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-amber-300/90">
              {s.icon}
              <span>{s.text}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
