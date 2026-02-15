'use client';

import { useMarketGoods } from '@/hooks/use-market';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatBlueth } from '@blueth/core';

interface GoodsListProps {
  selectedCode: string;
  onSelect: (code: string) => void;
}

export function GoodsList({ selectedCode, onSelect }: GoodsListProps) {
  const { data: goods, isLoading } = useMarketGoods();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Goods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const items = goods || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Goods ({items.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="space-y-0.5">
          {items.map((good) => (
            <button
              key={good.goodCode}
              onClick={() => onSelect(good.goodCode)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                selectedCode === good.goodCode
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-accent text-foreground',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{good.goodCode.replace(/_/g, ' ')}</span>
                {good.halted && <Badge variant="destructive" className="text-[10px] ml-1">Halted</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ref: {formatBlueth(good.refPriceCents)}
                {good.lastTradePriceCents != null && (
                  <> | Last: {formatBlueth(good.lastTradePriceCents)}</>
                )}
              </p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
