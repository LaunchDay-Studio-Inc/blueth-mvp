'use client';

import { useAuth } from '@/lib/auth-context';
import { VigorPanel } from '@/components/vigor-panel';
import { RecoveryWidget } from '@/components/recovery-widget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VIGOR_KEYS, BASE_REGEN_RATES, HOUSING_TIERS } from '@blueth/core';
import { VIGOR_LABELS, VIGOR_TEXT_COLORS } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

export default function VigorPage() {
  const { user } = useAuth();

  if (!user) {
    return <Skeleton className="h-96 w-full" />;
  }

  const housingTier = HOUSING_TIERS[user.housingTier] ?? HOUSING_TIERS[0];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Vigor</h1>

      <VigorPanel player={user} />

      <RecoveryWidget player={user} />

      {/* Active Buffs */}
      {user.activeBuffs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Active Buffs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {user.activeBuffs.map((buff) => {
                const endsAt = new Date(buff.endsAt);
                const now = new Date();
                const remainingMs = endsAt.getTime() - now.getTime();
                const remainingMin = Math.max(0, Math.round(remainingMs / 60000));
                const hours = Math.floor(remainingMin / 60);
                const mins = remainingMin % 60;

                return (
                  <div key={buff.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{buff.source}</Badge>
                      <span className="text-muted-foreground">
                        {Object.entries(buff.perHourBonusByDim)
                          .map(([k, v]) => `${(k as string).toUpperCase()} +${v}/hr`)
                          .join(', ')}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`} left
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regen Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Regen Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {VIGOR_KEYS.map((key) => {
              const base = BASE_REGEN_RATES[key];
              const housingBonus = housingTier.regenBonuses[key] ?? 0;

              return (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className={VIGOR_TEXT_COLORS[key]}>{VIGOR_LABELS[key]}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>Base: {base}/hr</span>
                    {housingBonus > 0 && (
                      <span className="text-green-600">+{housingBonus}/hr housing</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Rates vary by time of day (circadian), sleep state, meal buffs, and penalty level.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
