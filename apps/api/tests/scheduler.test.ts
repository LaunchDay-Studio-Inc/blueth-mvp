import type { FastifyInstance } from 'fastify';
import { pool } from '@blueth/db';
import { createTestServer, registerTestPlayer, authHeaders } from './helpers/factories';
import { cleanDatabase, teardown } from './helpers/setup';
import {
  claimDueScheduledActions,
  resolveScheduledActionById,
} from '../src/services/scheduler-service';

let server: FastifyInstance;

beforeAll(async () => {
  server = await createTestServer();
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await server.close();
  await teardown();
});

// ── Helpers ────────────────────────────────────────────────────

async function submitAction(
  cookie: string,
  body: Record<string, unknown>
) {
  return server.inject({
    method: 'POST',
    url: '/actions',
    headers: authHeaders(cookie),
    payload: body,
  });
}

async function scheduleAndMakeDue(cookie: string, type: string, payload: Record<string, unknown> = {}) {
  const idemKey = `sched-${Date.now()}-${Math.random()}`;
  await submitAction(cookie, {
    type,
    payload,
    idempotencyKey: idemKey,
  });

  // Fast-forward: set scheduled_for far in the past so it's due immediately
  await pool.query(
    `UPDATE actions
     SET scheduled_for = NOW() - interval '2 hours'
     WHERE idempotency_key = $1`,
    [idemKey]
  );

  return idemKey;
}

// ── Tests ──────────────────────────────────────────────────────

describe('Scheduler Service', () => {
  describe('concurrent claims produce disjoint sets', () => {
    it('two concurrent claimDueScheduledActions calls do not overlap', async () => {
      const { cookie } = await registerTestPlayer(server);

      // Schedule 4 actions and make them all due
      for (let i = 0; i < 4; i++) {
        await scheduleAndMakeDue(cookie, 'SOCIAL_CALL');
      }

      // Claim concurrently from two "workers"
      const [batch1, batch2] = await Promise.all([
        claimDueScheduledActions(50),
        claimDueScheduledActions(50),
      ]);

      const ids1 = new Set(batch1.map((a) => a.action_id));
      const ids2 = new Set(batch2.map((a) => a.action_id));

      // No overlap
      for (const id of ids1) {
        expect(ids2.has(id)).toBe(false);
      }

      // All 4 claimed between the two batches
      expect(ids1.size + ids2.size).toBe(4);
    });
  });

  describe('already-resolved action is skipped', () => {
    it('resolveScheduledActionById returns true but is a no-op for completed action', async () => {
      const { cookie } = await registerTestPlayer(server);
      await scheduleAndMakeDue(cookie, 'SOCIAL_CALL');

      const batch = await claimDueScheduledActions(1);
      expect(batch).toHaveLength(1);

      // Resolve it
      const result1 = await resolveScheduledActionById(batch[0].action_id);
      expect(result1.resolved).toBe(true);

      // Try to resolve again — should be a no-op (no longer 'running')
      const result2 = await resolveScheduledActionById(batch[0].action_id);
      expect(result2.resolved).toBe(true); // returns true (no-op path)
    });
  });

  describe('dead-lettered actions are not re-claimed', () => {
    it('actions with retry_count >= 3 are filtered out by claimDueScheduledActions', async () => {
      const { cookie } = await registerTestPlayer(server);
      await scheduleAndMakeDue(cookie, 'SOCIAL_CALL');

      // Manually set retry_count to 3 (dead letter)
      await pool.query(
        `UPDATE actions SET retry_count = 3 WHERE status = 'scheduled'`
      );

      const batch = await claimDueScheduledActions(50);
      expect(batch).toHaveLength(0);
    });
  });
});
