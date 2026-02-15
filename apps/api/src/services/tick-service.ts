/**
 * Tick Service — Creates and processes game ticks.
 *
 * Tick types:
 *   hourly    — Vigor regen, buff expiry
 *   six_hour  — NPC market refresh (placeholder)
 *   daily     — Meal penalty reset, rent processing, daily summary
 *
 * Uses the ticks table (UNIQUE on tick_type + tick_timestamp) for
 * idempotency. FOR UPDATE SKIP LOCKED enables concurrent workers.
 * Per-player transactions minimize lock duration.
 */

import { withTransaction, query, queryOne, execute, transferCents } from '@blueth/db';
import {
  applyHourlyVigorTick,
  applyDailyReset,
  addVigor,
  processRent,
  getLocalDate,
  SYSTEM_ACCOUNTS,
} from '@blueth/core';
import type { VigorState } from '@blueth/core';
import { extractVigor, extractCaps } from '../handlers/registry';
import type { PlayerStateRow } from '../handlers/registry';
import { txQueryOne } from './action-engine';
import { runAnomalyDetection } from './anomaly-service';
import { createLogger } from './observability';
import type { Metrics } from './observability';
import type { PoolClient } from 'pg';

const logger = createLogger('tick');
const PLAYER_BATCH_SIZE = 100;

// ── Types ────────────────────────────────────────────────────

interface TickRow {
  tick_id: string;
  tick_type: string;
  tick_timestamp: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  detail: unknown;
}

interface PlayerStateWithTimezone extends PlayerStateRow {
  timezone: string;
}

// ── Tick Window Helpers ──────────────────────────────────────

const TICK_TYPES = ['hourly', 'six_hour', 'daily'] as const;

/**
 * Floor a Date to the start of its tick window.
 */
export function floorToTickWindow(now: Date, tickType: string): Date {
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setMinutes(0);

  if (tickType === 'hourly') {
    // Already floored to hour
  } else if (tickType === 'six_hour') {
    d.setHours(Math.floor(d.getHours() / 6) * 6);
  } else if (tickType === 'daily') {
    d.setHours(0);
  }

  return d;
}

// ── Tick Creation ────────────────────────────────────────────

/**
 * Ensure tick rows exist for the current time windows.
 * Uses INSERT ... ON CONFLICT DO NOTHING for idempotency.
 */
export async function ensureTicksCreated(now: Date): Promise<void> {
  for (const tickType of TICK_TYPES) {
    const tickTimestamp = floorToTickWindow(now, tickType);
    await execute(
      `INSERT INTO ticks (tick_type, tick_timestamp, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (tick_type, tick_timestamp) DO NOTHING`,
      [tickType, tickTimestamp.toISOString()]
    );
  }
}

// ── Tick Claiming ────────────────────────────────────────────

/**
 * Atomically claim one pending tick for processing.
 * Returns the tick row or null if none available.
 */
export async function claimTick(): Promise<TickRow | null> {
  const rows = await query<TickRow>(
    `UPDATE ticks
     SET status = 'running', started_at = NOW()
     WHERE tick_id = (
       SELECT tick_id FROM ticks
       WHERE status = 'pending'
       ORDER BY tick_timestamp ASC, tick_type ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`
  );
  return rows[0] ?? null;
}

// ── Tick Completion ──────────────────────────────────────────

async function completeTick(tickId: string, detail: unknown): Promise<void> {
  await execute(
    `UPDATE ticks SET status = 'completed', finished_at = NOW(), detail = $2
     WHERE tick_id = $1`,
    [tickId, JSON.stringify(detail)]
  );
}

async function failTick(tickId: string, error: string): Promise<void> {
  // Read existing detail to preserve retry count
  const existing = await queryOne<{ detail: { retryCount?: number } | null }>(
    'SELECT detail FROM ticks WHERE tick_id = $1',
    [tickId]
  );
  const prevRetryCount = existing?.detail?.retryCount ?? 0;

  await execute(
    `UPDATE ticks SET status = 'failed', finished_at = NOW(), detail = $2
     WHERE tick_id = $1`,
    [tickId, JSON.stringify({ error, retryCount: prevRetryCount + 1 })]
  );
}

