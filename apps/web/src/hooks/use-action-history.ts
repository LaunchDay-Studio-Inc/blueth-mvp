import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';

export interface ActionHistoryItem {
  action_id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  scheduled_for: string | null;
  duration_seconds: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  failure_reason: string | null;
}

export function useActionHistory() {
  return useQuery({
    queryKey: queryKeys.actions.history(),
    queryFn: () => api.get<ActionHistoryItem[]>('/actions/history'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
