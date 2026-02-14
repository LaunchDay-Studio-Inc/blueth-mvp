'use client';

import { useAuth } from '@/lib/auth-context';
import { VigorPanel } from '@/components/vigor-panel';
import { ActionQueue } from '@/components/action-queue';
import { RecoveryWidget } from '@/components/recovery-widget';
import { MoneyDisplay } from '@/components/money-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HOUSING_TIERS, UTILITIES_DAILY_COST, formatBlueth } from '@blueth/core';
import { Skeleton } from '@/components/ui/skeleton';

export default function SummaryPage() {
  const { user } = useAuth();

  if (!user) {
    return <Skeleton className="h-96 w-full" />;
  }

  const housingTier = HOUSING_TIERS[user.housingTier] ?? HOUSING_TIERS[0];
  const utilities = UTILITIES_DAILY_COST[user.housingTier] ?? 0;
  const dailyCost = housingTier.dailyRentCents + utilities;

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

      {/* Vigor */}
      <VigorPanel player={user} />

      {/* Recovery */}
      <RecoveryWidget player={user} />

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

        {/* Pending Actions */}
        <ActionQueue />
      </div>

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
  );
}
