import { withTransaction, queryOne, query, isTransientError } from '@blueth/db';
import {
  QueueLimitError,
  IdempotencyConflictError,
  ValidationError,
  InsufficientFundsError,
  InsufficientVigorError,
  DomainError,
} from '@blueth/core';
import { getHandler } from '../handlers/registry';
import type { PlayerStateRow } from '../handlers/registry';
import type { PoolClient } from 'pg';
import { detectRepeatedFailures } from './anomaly-service';
import { createLogger } from './observability';

const logger = createLogger('action-engine');

// ── Constants ────────────────────────────────────────────────

const QUEUE_MAX = 12;
const MIN_DURATION_SECONDS = 300;

// ── Types ────────────────────────────────────────────────────

export interface SubmitActionInput {
  playerId: string;
  type: string;
  payload: unknown;
  idempotencyKey: string;
}

export interface SubmitActionResult {
  actionId: string;
  status: string;
  scheduledFor: string;
  durationSeconds: number;
  result?: unknown;
  /** Populated on graceful failure with helpful recovery suggestions. */
  suggestions?: string[];
}

export interface ActionRow {
  action_id: string;
  player_id: string;
  type: string;
  payload: unknown;
  status: string;
  scheduled_for: string;
  duration_seconds: number;
  idempotency_key: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  failure_reason: string | null;
  result: unknown;
  retry_count: number;
}

// ── Helpers ──────────────────────────────────────────────────

export async function txQueryOne<T>(tx: PoolClient, text: string, params: unknown[]): Promise<T | null> {
  const { rows } = await tx.query(text, params);
  return (rows[0] as T) ?? null;
}

export function getPlayerStateRow(tx: PoolClient, playerId: string): Promise<PlayerStateRow | null> {
  return txQueryOne<PlayerStateRow>(
    tx,
    'SELECT * FROM player_state WHERE player_id = $1 FOR UPDATE',
    [playerId]
  );
}

// ── Graceful Failure Suggestions (D) ─────────────────────────

/**
 * Generate helpful recovery suggestions when an action fails.
 * The player is never left without options.
 */
function buildFailureSuggestions(error: unknown, actionType: string): string[] {
  const suggestions: string[] = [];

  if (error instanceof InsufficientFundsError) {
    suggestions.push('Take a work shift to earn money.');
    suggestions.push('Downgrade housing to reduce daily costs.');
    if (actionType === 'EAT_MEAL') {
      suggestions.push('Try a cheaper meal (Street Food costs only ₿3).');
    }
    suggestions.push('Check the market for selling goods you own.');
  } else if (error instanceof InsufficientVigorError) {
    suggestions.push('Sleep to regenerate vigor.');
    suggestions.push('Eat a meal for vigor buffs.');
    if (error.dimension === 'mv') {
      suggestions.push('Leisure activity restores MV +4 instantly.');
    }
    if (error.dimension === 'sv') {
      suggestions.push('Social call restores SV +3 instantly.');
    }
  } else if (error instanceof QueueLimitError) {
    suggestions.push('Wait for current actions to complete.');
    suggestions.push('Cancel unnecessary queued actions.');
  }

  // Always remind: sleep and basic meals are always available
  if (suggestions.length === 0) {
    suggestions.push('You can always sleep or eat a basic meal.');
  }

  return suggestions;
}

// ── Submit Action ────────────────────────────────────────────