/**
 * Reset stale failed ticks back to pending for retry.
 * Only retries ticks that have failed fewer than 3 times (tracked in detail.retryCount).
 * Ticks that have exhausted retries stay in 'failed' status permanently.
 */
export async function resetStaleFailedTicks(): Promise<number> {
  const count = await execute(
    `UPDATE ticks SET status = 'pending', started_at = NULL, finished_at = NULL
     WHERE status = 'failed'
       AND finished_at < NOW() - interval '2 minutes'
       AND COALESCE((detail->>'retryCount')::int, 0) < 3`
  );
  if (count > 0) {
    logger.info('Reset stale failed ticks for retry', { count });
  }
  return count;
}

// ── VigorState Builder ───────────────────────────────────────

function buildVigorState(row: PlayerStateRow): VigorState {
  return {
    vigor: extractVigor(row),
    caps: extractCaps(row),
    sleepState: row.sleep_state,
    activeBuffs: row.active_buffs ?? [],
    lastMealTimes: row.last_meal_times ?? [],
    mealsEatenToday: row.meal_day_count,
    mealPenaltyLevel: row.meal_penalty_level,
    lastDailyResetLocalDate: row.last_daily_reset,
  };
}

// ── Hourly Tick ──────────────────────────────────────────────

/**
 * Process hourly vigor tick for all players in batches.
 * Each player is processed in its own transaction.
 */
