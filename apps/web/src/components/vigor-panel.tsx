'use client';

import { VIGOR_KEYS, calculateEfficiency, CASCADE_THRESHOLD, type VigorDimension } from '@blueth/core';
import { SLEEP_LABELS } from '@/lib/constants';
import { VigorBar } from './vigor-bar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import type { PlayerStateData } from '@/lib/auth-context';

interface VigorPanelProps {
  player: PlayerStateData;
}

export function VigorPanel({ player }: VigorPanelProps) {
  const vigor = player.vigor;
  const caps = player.caps;
  const efficiency = calculateEfficiency(vigor as VigorDimension);
  const cascading = VIGOR_KEYS.filter((k) => vigor[k] < CASCADE_THRESHOLD);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Vigor</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={player.sleepState === 'sleeping' ? 'secondary' : player.sleepState === 'exhausted' ? 'destructive' : 'outline'}>
              {SLEEP_LABELS[player.sleepState] || player.sleepState}
            </Badge>
            <Badge variant={efficiency < 0.8 ? 'destructive' : 'secondary'}>
              {Math.round(efficiency * 100)}% eff.
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {VIGOR_KEYS.map((key) => (
          <VigorBar
            key={key}
            dimension={key}
            value={vigor[key]}
            cap={caps[`${key}_cap` as keyof typeof caps]}
          />
        ))}

        {cascading.length > 0 && (
          <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Cascade warning: {cascading.map((k) => k.toUpperCase()).join(', ')} below {CASCADE_THRESHOLD}. Other dimensions are draining faster.
            </span>
          </div>
        )}

        {player.activeBuffs.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Active Buffs</p>
            <div className="flex flex-wrap gap-1">
              {player.activeBuffs.map((buff) => (
                <Badge key={buff.id} variant="secondary" className="text-xs">
                  {buff.source}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
