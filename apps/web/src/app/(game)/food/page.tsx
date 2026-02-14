'use client';

import { useAuth } from '@/lib/auth-context';
import { useSubmitAction } from '@/hooks/use-submit-action';
import { ActionCard } from '@/components/action-card';
import { Badge } from '@/components/ui/badge';
import { MEAL_DEFINITIONS, type MealQuality } from '@blueth/core';
import { MEAL_LABELS, MEAL_PRICES_CENTS } from '@/lib/constants';
import { UtensilsCrossed, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const MEAL_QUALITIES: MealQuality[] = [
  'STREET_FOOD',
  'HOME_COOKED',
  'RESTAURANT',
  'FINE_DINING',
  'NUTRIENT_OPTIMAL',
];

export default function FoodPage() {
  const { user } = useAuth();
  const submitAction = useSubmitAction();

  if (!user) {
    return <Skeleton className="h-96 w-full" />;
  }

  function handleEat(quality: MealQuality) {
    submitAction.mutate({
      type: 'EAT_MEAL',
      payload: { mealQuality: quality },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Food</h1>
        <Badge variant="secondary">
          {user.mealsEatenToday}/3 meals today
        </Badge>
      </div>

      {user.mealPenaltyLevel > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Meal penalty level {user.mealPenaltyLevel}: Regen rates reduced. Eat 3 meals daily to recover.
          </span>
        </div>
      )}

      <div className="grid gap-3">
        {MEAL_QUALITIES.map((quality) => {
          const def = MEAL_DEFINITIONS[quality];
          const price = MEAL_PRICES_CENTS[quality];
          const canAfford = user.balanceCents >= price;

          const bonusDesc = Object.entries(def.perHourBonusByDim)
            .map(([k, v]) => `${(k as string).toUpperCase()} +${v}/hr`)
            .join(', ');

          return (
            <ActionCard
              key={quality}
              title={MEAL_LABELS[quality]}
              description={`${bonusDesc} for ${def.durationHours}h`}
              icon={UtensilsCrossed}
              moneyCostCents={price}
              duration={`${def.durationHours}h buff`}
              disabled={!canAfford}
              loading={submitAction.isPending}
              onClick={() => handleEat(quality)}
            >
              {def.instantDelta && (
                <p className="text-xs text-green-600 mt-1">
                  Instant: {Object.entries(def.instantDelta)
                    .map(([k, v]) => `${(k as string).toUpperCase()} +${v}`)
                    .join(', ')}
                </p>
              )}
              {!canAfford && (
                <p className="text-xs text-destructive mt-1">Not enough money</p>
              )}
            </ActionCard>
          );
        })}
      </div>
    </div>
  );
}