export async function submitAction(input: SubmitActionInput): Promise<SubmitActionResult> {
  const { playerId, type, idempotencyKey } = input;

  // 1. Look up handler
  const handler = getHandler(type);

  // 2. Validate payload
  const payload = handler.validatePayload(input.payload);

  // 3. Validate duration
  const durationSeconds = handler.durationSeconds(payload);
  if (durationSeconds > 0 && durationSeconds < MIN_DURATION_SECONDS) {
    throw new ValidationError(
      `Action duration must be at least ${MIN_DURATION_SECONDS} seconds, got ${durationSeconds}`
    );
  }

  // 4. Idempotency check (fast path, outside transaction)
  const existing = await queryOne<ActionRow>(
    'SELECT * FROM actions WHERE player_id = $1 AND idempotency_key = $2',
    [playerId, idempotencyKey]
  );

  if (existing) {
    if (existing.type !== type) {
      throw new IdempotencyConflictError(idempotencyKey);
    }
    // Verify payload matches (same key + type but different payload is a conflict).
    // Canonicalise: strip undefined, sort keys (jsonb reorders keys alphabetically).
    const canonical = (p: unknown): string => {
      const obj = JSON.parse(JSON.stringify(p ?? {})) as Record<string, unknown>;
      return JSON.stringify(obj, Object.keys(obj).sort());
    };
    if (canonical(existing.payload) !== canonical(payload)) {
      throw new IdempotencyConflictError(idempotencyKey);
    }
    return {
      actionId: existing.action_id,
      status: existing.status,
      scheduledFor: existing.scheduled_for,
      durationSeconds: existing.duration_seconds,
      result: existing.result,
    };
  }

  // 5. Transaction: lock, validate, insert, optionally resolve
  try {
    return await withTransaction(async (tx) => {
      // a. Lock player state
      const lockedState = await getPlayerStateRow(tx, playerId);
      if (!lockedState) {
        throw new ValidationError('Player state not found');
      }

      // b. Check queue limit
      const queueCountRow = await txQueryOne<{ count: string }>(
        tx,
        `SELECT COUNT(*) as count FROM actions
         WHERE player_id = $1 AND status IN ('pending', 'scheduled', 'running')`,
        [playerId]
      );
      const queueCount = parseInt(queueCountRow?.count ?? '0', 10);
      if (queueCount >= QUEUE_MAX) {
        throw new QueueLimitError(QUEUE_MAX);
      }

      // c. Re-validate preconditions with locked state
      handler.checkPreconditions(payload, lockedState);

      // d. Calculate scheduled_for
      const scheduledForRow = await txQueryOne<{ scheduled_for: string }>(
        tx,
        `SELECT GREATEST(
           NOW(),
           COALESCE(
             (SELECT MAX(scheduled_for + (duration_seconds || ' seconds')::interval)
              FROM actions
              WHERE player_id = $1
              AND status IN ('pending', 'scheduled', 'running')),
             NOW()
           )
         ) AS scheduled_for`,
        [playerId]
      );
      const scheduledFor = scheduledForRow!.scheduled_for;

      // e. Insert action
      const status = durationSeconds === 0 ? 'pending' : 'scheduled';
      const actionRow = await txQueryOne<ActionRow>(
        tx,
        `INSERT INTO actions (player_id, type, payload, status, scheduled_for, duration_seconds, idempotency_key)
         VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7)
         RETURNING *`,
        [playerId, type, JSON.stringify(payload), status, scheduledFor, durationSeconds, idempotencyKey]
      );
      if (!actionRow) throw new Error('Failed to insert action');

      // f. On-submit hook (e.g., SLEEP sets sleep_state='sleeping')
      if (handler.onSubmit) {
        await handler.onSubmit({ tx, playerId, payload, playerState: lockedState });
      }

      // g. Instant resolution (duration === 0)
      if (durationSeconds === 0) {
        const result = await resolveActionInTx(tx, actionRow, lockedState);
        return {
          actionId: actionRow.action_id,
          status: 'completed',
          scheduledFor: actionRow.scheduled_for,
          durationSeconds: 0,
          result,
        };
      }

      // h. Return scheduled
      return {
        actionId: actionRow.action_id,
        status: 'scheduled',
        scheduledFor: actionRow.scheduled_for,
        durationSeconds,
      };
    });
  } catch (err) {
    // Handle idempotency race: if two concurrent requests pass the fast-path check,
    // the second INSERT hits the UNIQUE(player_id, idempotency_key) constraint.
    // Catch Postgres error 23505 and return the cached result instead of a 500.
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      const raced = await queryOne<ActionRow>(
        'SELECT * FROM actions WHERE player_id = $1 AND idempotency_key = $2',
        [playerId, idempotencyKey]
      );
      if (raced) {
        return {
          actionId: raced.action_id,
          status: raced.status,
          scheduledFor: raced.scheduled_for,
          durationSeconds: raced.duration_seconds,
          result: raced.result,
        };
      }
    }
    // D) Graceful failure: augment domain errors with recovery suggestions
    if (err instanceof DomainError) {
      const suggestions = buildFailureSuggestions(err, type);
      // Rethrow augmented with suggestions context in the message
      const augmented = err as DomainError & { suggestions?: string[] };
      augmented.suggestions = suggestions;
      throw augmented;
    }
    throw err;
  }
}

// ── Resolve a single action within a transaction ─────────────