export async function processHourlyTick(
  tickTimestamp: Date,
  metrics: Metrics
): Promise<{ playersProcessed: number; errors: number }> {
  let cursor = '00000000-0000-0000-0000-000000000000';
  let playersProcessed = 0;
  let errors = 0;

  while (true) {
    const batch = await query<PlayerStateWithTimezone>(
      `SELECT ps.*, p.timezone
       FROM player_state ps
       JOIN players p ON ps.player_id = p.id
       WHERE ps.player_id > $1
       ORDER BY ps.player_id ASC
       LIMIT $2`,
      [cursor, PLAYER_BATCH_SIZE]
    );

    if (batch.length === 0) break;

    for (const row of batch) {
      try {
        await processHourlyTickForPlayer(row, tickTimestamp);
        playersProcessed++;
        metrics.increment('hourly_players_processed');
      } catch (err) {
        errors++;
        metrics.increment('hourly_player_errors');
        logger.error('Hourly tick failed for player', {
          playerId: row.player_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    cursor = batch[batch.length - 1].player_id;
  }

  return { playersProcessed, errors };
}

async function processHourlyTickForPlayer(
  row: PlayerStateWithTimezone,
  tickTimestamp: Date
): Promise<void> {
  await withTransaction(async (tx) => {
    // Re-lock player state within transaction
    const locked = await txQueryOne<PlayerStateRow>(
      tx,
      'SELECT * FROM player_state WHERE player_id = $1 FOR UPDATE',
      [row.player_id]
    );
    if (!locked) return;

    const vigorState = buildVigorState(locked);
    const { newState } = applyHourlyVigorTick(
      vigorState,
      tickTimestamp.toISOString(),
      row.timezone || 'Asia/Dubai'
    );

    await tx.query(
      `UPDATE player_state
       SET pv = $2, mv = $3, sv = $4, cv = $5, spv = $6,
           active_buffs = $7, updated_at = NOW()
       WHERE player_id = $1`,
      [
        row.player_id,
        Math.round(newState.vigor.pv),
        Math.round(newState.vigor.mv),
        Math.round(newState.vigor.sv),
        Math.round(newState.vigor.cv),
        Math.round(newState.vigor.spv),
        JSON.stringify(newState.activeBuffs),
      ]
    );
  });
}

// ── Six-Hourly Tick ──────────────────────────────────────────

/**
 * NPC market refresh: update demand/supply, ref prices, and NPC maker orders.
 */
export async function processSixHourTick(
  tickTimestamp: Date,
  metrics: Metrics
): Promise<void> {
  const { refreshNpcMarketOrders } = await import('./market-service');

  logger.info('Six-hour tick: NPC market refresh starting', {
    tickType: 'six_hour',
    tickTimestamp: tickTimestamp.toISOString(),
  });

  const result = await refreshNpcMarketOrders();

  logger.info('Six-hour tick: NPC market refresh complete', {
    tickType: 'six_hour',
    goodsRefreshed: result.goodsRefreshed,
    ordersCreated: result.ordersCreated,
    circuitBreakers: result.circuitBreakers,
  });

  metrics.increment('six_hour_ticks_processed');
  metrics.increment('npc_orders_created', result.ordersCreated);
  if (result.circuitBreakers > 0) {
    metrics.increment('circuit_breakers_triggered', result.circuitBreakers);
  }
}

// ── Daily Tick ───────────────────────────────────────────────

/**
 * Process daily tick for all players:
 * - Daily reset (meal penalty recalculation)
 * - Rent processing
 * - Daily summary creation
 */
export async function processDailyTick(
  tickTimestamp: Date,
  metrics: Metrics
): Promise<{ playersProcessed: number; summariesCreated: number; errors: number }> {
  let cursor = '00000000-0000-0000-0000-000000000000';
  let playersProcessed = 0;
  let summariesCreated = 0;
  let errors = 0;

  while (true) {
    const batch = await query<PlayerStateWithTimezone>(
      `SELECT ps.*, p.timezone
       FROM player_state ps
       JOIN players p ON ps.player_id = p.id
       WHERE ps.player_id > $1
       ORDER BY ps.player_id ASC
       LIMIT $2`,
      [cursor, PLAYER_BATCH_SIZE]
    );

    if (batch.length === 0) break;

    for (const row of batch) {
      try {
        const result = await processDailyTickForPlayer(row, tickTimestamp);
        if (result.processed) {
          playersProcessed++;
          summariesCreated++;
          metrics.increment('daily_players_processed');
        }
      } catch (err) {
        errors++;
        metrics.increment('daily_player_errors');
        logger.error('Daily tick failed for player', {
          playerId: row.player_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    cursor = batch[batch.length - 1].player_id;
  }

  return { playersProcessed, summariesCreated, errors };
}

async function processDailyTickForPlayer(
  row: PlayerStateWithTimezone,
  tickTimestamp: Date
): Promise<{ processed: boolean }> {
  const timezone = row.timezone || 'Asia/Dubai';
  const localDate = getLocalDate(tickTimestamp.toISOString(), timezone);

  // Skip if already reset today
  if (row.last_daily_reset === localDate) {
    return { processed: false };
  }

  await withTransaction(async (tx) => {
    // Re-lock player state
    const locked = await txQueryOne<PlayerStateRow>(
      tx,
      'SELECT * FROM player_state WHERE player_id = $1 FOR UPDATE',
      [row.player_id]
    );
    if (!locked) return;

    // Re-check after locking (another worker may have processed)
    if (locked.last_daily_reset === localDate) return;

    const vigorState = buildVigorState(locked);

    // 1. Apply daily reset (meal penalty, counter reset)
    const resetResult = applyDailyReset(vigorState, tickTimestamp.toISOString());

    // 2. Process rent
    const wallet = await txQueryOne<{ account_id: number }>(
      tx,
      'SELECT account_id FROM player_wallets WHERE player_id = $1',
      [row.player_id]
    );
    const playerAccountId = wallet ? wallet.account_id : 0;

    const balance = await getBalanceInTx(tx, playerAccountId);
    const rentResult = processRent(locked.housing_tier, balance);

    // Transfer rent payment
    if (rentResult.amountChargedCents > 0 && playerAccountId > 0) {
      await transferCents(
        tx,
        playerAccountId,
        SYSTEM_ACCOUNTS.BILL_PAYMENT_SINK,
        rentResult.amountChargedCents,
        'rent',
        null,
        `Daily rent: tier ${rentResult.newTier}`
      );
    }

    // Apply discomfort penalty if housing was downgraded
    let finalVigor = resetResult.newState.vigor;
    if (rentResult.discomfortPenalty) {
      const penaltyResult = addVigor(
        finalVigor,
        rentResult.discomfortPenalty,
        resetResult.newState.caps
      );
      finalVigor = penaltyResult.vigor;
    }

    // 3. Write updated player state
    await tx.query(
      `UPDATE player_state
       SET pv = $2, mv = $3, sv = $4, cv = $5, spv = $6,
           housing_tier = $7,
           meal_day_count = $8,
           meal_penalty_level = $9,
           last_meal_times = $10,
           last_daily_reset = $11,
           active_buffs = $12,
           updated_at = NOW()
       WHERE player_id = $1`,
      [
        row.player_id,
        Math.round(finalVigor.pv),
        Math.round(finalVigor.mv),
        Math.round(finalVigor.sv),
        Math.round(finalVigor.cv),
        Math.round(finalVigor.spv),
        rentResult.newTier,
        resetResult.newState.mealsEatenToday,
        resetResult.newState.mealPenaltyLevel,
        JSON.stringify(resetResult.newState.lastMealTimes),
        resetResult.newState.lastDailyResetLocalDate,
        JSON.stringify(resetResult.newState.activeBuffs),
      ]
    );

    // 4. Compute daily summary stats from completed actions
    const statsRow = await txQueryOne<{
      shifts_worked: string;
      income_cents: string;
      expenses_cents: string;
    }>(
      tx,
      `SELECT
         COUNT(*) FILTER (WHERE type = 'WORK_SHIFT' AND status = 'completed') AS shifts_worked,
         COALESCE(SUM(
           CASE WHEN le.to_account = $2 THEN le.amount_cents ELSE 0 END
         ), 0) AS income_cents,
         COALESCE(SUM(
           CASE WHEN le.from_account = $2 THEN le.amount_cents ELSE 0 END
         ), 0) AS expenses_cents
       FROM actions a
       LEFT JOIN ledger_entries le ON le.action_id = a.action_id::text
       WHERE a.player_id = $1
         AND a.finished_at >= ($3::date)
         AND a.finished_at < ($3::date + interval '1 day')`,
      [row.player_id, playerAccountId, localDate]
    );

    // 5. Insert daily summary
    await tx.query(
      `INSERT INTO daily_summaries
         (player_id, summary_date, meals_eaten, shifts_worked, income_cents, expenses_cents,
          vigor_snapshot, housing_tier, penalties, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (player_id, summary_date) DO NOTHING`,
      [
        row.player_id,
        localDate,
        vigorState.mealsEatenToday,
        parseInt(statsRow?.shifts_worked ?? '0', 10),
        parseInt(statsRow?.income_cents ?? '0', 10),
        parseInt(statsRow?.expenses_cents ?? '0', 10) + rentResult.amountChargedCents,
        JSON.stringify({
          pv: Math.round(finalVigor.pv),
          mv: Math.round(finalVigor.mv),
          sv: Math.round(finalVigor.sv),
          cv: Math.round(finalVigor.cv),
          spv: Math.round(finalVigor.spv),
        }),
        rentResult.newTier,
        resetResult.penaltyApplied
          ? JSON.stringify(resetResult.penaltyApplied)
          : null,
        [resetResult.summary, rentResult.summary].filter(Boolean).join(' '),
      ]
    );

    // E) Run anomaly detection for this player (non-blocking within tx)
    // Note: runs outside the transaction since it only reads and inserts to anomalies
  });

  // E) Anomaly detection (outside transaction, non-blocking)
  try {
    const wallet = await queryOne<{ account_id: number }>(
      'SELECT account_id FROM player_wallets WHERE player_id = $1',
      [row.player_id]
    );
    if (wallet) {
      await runAnomalyDetection(row.player_id, wallet.account_id);
    }
  } catch {
    // Non-blocking — never let anomaly detection crash the daily tick
  }

  return { processed: true };
}

/**
 * Compute account balance within a transaction context.
 */
async function getBalanceInTx(tx: PoolClient, accountId: number): Promise<number> {
  if (accountId === 0) return 0;
  const row = await txQueryOne<{ balance: string }>(
    tx,
    `SELECT
       COALESCE(SUM(CASE WHEN to_account = $1 THEN amount_cents ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN from_account = $1 THEN amount_cents ELSE 0 END), 0)
       AS balance
     FROM ledger_entries
     WHERE from_account = $1 OR to_account = $1`,
    [accountId]
  );
  return parseInt(row?.balance ?? '0', 10);
}

// ── Process a Single Tick ────────────────────────────────────

/**
 * Dispatch tick processing based on type.
 */
export async function processTick(tick: TickRow, metrics: Metrics): Promise<void> {
  const tickTimestamp = new Date(tick.tick_timestamp);

  try {
    let detail: unknown;

    switch (tick.tick_type) {
      case 'hourly': {
        const result = await processHourlyTick(tickTimestamp, metrics);
        // Also process completed production jobs
        const { processCompletedProductionJobs } = await import('./business-service');
        const prodResult = await processCompletedProductionJobs();
        metrics.increment('production_jobs_completed', prodResult.jobsCompleted);
        if (prodResult.errors > 0) {
          metrics.increment('production_job_errors', prodResult.errors);
        }
        detail = { ...result, production: prodResult };
        break;
      }
      case 'six_hour': {
        await processSixHourTick(tickTimestamp, metrics);
        detail = { type: 'six_hour', status: 'placeholder' };
        break;
      }
      case 'daily': {
        const result = await processDailyTick(tickTimestamp, metrics);
        // Also process business daily operations (wages, satisfaction, rent)
        const { processBusinessDailyTick } = await import('./business-service');
        const bizResult = await processBusinessDailyTick();
        metrics.increment('business_daily_processed', bizResult.businessesProcessed);
        metrics.increment('business_wages_paid', bizResult.wagesPaid);
        if (bizResult.errors > 0) {
          metrics.increment('business_daily_errors', bizResult.errors);
        }
        detail = { ...result, business: bizResult };
        break;
      }
      default:
        detail = { error: `Unknown tick type: ${tick.tick_type}` };
        logger.warn('Unknown tick type', { tickType: tick.tick_type });
    }

    await completeTick(tick.tick_id, detail);
    metrics.increment('ticks_completed');
    logger.info('Tick completed', {
      tickType: tick.tick_type,
      durationMs: Date.now() - new Date(tick.started_at ?? tick.tick_timestamp).getTime(),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await failTick(tick.tick_id, errorMsg);
    metrics.increment('ticks_failed');
    logger.error('Tick processing failed', {
      tickType: tick.tick_type,
      error: errorMsg,
    });
  }
}

// ── Main Iteration ───────────────────────────────────────────

/**
 * Run one full iteration of the tick worker:
 * 1. Create tick rows for current time windows
 * 2. Claim and process pending ticks until none remain
 */
export async function runTickIteration(metrics: Metrics): Promise<number> {
  // Retry failed ticks that haven't exhausted their retry budget
  await resetStaleFailedTicks();

  await ensureTicksCreated(new Date());

  let ticksProcessed = 0;
  while (true) {
    const tick = await claimTick();
    if (!tick) break;

    await processTick(tick, metrics);
    ticksProcessed++;
  }

  return ticksProcessed;
}
