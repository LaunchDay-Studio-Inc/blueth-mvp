import { claimDueScheduledActions, resolveScheduledActionById } from './action-engine';
import { incrementMetric, logEvent, withTiming } from './observability';

export interface SchedulerWorkerOptions {
  batchSize?: number;
}

export async function runSchedulerIteration(options: SchedulerWorkerOptions = {}): Promise<number> {
  const batchSize = options.batchSize ?? 50;
  return withTiming('scheduler.iteration', async () => {
    const claimed = await claimDueScheduledActions(batchSize);
    incrementMetric('scheduler.actions.claimed', claimed.length);

    for (const action of claimed) {
      try {
        const outcome = await resolveScheduledActionById(action.action_id);
        if (outcome === 'completed') {
          incrementMetric('scheduler.actions.completed');
          logEvent('scheduler_action_completed', {
            action_id: action.action_id,
            player_id: action.player_id,
          });
        }
      } catch (error) {
        incrementMetric('scheduler.actions.failed');
        logEvent('scheduler_action_failed', {
          action_id: action.action_id,
          player_id: action.player_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return claimed.length;
  });
}

export async function startSchedulerWorker(intervalMs = 5000): Promise<void> {
  while (true) {
    await runSchedulerIteration();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
