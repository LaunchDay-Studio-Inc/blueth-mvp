'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';

export interface ActionProjection {
  vigorDelta: Partial<Record<string, number>>;
  vigorAfter: Record<string, number>;
  moneyCostCents: number;
  moneyGainCents: number;
  durationSeconds: number;
  completionTime: string;
  warnings: string[];
  softGates: {
    mvSlippage: number;
    svServiceMult: number;
    cvFeeMult: number;
    cvSpeedMult: number;
    spvRegenMult: number;
  };
}

/**
 * Fetch action preview/projection from the API.
 * Only queries when type is provided (enabled guard).
 */
export function useActionPreview(type: string | null, payload: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [...queryKeys.actions.all, 'preview', type, JSON.stringify(payload)],
    queryFn: () =>
      api.post<ActionProjection>('/actions/preview', {
        type,
        payload,
        idempotencyKey: 'preview', // not used for preview, but required by schema
      }),
    enabled: !!type,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}
