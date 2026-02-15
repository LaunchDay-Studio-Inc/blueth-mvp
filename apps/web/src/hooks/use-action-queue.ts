import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';

export interface ActionQueueItem {
  action_id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  scheduled_for: string;
  duration_seconds: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export function useActionQueue() {
  return useQuery({
    queryKey: queryKeys.actions.queue(),
    queryFn: () => api.get<ActionQueueItem[]>('/actions/queue'),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
