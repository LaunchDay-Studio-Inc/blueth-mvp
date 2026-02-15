'use client';

import { useAuth } from '@/lib/auth-context';
import { useActionHistory, type ActionHistoryItem } from '@/hooks/use-action-history';
import { useActionQueue } from '@/hooks/use-action-queue';
import { VigorPanel } from '@/components/vigor-panel';
import { RecoveryWidget } from '@/components/recovery-widget';
import { MoneyDisplay } from '@/components/money-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HOUSING_TIERS, UTILITIES_DAILY_COST, formatBlueth } from '@blueth/core';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertCircle, Loader2, Clock, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { VIGOR_SHORT_LABELS } from '@/lib/constants';
import type { VigorKey } from '@blueth/core';
import type { ActionQueueItem } from '@/hooks/use-action-queue';

function formatActionType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function ActionTimer({ item }: { item: ActionQueueItem }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startMs = new Date(item.scheduled_for).getTime();
  const durationMs = item.duration_seconds * 1000;
  const endMs = startMs + durationMs;
  const elapsedMs = now - startMs;
  const remainingS = Math.max(0, Math.ceil((endMs - now) / 1000));
  const pct = durationMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100)) : 100;

  return (
    <div className="space-y-1 w-full mt-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-amber-600 font-mono">{formatDuration(remainingS)} left</span>
        <span className="text-muted-foreground">{Math.round(pct)}%</span>
      </div>
      <Progress value={pct} className="h-1.5" indicatorClassName="bg-amber-500" />
    </div>
  );
}

function ActionResultSummary({ item }: { item: ActionHistoryItem }) {
  const result = item.result as Record<string, unknown> | null;
  if (!result) return null;

  const vigorDelta = result.vigorDelta as Partial<Record<string, number>> | undefined;
  const vigorCost = result.vigorCost as Partial<Record<string, number>> | undefined;
  const payCents = result.payCents as number | undefined;

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {/* Show vigor gains */}
      {vigorDelta && Object.entries(vigorDelta).map(([key, val]) => {
        if (!val || val === 0) return null;
        return (
          <span key={key} className={cn('text-[11px]', val > 0 ? 'text-green-600' : 'text-red-500')}>
            {VIGOR_SHORT_LABELS[key as VigorKey] ?? key.toUpperCase()} {val > 0 ? '+' : ''}{Math.round(val)}
          </span>
        );
      })}
      {/* Show vigor costs */}
      {vigorCost && Object.entries(vigorCost).map(([key, val]) => {
        if (!val || val === 0) return null;
        return (
          <span key={key} className="text-[11px] text-red-500">
            {VIGOR_SHORT_LABELS[key as VigorKey] ?? key.toUpperCase()} -{Math.round(val)}
          </span>
        );
      })}
      {/* Show pay */}
      {payCents !== undefined && payCents > 0 && (
        <span className="text-[11px] text-green-600 flex items-center gap-0.5">
          <TrendingUp className="h-3 w-3" />
          +{formatBlueth(payCents)}
        </span>
      )}
    </div>
  );
}

export default function SummaryPage() {
  const { user } = useAuth();
  const { data: queue } = useActionQueue();
  const { data: history } = useActionHistory();

  if (!user) {
    return <Skeleton className="h-96 w-full" />;
  }

  const housingTier = HOUSING_TIERS[user.housingTier] ?? HOUSING_TIERS[0];
  const utilities = UTILITIES_DAILY_COST[user.housingTier] ?? 0;
  const dailyCost = housingTier.dailyRentCents + utilities;

  const queueItems = queue || [];
  const running = queueItems.find((i) => i.status === 'running');
  const pending = queueItems.filter((i) => i.status === 'pending' || i.status === 'scheduled');
  const historyItems = (history || []).slice(0, 10);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Daily Summary</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Balance Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <MoneyDisplay cents={user.balanceCents} size="lg" />
            <p className="text-xs text-muted-foreground mt-1">
              Daily cost: {formatBlueth(dailyCost)} ({housingTier.name})
            </p>
          </CardContent>
        </Card>

        {/* Meals Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Meal Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">{user.mealsEatenToday}/3</span>
              <div>
                <p className="text-sm">meals today</p>
                {user.mealPenaltyLevel > 0 && (
                  <Badge variant="destructive" className="text-xs mt-0.5">
                    Penalty level {user.mealPenaltyLevel}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Running Action */}
      {running && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
              Running Action
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{formatActionType(running.type)}</span>
            </div>
            <ActionTimer item={running} />
          </CardContent>
        </Card>
      )}

      {/* Queue */}
      {pending.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Queued Actions
              </CardTitle>
              <Badge variant="secondary" className="text-xs">{pending.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {pending.map((item) => (
                <li key={item.action_id} className="flex items-center gap-2 text-sm py-1 border-b last:border-0">
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                  <span className="flex-1 truncate">{formatActionType(item.type)}</span>
                  <Badge variant="outline" className="text-xs">{item.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Vigor */}
      <VigorPanel player={user} />

      {/* Recovery */}
      <RecoveryWidget player={user} />

      {/* Action History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Actions</CardTitle>
        </CardHeader>
        <CardContent>
          {historyItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No completed actions yet. Queue an action from Jobs, Food, or Leisure!
            </p>
          ) : (
            <div className="space-y-2">
              {historyItems.map((item) => (
                <div key={item.action_id} className="py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    {item.status === 'completed' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    )}
                    <span className="flex-1 text-sm font-medium truncate">
                      {formatActionType(item.type)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.finished_at
                        ? new Date(item.finished_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                  </div>

                  {item.status === 'completed' && <ActionResultSummary item={item} />}

                  {item.status === 'failed' && item.failure_reason && (
                    <p className="text-xs text-destructive mt-1">{item.failure_reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Buffs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Buffs</CardTitle>
          </CardHeader>
          <CardContent>
            {user.activeBuffs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active buffs</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {user.activeBuffs.map((buff) => (
                  <Badge key={buff.id} variant="secondary" className="text-xs">
                    {buff.source}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Housing */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Housing</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Tier:</span> {housingTier.name} (Tier {user.housingTier})</p>
            <p><span className="text-muted-foreground">Rent:</span> {formatBlueth(housingTier.dailyRentCents)}/day</p>
            <p><span className="text-muted-foreground">Utilities:</span> {formatBlueth(utilities)}/day</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
