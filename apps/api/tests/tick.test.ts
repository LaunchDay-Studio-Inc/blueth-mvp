import type { FastifyInstance } from 'fastify';
import { pool } from '@blueth/db';
import { createTestServer, registerTestPlayer, authHeaders } from './helpers/factories';
import { cleanDatabase, teardown } from './helpers/setup';
import {
  ensureTicksCreated,
  claimTick,
  processTick,
} from '../src/services/tick-service';
import { createMetrics } from '../src/services/observability';

let server: FastifyInstance;
const metrics = createMetrics();

beforeAll(async () => {
  server = await createTestServer();
});

beforeEach(async () => {
  await cleanDatabase();
  // Clean tick state for each test
  await pool.query('DELETE FROM ticks');
  await pool.query('DELETE FROM daily_summaries');
});

afterAll(async () => {
  await server.close();
  await teardown();
});

// ── Tests ──────────────────────────────────────────────────────

describe('Tick Service', () => {
  describe('hourly tick idempotency', () => {
    it('ensureTicksCreated is idempotent (ON CONFLICT DO NOTHING)', async () => {
      const now = new Date('2024-03-15T10:00:00Z');

      await ensureTicksCreated(now);
      await ensureTicksCreated(now); // second call should be a no-op

      const { rows } = await pool.query(
        `SELECT * FROM ticks WHERE tick_type = 'hourly' AND tick_timestamp = $1`,
        [now]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('pending');
    });

    it('claimed tick cannot be claimed again', async () => {
      const now = new Date('2024-03-15T10:00:00Z');
      await ensureTicksCreated(now);

      const tick1 = await claimTick();
      expect(tick1).not.toBeNull();

      // Second claim should get a different tick or null
      const tick2 = await claimTick();
      if (tick2) {
        expect(tick2.tick_id).not.toBe(tick1!.tick_id);
      }
    });
  });

  describe('daily tick idempotency', () => {
    it('daily tick row prevents double-processing for same timestamp', async () => {
      const now = new Date('2024-03-15T00:00:00Z');
      await ensureTicksCreated(now);

      // Claim and process the daily tick
      let tick = await claimTick();
      while (tick) {
        if (tick.tick_type === 'daily') {
          await processTick(tick, metrics);
          break;
        }
        // Mark non-daily tick as completed to move on
        await pool.query(
          `UPDATE ticks SET status = 'completed', finished_at = NOW() WHERE tick_id = $1`,
          [tick.tick_id]
        );
        tick = await claimTick();
      }

      // Create ticks again for same timestamp — daily should already exist
      await ensureTicksCreated(now);

      // No new pending daily tick should be created
      const { rows } = await pool.query(
        `SELECT * FROM ticks WHERE tick_type = 'daily' AND tick_timestamp = $1 AND status = 'pending'`,
        [now]
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe('rent downgrade end-to-end', () => {
    it('player with insufficient funds is downgraded and penalized', async () => {
      const { cookie, playerId } = await registerTestPlayer(server);

      // Set housing tier to 2 (Studio: costs ₿25/day = 2500 cents)
      await pool.query(
        `UPDATE player_state SET housing_tier = 2 WHERE player_id = $1`,
        [playerId]
      );

      // Drain wallet: set balance to just 500 cents (insufficient for tier 2)
      // First get player's account_id
      const walletRow = await pool.query(
        `SELECT account_id FROM player_wallets WHERE player_id = $1`,
        [playerId]
      );
      const accountId = walletRow.rows[0].account_id;

      // Get current balance
      const balanceRow = await pool.query(
        `SELECT COALESCE(SUM(CASE WHEN to_account = $1 THEN amount_cents ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN from_account = $1 THEN amount_cents ELSE 0 END), 0) AS balance
         FROM ledger_entries WHERE from_account = $1 OR to_account = $1`,
        [accountId]
      );
      const currentBalance = parseInt(balanceRow.rows[0].balance, 10);

      // Drain to 500 cents by transferring excess to a sink
      if (currentBalance > 500) {
        const drainAmount = currentBalance - 500;
        await pool.query(
          `INSERT INTO ledger_entries (from_account, to_account, amount_cents, entry_type, memo)
           VALUES ($1, 4, $2, 'test_drain', 'Test: drain wallet')`,
          [accountId, drainAmount]
        );
      }

      // Set last_daily_reset to yesterday so daily tick processes this player
      await pool.query(
        `UPDATE player_state SET last_daily_reset = '2024-03-14' WHERE player_id = $1`,
        [playerId]
      );

      // Create and run a daily tick
      const tickTime = new Date('2024-03-15T20:00:00Z'); // midnight Dubai
      await pool.query(
        `INSERT INTO ticks (tick_type, tick_timestamp, status)
         VALUES ('daily', $1, 'pending')
         ON CONFLICT DO NOTHING`,
        [tickTime]
      );

      const tick = await claimTick();
      expect(tick).not.toBeNull();
      if (tick && tick.tick_type === 'daily') {
        await processTick(tick, metrics);
      }

      // Verify downgrade occurred
      const stateRow = await pool.query(
        `SELECT housing_tier, pv, sv FROM player_state WHERE player_id = $1`,
        [playerId]
      );
      const state = stateRow.rows[0];

      // Should be downgraded below tier 2 (to 0 since 500 < tier 1 cost of 1200)
      expect(state.housing_tier).toBeLessThan(2);

      // PV should reflect discomfort penalty (-3)
      // Original PV was 50 (from initialization), minus 3 from downgrade penalty
      // The exact value depends on hourly tick processing, but it should be less than initial
      expect(parseFloat(state.pv)).toBeLessThan(50);
    });
  });
});
