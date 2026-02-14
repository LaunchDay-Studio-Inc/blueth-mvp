import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import type { PlayerStateData } from '@/lib/auth-context';

export function usePlayerState() {
  return useQuery({
    queryKey: queryKeys.player.state(),
    queryFn: () => api.get<PlayerStateData>('/me/state'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
