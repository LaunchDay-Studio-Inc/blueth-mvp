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
  scheduledFor?: string;
  durationSeconds?: number;
  result?: unknown;
}

const ACTION_LABELS: Record<string, string> = {
  WORK_SHIFT: 'Work shift',
  GIG_JOB: 'Gig',
  EAT_MEAL: 'Eat meal',
  LEISURE: 'Leisure',
  SOCIAL_CALL: 'Social call',
  SLEEP: 'Sleep',
  MARKET_PLACE_ORDER: 'Market order',
  MARKET_CANCEL_ORDER: 'Cancel order',
  MARKET_DAY_TRADE_SESSION: 'Day trade',
  BUSINESS_REGISTER: 'Register business',
  BUSINESS_RENT_LOCATION: 'Rent location',
  BUSINESS_BUY_MACHINERY: 'Buy machinery',
  BUSINESS_HIRE_SESSION: 'Hire session',
  BUSINESS_PLAN_PRODUCTION: 'Plan production',
  BUSINESS_START_PRODUCTION: 'Start production',
  BUSINESS_SELL_OUTPUTS: 'Sell outputs',
};

function friendlyLabel(type: string): string {
  return ACTION_LABELS[type] ?? type.replace(/_/g, ' ').toLowerCase();
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
    onSuccess: async (data, variables) => {
      const label = friendlyLabel(variables.type);
      if (data.durationSeconds && data.durationSeconds > 0 && data.scheduledFor) {
        const endsAt = new Date(
          new Date(data.scheduledFor).getTime() + data.durationSeconds * 1000,
        );
        const endTime = endsAt.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        toast.success(`Queued: ${label} — ends at ${endTime}`);
      } else {
        toast.success(`${label} completed`);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.player.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.actions.all }),
      ]);
    },
    onError: (error, variables) => {
      const label = friendlyLabel(variables.type);
      if (error instanceof ApiError) {
        if (error.statusCode === 0) {
          toast.error(`${label} failed: Network error — check your connection`);
        } else if (error.statusCode === 401) {
          toast.error(`${label} failed: Session expired — please log in again`);
        } else if (error.statusCode >= 500) {
          toast.error(`${label} failed: Server error (${error.statusCode}) — try again later`);
        } else {
          toast.error(`${label} failed: ${error.message}`);
        }
      } else {
        toast.error(`${label} failed: Something went wrong`);
      }
    },
  });
}