export async function resolveActionInTx(
  tx: PoolClient,
  actionRow: ActionRow,
  lockedState: PlayerStateRow
): Promise<unknown> {
  const handler = getHandler(actionRow.type);
  const payload = handler.validatePayload(actionRow.payload);

  // Mark running
  await tx.query(
    `UPDATE actions SET status = 'running', started_at = NOW() WHERE action_id = $1`,
    [actionRow.action_id]
  );

  // Re-check preconditions with locked state (state may have changed since submit).
  // Skip for SLEEP: it sets sleep_state at submit time, so the recheck would self-conflict.
  if (actionRow.type !== 'SLEEP') {
    try {
      handler.checkPreconditions(payload, lockedState);
    } catch (err) {
      if (err instanceof DomainError) {
        await tx.query(
          `UPDATE actions SET status = 'failed', finished_at = NOW(), result = $2 WHERE action_id = $1`,
          [actionRow.action_id, JSON.stringify({ error: err.message, code: err.code })]
        );
        return null;
      }
      throw err;
    }
  }

  // Get player wallet account_id
  const wallet = await txQueryOne<{ account_id: string }>(
    tx,
    'SELECT account_id FROM player_wallets WHERE player_id = $1',
    [actionRow.player_id]
  );
  const playerAccountId = wallet ? parseInt(wallet.account_id, 10) : 0;

  try {
    // Execute handler
    const result = await handler.resolve({
      tx,
      actionId: actionRow.action_id,
      playerId: actionRow.player_id,
      payload,
      playerState: lockedState,
      playerAccountId,
    });

    // Mark completed
    await tx.query(
      `UPDATE actions SET status = 'completed', finished_at = NOW(), result = $2 WHERE action_id = $1`,
      [actionRow.action_id, JSON.stringify(result)]
    );

    return result;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const MAX_ACTION_RETRIES = 3;

    // Dead letter: transient errors with retry budget get re-scheduled
    if (isTransientError(err) && actionRow.retry_count < MAX_ACTION_RETRIES) {
      await tx.query(
        `UPDATE actions SET status = 'scheduled', started_at = NULL,
         retry_count = retry_count + 1, failure_reason = $2
         WHERE action_id = $1`,
        [actionRow.action_id, `Transient retry ${actionRow.retry_count + 1}: ${reason}`]
      );
      throw err;
    }

    // Permanent failure: mark as failed with reason
    await tx.query(
      `UPDATE actions SET status = 'failed', finished_at = NOW(),
       failure_reason = $2, result = $3
       WHERE action_id = $1`,
      [
        actionRow.action_id,
        reason,
        JSON.stringify({
          error: reason,
          suggestions: err instanceof DomainError
            ? buildFailureSuggestions(err, actionRow.type)
            : ['You can always sleep or eat a basic meal.'],
        }),
      ]
    );

    // E) Non-blocking anomaly detection on failure
    detectRepeatedFailures(actionRow.player_id).catch(() => {});

    throw err;
  }
}

// ── Lazy resolution: resolve all due actions for a player ────

export async function resolveAllDue(playerId: string): Promise<void> {
  // Find all scheduled actions whose time has come
  const dueActions = await query<ActionRow>(
    `SELECT * FROM actions
     WHERE player_id = $1
     AND status = 'scheduled'
     AND (scheduled_for + (duration_seconds || ' seconds')::interval) <= NOW()
     ORDER BY scheduled_for ASC`,
    [playerId]
  );

  for (const actionRow of dueActions) {
    // Each action resolves in its own transaction
    try {
      await withTransaction(async (tx) => {
        // Re-lock action under transaction (another request may have resolved it)
        const locked = await txQueryOne<ActionRow>(
          tx,
          'SELECT * FROM actions WHERE action_id = $1 FOR UPDATE',
          [actionRow.action_id]
        );
        if (!locked || locked.status !== 'scheduled') return;

        // Lock player state
        const lockedState = await getPlayerStateRow(tx, playerId);
        if (!lockedState) return;

        await resolveActionInTx(tx, locked, lockedState);
      });
    } catch (err) {
      // Log but continue processing other actions
      logger.error('Action resolution failed', {
        actionId: actionRow.action_id,
        playerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ── Query functions ──────────────────────────────────────────

export async function getActionById(actionId: string, playerId: string): Promise<ActionRow | null> {
  return queryOne<ActionRow>(
    'SELECT * FROM actions WHERE action_id = $1 AND player_id = $2',
    [actionId, playerId]
  );
}

export async function getActionQueue(playerId: string): Promise<ActionRow[]> {
  return query<ActionRow>(
    `SELECT * FROM actions
     WHERE player_id = $1
     AND status IN ('pending', 'scheduled', 'running')
     ORDER BY scheduled_for ASC`,
    [playerId]
  );
}

/**
 * Get recent completed/failed actions (history) for display.
 * Returns last N actions ordered by most recent finished first.
 */
export async function getActionHistory(playerId: string, limit = 20): Promise<ActionRow[]> {
  return query<ActionRow>(
    `SELECT * FROM actions
     WHERE player_id = $1
     AND status IN ('completed', 'failed')
     ORDER BY finished_at DESC NULLS LAST
     LIMIT $2`,
    [playerId, limit]
  );
}

/**
 * Get the queue end time (when the last queued action completes).
 * Used for projection calculations.
 */
export async function getQueueEndTime(playerId: string): Promise<Date> {
  const row = await queryOne<{ end_time: string }>(
    `SELECT GREATEST(
       NOW(),
       COALESCE(
         (SELECT MAX(scheduled_for + (duration_seconds || ' seconds')::interval)
          FROM actions
          WHERE player_id = $1
          AND status IN ('pending', 'scheduled', 'running')),
         NOW()
       )
     ) AS end_time`,
    [playerId]
  );
  return new Date(row?.end_time ?? Date.now());
}
