'use client';

import { useState } from 'react';
import { useSubmitAction } from '@/hooks/use-submit-action';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

interface OrderFormProps {
  goodCode: string;
}

export function OrderForm({ goodCode }: OrderFormProps) {
  const submitAction = useSubmitAction();
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');

  function handleSubmit() {
    const priceCents = Math.round(parseFloat(price) * 100);
    const quantity = parseInt(qty, 10);
    if (isNaN(priceCents) || priceCents <= 0 || isNaN(quantity) || quantity <= 0) return;

    submitAction.mutate({
      type: 'MARKET_PLACE_ORDER',
      payload: {
        goodCode,
        side,
        orderType: 'limit',
        priceCents,
        qty: quantity,
      },
    });

    setPrice('');
    setQty('');
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Place Order — {goodCode.replace(/_/g, ' ')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={side} onValueChange={(v) => setSide(v as 'buy' | 'sell')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="buy">Buy</TabsTrigger>
            <TabsTrigger value="sell">Sell</TabsTrigger>
          </TabsList>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Price (BCE)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity</Label>
              <Input
                type="number"
                step="1"
                min="1"
                placeholder="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </div>

          <Button
            className="w-full mt-3"
            variant={side === 'buy' ? 'default' : 'destructive'}
            onClick={handleSubmit}
            disabled={submitAction.isPending || !price || !qty}
          >
            {submitAction.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {side === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}
          </Button>
        </Tabs>
      </CardContent>
    </Card>
  );
}
