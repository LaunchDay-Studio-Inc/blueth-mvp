import { withTransaction, queryOne, query } from '@blueth/db';
import {
  QueueLimitError,
  IdempotencyConflictError,
  ValidationError,
} from '@blueth/core';
import { getHandler } from '../handlers/registry';
import type { PlayerStateRow } from '../handlers/registry';
import type { PoolClient } from 'pg';

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
}

// ── Helpers ──────────────────────────────────────────────────

async function txQueryOne<T>(tx: PoolClient, text: string, params: unknown[]): Promise<T | null> {
  const { rows } = await tx.query(text, params);
  return (rows[0] as T) ?? null;
}

function getPlayerStateRow(tx: PoolClient, playerId: string): Promise<PlayerStateRow | null> {
  return txQueryOne<PlayerStateRow>(
    tx,
    'SELECT * FROM player_state WHERE player_id = $1 FOR UPDATE',
    [playerId]
  );
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
    return {
      actionId: existing.action_id,
      status: existing.status,
      scheduledFor: existing.scheduled_for,
      durationSeconds: existing.duration_seconds,
      result: existing.result,
    };
  }

  // 5. Transaction: lock, validate, insert, optionally resolve
  return withTransaction(async (tx) => {
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
}

// ── Resolve a single action within a transaction ─────────────

async function resolveActionInTx(
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

  // Get player wallet account_id
  const wallet = await txQueryOne<{ account_id: string }>(
    tx,
    'SELECT account_id FROM player_wallets WHERE player_id = $1',
    [actionRow.player_id]
  );
  const playerAccountId = wallet ? parseInt(wallet.account_id, 10) : 0;

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
