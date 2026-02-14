import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';

export interface MarketGood {
  goodCode: string;
  refPriceCents: number;
  lastTradePriceCents: number | null;
  halted: boolean;
  haltedUntil: string | null;
}

export interface OrderBookEntry {
  priceCents: number;
  qty: number;
  side: 'buy' | 'sell';
}

export interface TradeEntry {
  id: string;
  goodCode: string;
  priceCents: number;
  qty: number;
  side: string;
  createdAt: string;
}

export function useMarketGoods() {
  return useQuery({
    queryKey: queryKeys.market.goods(),
    queryFn: () => api.get<MarketGood[]>('/market/goods'),
    refetchInterval: 30_000,
  });
}

export function useOrderBook(goodCode: string) {
  return useQuery({
    queryKey: queryKeys.market.orderBook(goodCode),
    queryFn: () => api.get<OrderBookEntry[]>(`/market/order-book/${goodCode}`),
    enabled: !!goodCode,
    refetchInterval: 15_000,
  });
}

export function useTradeHistory(goodCode: string) {
  return useQuery({
    queryKey: queryKeys.market.trades(goodCode),
    queryFn: () => api.get<TradeEntry[]>(`/market/trades/${goodCode}`),
    enabled: !!goodCode,
    refetchInterval: 30_000,
  });
}
