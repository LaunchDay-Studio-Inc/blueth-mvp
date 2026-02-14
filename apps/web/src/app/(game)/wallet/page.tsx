'use client';

import { useAuth } from '@/lib/auth-context';
import { MoneyDisplay } from '@/components/money-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { HOUSING_TIERS, UTILITIES_DAILY_COST, formatBlueth } from '@blueth/core';
import { Wallet, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function WalletPage() {
  const { user } = useAuth();

  if (!user) {
    return <Skeleton className="h-96 w-full" />;
  }

  const housingTier = HOUSING_TIERS[user.housingTier] ?? HOUSING_TIERS[0];
  const utilities = UTILITIES_DAILY_COST[user.housingTier] ?? 0;
  const dailyBurn = housingTier.dailyRentCents + utilities;
  const daysAffordable = dailyBurn > 0 ? Math.floor(user.balanceCents / dailyBurn) : Infinity;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Wallet</h1>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Balance</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <MoneyDisplay cents={user.balanceCents} size="lg" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            <CardTitle className="text-lg">Daily Costs</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Housing ({housingTier.name})</span>
            <span>{formatBlueth(housingTier.dailyRentCents)}/day</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Utilities</span>
            <span>{formatBlueth(utilities)}/day</span>
          </div>
          <Separator />
          <div className="flex justify-between font-medium">
            <span>Total Daily Burn</span>
            <span>{formatBlueth(dailyBurn)}/day</span>
          </div>
          {dailyBurn > 0 && (
            <p className="text-xs text-muted-foreground">
              At current spending, you can afford {daysAffordable} more day{daysAffordable !== 1 ? 's' : ''}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ledger entries will appear here once the transaction history API is available.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
