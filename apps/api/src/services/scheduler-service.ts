/**
 * Scheduler Service — Claims and resolves due scheduled actions.
 *
 * Uses FOR UPDATE SKIP LOCKED to allow multiple concurrent instances
 * without deadlocks. Each claimed action is resolved in its own
 * transaction for isolation.
 */

import { withTransaction, execute, query } from '@blueth/db';
import {
  resolveActionInTx,
  txQueryOne,
  getPlayerStateRow,
} from './action-engine';
import type { ActionRow } from './action-engine';
import type { Metrics } from './observability';
import { createLogger } from './observability';

const logger = createLogger('scheduler');

// ── Claim Due Scheduled Actions ──────────────────────────────

/**
 * Atomically claim a batch of due scheduled actions.
 * Sets their status to 'running' and returns the rows.
 *
 * Uses FOR UPDATE SKIP LOCKED so concurrent workers claim
 * disjoint sets.
 */
export async function claimDueScheduledActions(limit = 50): Promise<ActionRow[]> {
  return query<ActionRow>(
    `UPDATE actions
     SET status = 'running', started_at = NOW()
     WHERE action_id IN (
       SELECT action_id FROM actions
       WHERE status = 'scheduled'
         AND retry_count < 3
         AND (scheduled_for + (duration_seconds || ' seconds')::interval) <= NOW()
       ORDER BY scheduled_for ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [limit]
  );
}

// ── Resolve a Single Claimed Action ──────────────────────────

/**
 * Resolve a single claimed action (status already set to 'running').
 * Locks the action row and player state, then delegates to the
 * existing resolveActionInTx from the action engine.
 *
 * On failure, marks the action as 'failed' with the error message.
 */
export async function resolveScheduledActionById(
  actionId: string
): Promise<{ resolved: boolean; error?: string }> {
  try {
    await withTransaction(async (tx) => {
      // Re-lock action row and verify it's still running
      const action = await txQueryOne<ActionRow>(
        tx,
        'SELECT * FROM actions WHERE action_id = $1 AND status = $2 FOR UPDATE',
        [actionId, 'running']
      );
      if (!action) return; // Already resolved or cancelled

      // Lock player state
      const lockedState = await getPlayerStateRow(tx, action.player_id);
      if (!lockedState) {
        await tx.query(
          `UPDATE actions SET status = 'failed', finished_at = NOW(), failure_reason = $2
           WHERE action_id = $1`,
          [actionId, 'Player state not found']
        );
        return;
      }

      await resolveActionInTx(tx, action, lockedState);
    });
    return { resolved: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Mark action as failed outside the rolled-back transaction
    await execute(
      `UPDATE actions SET status = 'failed', finished_at = NOW(), failure_reason = $2
       WHERE action_id = $1 AND status = 'running'`,
      [actionId, errorMsg]
    );
    return { resolved: false, error: errorMsg };
  }
}

// ── Single Scheduler Iteration ───────────────────────────────

/**
 * Run one iteration of the scheduler loop:
 * 1. Claim a batch of due scheduled actions
 * 2. Resolve each one sequentially
 * 3. Return summary counts
 */
export async function runSchedulerIteration(
  metrics: Metrics
): Promise<{ claimed: number; resolved: number; failed: number }> {
  const claimed = await claimDueScheduledActions();
  let resolved = 0;
  let failed = 0;

  for (const action of claimed) {
    const result = await resolveScheduledActionById(action.action_id);
    if (result.resolved) {
      resolved++;
      metrics.increment('scheduler_resolved');
    } else {
      failed++;
      metrics.increment('scheduler_failed');
      logger.warn('Action resolution failed', {
        actionId: action.action_id,
        playerId: action.player_id,
        error: result.error,
      });
    }
  }

  metrics.increment('scheduler_claimed', claimed.length);
  return { claimed: claimed.length, resolved, failed };
}
