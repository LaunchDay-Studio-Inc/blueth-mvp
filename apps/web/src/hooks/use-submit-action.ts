import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, generateIdempotencyKey } from '@/lib/api';
import { queryKeys } from '@/lib/queries';

interface SubmitActionParams {
  type: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}

interface ActionResult {
  actionId: string;
  status: string;
  result?: unknown;
}

export function useSubmitAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SubmitActionParams) => {
      return api.post<ActionResult>('/actions', {
        type: params.type,
        payload: params.payload || {},
        idempotencyKey: params.idempotencyKey || generateIdempotencyKey(),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.player.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.actions.all }),
      ]);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('Something went wrong');
      }
    },
  });
}
