export const queryKeys = {
  player: {
    all: ['player'] as const,
    state: () => [...queryKeys.player.all, 'state'] as const,
  },
  actions: {
    all: ['actions'] as const,
    queue: () => [...queryKeys.actions.all, 'queue'] as const,
    history: () => [...queryKeys.actions.all, 'history'] as const,
  },
  market: {
    all: ['market'] as const,
    goods: () => [...queryKeys.market.all, 'goods'] as const,
    orderBook: (goodCode: string) => [...queryKeys.market.all, 'orderBook', goodCode] as const,
    trades: (goodCode: string) => [...queryKeys.market.all, 'trades', goodCode] as const,
  },
  business: {
    all: ['business'] as const,
    list: () => [...queryKeys.business.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.business.all, 'detail', id] as const,
    workers: (id: string) => [...queryKeys.business.all, 'workers', id] as const,
    jobs: (id: string) => [...queryKeys.business.all, 'jobs', id] as const,
    inventory: (id: string) => [...queryKeys.business.all, 'inventory', id] as const,
    recipes: () => [...queryKeys.business.all, 'recipes'] as const,
  },
};
