'use client';

import { useOrderBook } from '@/hooks/use-market';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBlueth } from '@blueth/core';

interface OrderBookProps {
  goodCode: string;
}

export function OrderBook({ goodCode }: OrderBookProps) {
  const { data: entries, isLoading } = useOrderBook(goodCode);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Order Book</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const items = entries || [];
  const buys = items.filter((e) => e.side === 'buy').sort((a, b) => b.priceCents - a.priceCents);
  const sells = items.filter((e) => e.side === 'sell').sort((a, b) => a.priceCents - b.priceCents);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Order Book — {goodCode.replace(/_/g, ' ')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-medium text-green-600 mb-1">Buy Orders</p>
            {buys.length === 0 ? (
              <p className="text-muted-foreground">No buy orders</p>
            ) : (
              <div className="space-y-0.5">
                {buys.slice(0, 8).map((entry, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-green-600">{formatBlueth(entry.priceCents)}</span>
                    <span className="text-muted-foreground">{entry.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="font-medium text-red-600 mb-1">Sell Orders</p>
            {sells.length === 0 ? (
              <p className="text-muted-foreground">No sell orders</p>
            ) : (
              <div className="space-y-0.5">
                {sells.slice(0, 8).map((entry, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-red-600">{formatBlueth(entry.priceCents)}</span>
                    <span className="text-muted-foreground">{entry.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
