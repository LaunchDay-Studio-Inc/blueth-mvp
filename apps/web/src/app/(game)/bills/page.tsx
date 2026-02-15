'use client';

import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HOUSING_TIERS, UTILITIES_DAILY_COST, formatBlueth, type VigorKey } from '@blueth/core';
import { VIGOR_LABELS } from '@/lib/constants';
import { Home, ArrowUp, ArrowDown, Check } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function BillsPage() {
  const { user } = useAuth();

  if (!user) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Bills &amp; Housing</h1>
      <p className="text-sm text-muted-foreground">
        Your housing tier determines daily rent, utilities, and vigor regen bonuses.
      </p>

      <div className="grid gap-3">
        {HOUSING_TIERS.map((ht) => {
          const utilities = UTILITIES_DAILY_COST[ht.tier] ?? 0;
          const totalDaily = ht.dailyRentCents + utilities;
          const isCurrent = user.housingTier === ht.tier;
          const canAfford = user.balanceCents >= totalDaily;

          return (
            <Card
              key={ht.tier}
              className={isCurrent ? 'border-primary ring-1 ring-primary/20' : ''}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{ht.name}</CardTitle>
                    {isCurrent && <Badge>Current</Badge>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatBlueth(totalDaily)}/day</p>
                    {ht.dailyRentCents > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Rent {formatBlueth(ht.dailyRentCents)} + Utils {formatBlueth(utilities)}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    {Object.keys(ht.regenBonuses).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(ht.regenBonuses).map(([k, v]) => (
                          <Badge key={k} variant="outline" className="text-xs text-green-600">
                            {VIGOR_LABELS[k as VigorKey]} +{v}/hr
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No regen bonuses</span>
                    )}
                  </div>
                  {!isCurrent && (
                    <Button
                      size="sm"
                      variant={ht.tier > user.housingTier ? 'default' : 'outline'}
                      disabled
                      title="Housing changes are applied automatically during the daily tick"
                    >
                      {ht.tier > user.housingTier ? (
                        <><ArrowUp className="h-3 w-3 mr-1" />Upgrade</>
                      ) : (
                        <><ArrowDown className="h-3 w-3 mr-1" />Downgrade</>
                      )}
                    </Button>
                  )}
                  {isCurrent && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                {!canAfford && !isCurrent && (
                  <p className="text-xs text-destructive mt-2">Cannot afford daily cost</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
