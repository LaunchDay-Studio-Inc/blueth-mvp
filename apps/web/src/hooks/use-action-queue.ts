import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';

export interface ActionQueueItem {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  scheduledFor: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export function useActionQueue() {
  return useQuery({
    queryKey: queryKeys.actions.queue(),
    queryFn: () => api.get<ActionQueueItem[]>('/actions/queue'),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
