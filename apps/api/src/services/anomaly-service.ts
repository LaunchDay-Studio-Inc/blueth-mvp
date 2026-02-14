/**
 * Anomaly Service — Blueth City MVP
 *
 * Detects and logs anomalous player activity:
 *   - money_spike:       Daily money delta exceeds threshold
 *   - order_spam:        Orders placed at rate > N/min
 *   - repeated_failures: Consecutive failed actions within a window
 *
 * All anomalies are logged to the `anomalies` table for admin review.
 * Detection is non-blocking — we log but never reject based on anomalies alone.
 */

import { execute, queryOne } from '@blueth/db';
import { createLogger } from './observability';

const logger = createLogger('anomaly');

// ── Thresholds ──────────────────────────────────────────────

/** If a player's net money delta exceeds this in a calendar day, flag it. */
const DAILY_MONEY_SPIKE_CENTS = 500_00; // ₿500

/** Max orders per minute before flagging as spam. */
const ORDERS_PER_MINUTE_THRESHOLD = 10;

/** Consecutive failed actions in the last hour before flagging. */
const REPEATED_FAILURE_THRESHOLD = 5;

/** Only create one anomaly of each type per player per cooldown window. */
const ANOMALY_COOLDOWN_MINUTES = 30;

// ── Core Logger ─────────────────────────────────────────────

/**
 * Insert an anomaly row. Includes a cooldown to avoid flooding:
 * at most one anomaly of (player_id, type) per cooldown window.
 */
export async function logAnomaly(
  playerId: string,
  type: string,
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    // Cooldown check — skip if a same-type anomaly was logged recently
    const recent = await queryOne<{ id: string }>(
      `SELECT id FROM anomalies
       WHERE player_id = $1 AND type = $2
       AND created_at > NOW() - ($3 || ' minutes')::interval
       LIMIT 1`,
      [playerId, type, ANOMALY_COOLDOWN_MINUTES],
    );

    if (recent) return; // already logged recently

    await execute(
      `INSERT INTO anomalies (player_id, type, detail) VALUES ($1, $2, $3)`,
      [playerId, type, JSON.stringify(detail)],
    );

    logger.warn('Anomaly logged', { playerId, type, detail });
  } catch (err) {
    // Non-blocking: never let anomaly detection crash the action
    logger.error('Failed to log anomaly', {
      playerId,
      type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Detectors ───────────────────────────────────────────────

/**
 * Detect if a player's net money change today exceeds the threshold.
 * Called from the daily tick or ad-hoc after large transactions.
 */
export async function detectMoneySpike(
  playerId: string,
  accountId: number,
): Promise<void> {
  try {
    const row = await queryOne<{ income: string; expenses: string }>(
      `SELECT
         COALESCE(SUM(CASE WHEN to_account = $1 THEN amount_cents ELSE 0 END), 0) AS income,
         COALESCE(SUM(CASE WHEN from_account = $1 THEN amount_cents ELSE 0 END), 0) AS expenses
       FROM ledger_entries
       WHERE (from_account = $1 OR to_account = $1)
         AND created_at >= CURRENT_DATE`,
      [accountId],
    );

    if (!row) return;

    const income = parseInt(row.income, 10);
    const expenses = parseInt(row.expenses, 10);
    const netDelta = Math.abs(income - expenses);

    if (netDelta > DAILY_MONEY_SPIKE_CENTS) {
      await logAnomaly(playerId, 'money_spike', {
        incomeCents: income,
        expensesCents: expenses,
        netDeltaCents: netDelta,
        thresholdCents: DAILY_MONEY_SPIKE_CENTS,
      });
    }
  } catch (err) {
    logger.error('detectMoneySpike failed', {
      playerId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Detect if a player is placing orders faster than the rate limit.
 * Called inline from the market place-order handler.
 */
export async function detectOrderSpam(playerId: string): Promise<void> {
  try {
    const row = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM market_orders
       WHERE actor_type = 'player' AND actor_id = $1
       AND created_at > NOW() - interval '1 minute'`,
      [playerId],
    );

    const count = parseInt(row?.cnt ?? '0', 10);
    if (count >= ORDERS_PER_MINUTE_THRESHOLD) {
      await logAnomaly(playerId, 'order_spam', {
        ordersInLastMinute: count,
        threshold: ORDERS_PER_MINUTE_THRESHOLD,
      });
    }
  } catch (err) {
    logger.error('detectOrderSpam failed', {
      playerId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Detect if a player has many consecutive failed actions recently.
 * Called from the action resolution failure path.
 */
export async function detectRepeatedFailures(playerId: string): Promise<void> {
  try {
    const row = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM actions
       WHERE player_id = $1 AND status = 'failed'
       AND finished_at > NOW() - interval '1 hour'`,
      [playerId],
    );

    const count = parseInt(row?.cnt ?? '0', 10);
    if (count >= REPEATED_FAILURE_THRESHOLD) {
      await logAnomaly(playerId, 'repeated_failures', {
        failedActionsLastHour: count,
        threshold: REPEATED_FAILURE_THRESHOLD,
      });
    }
  } catch (err) {
    logger.error('detectRepeatedFailures failed', {
      playerId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Run all anomaly detectors for a player (called from daily tick).
 */
export async function runAnomalyDetection(
  playerId: string,
  accountId: number,
): Promise<void> {
  await Promise.all([
    detectMoneySpike(playerId, accountId),
    detectRepeatedFailures(playerId),
  ]);
}
