'use client';

import { useState } from 'react';
import { GoodsList } from '@/components/market/goods-list';
import { OrderBook } from '@/components/market/order-book';
import { PriceChart } from '@/components/market/price-chart';
import { OrderForm } from '@/components/market/order-form';
import { MyOrders } from '@/components/market/my-orders';

export default function MarketPage() {
  const [selectedGood, setSelectedGood] = useState<string>('');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">BCE Market</h1>
      <p className="text-sm text-muted-foreground">
        Trade goods on the Blueth Commodity Exchange.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <GoodsList selectedCode={selectedGood} onSelect={setSelectedGood} />
        </div>

        <div className="lg:col-span-3 space-y-4">
          {selectedGood ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <OrderBook goodCode={selectedGood} />
                <PriceChart goodCode={selectedGood} />
              </div>
              <OrderForm goodCode={selectedGood} />
              <MyOrders goodCode={selectedGood} />
            </>
          ) : (
            <div className="flex items-center justify-center h-64 border rounded-lg text-muted-foreground">
              Select a good to view market data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
