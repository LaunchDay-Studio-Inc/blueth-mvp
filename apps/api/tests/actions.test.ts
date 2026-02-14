import type { FastifyInstance } from 'fastify';
import { pool } from '@blueth/db';
import { createTestServer, registerTestPlayer, authHeaders } from './helpers/factories';
import { cleanDatabase, teardown } from './helpers/setup';

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

// ── Helper ────────────────────────────────────────────────────

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

// ── Idempotency ──────────────────────────────────────────────

describe('Idempotency', () => {
  it('returns same actionId on repeat submission with same key', async () => {
    const { cookie } = await registerTestPlayer(server);

    const payload = {
      type: 'EAT_MEAL',
      payload: { quality: 'STREET_FOOD' },
      idempotencyKey: 'eat-1',
    };

    const res1 = await submitAction(cookie, payload);
    const res2 = await submitAction(cookie, payload);

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);

    const body1 = JSON.parse(res1.body);
    const body2 = JSON.parse(res2.body);
    expect(body1.actionId).toBe(body2.actionId);
  });

  it('rejects same key with different type (409)', async () => {
    const { cookie } = await registerTestPlayer(server);

    await submitAction(cookie, {
      type: 'EAT_MEAL',
      payload: { quality: 'STREET_FOOD' },
      idempotencyKey: 'conflict-key',
    });

    const res2 = await submitAction(cookie, {
      type: 'SOCIAL_CALL',
      payload: {},
      idempotencyKey: 'conflict-key',
    });

    expect(res2.statusCode).toBe(409);
    const body = JSON.parse(res2.body);
    expect(body.code).toBe('IDEMPOTENCY_CONFLICT');
  });
});

// ── Queue limit ──────────────────────────────────────────────

describe('Queue limit', () => {
  it('rejects 13th action when queue is full (429)', async () => {
    const { cookie } = await registerTestPlayer(server);

    // Submit 12 SOCIAL_CALL actions (15 min each, non-instant)
    for (let i = 0; i < 12; i++) {
      const res = await submitAction(cookie, {
        type: 'SOCIAL_CALL',
        payload: {},
        idempotencyKey: `queue-${i}`,
      });
      expect(res.statusCode).toBe(202);
    }

    // 13th should be rejected
    const res13 = await submitAction(cookie, {
      type: 'SOCIAL_CALL',
      payload: {},
      idempotencyKey: 'queue-12',
    });

    expect(res13.statusCode).toBe(429);
    const body = JSON.parse(res13.body);
    expect(body.code).toBe('QUEUE_LIMIT');
  });
});

// ── EAT_MEAL (instant action) ────────────────────────────────

describe('EAT_MEAL', () => {
  it('completes instantly and returns 200', async () => {
    const { cookie } = await registerTestPlayer(server);

    const res = await submitAction(cookie, {
      type: 'EAT_MEAL',
      payload: { quality: 'STREET_FOOD' },
      idempotencyKey: 'meal-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('completed');
    expect(body.durationSeconds).toBe(0);
    expect(body.result).toBeDefined();
  });

  it('increments meal count', async () => {
    const { cookie } = await registerTestPlayer(server);

    await submitAction(cookie, {
      type: 'EAT_MEAL',
      payload: { quality: 'STREET_FOOD' },
      idempotencyKey: 'mealcount-1',
    });

    const stateRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });
    const state = JSON.parse(stateRes.body);
    expect(state.mealsEatenToday).toBe(1);
  });

  it('rejects 4th meal per day', async () => {
    const { cookie } = await registerTestPlayer(server);

    for (let i = 0; i < 3; i++) {
      const res = await submitAction(cookie, {
        type: 'EAT_MEAL',
        payload: { quality: 'STREET_FOOD' },
        idempotencyKey: `mealmax-${i}`,
      });
      expect(res.statusCode).toBe(200);
    }

    const res4 = await submitAction(cookie, {
      type: 'EAT_MEAL',
      payload: { quality: 'STREET_FOOD' },
      idempotencyKey: 'mealmax-3',
    });

    expect(res4.statusCode).toBe(400);
    const body = JSON.parse(res4.body);
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

// ── SLEEP ────────────────────────────────────────────────────

describe('SLEEP', () => {
  it('schedules a sleep action and sets sleep_state to sleeping', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    const res = await submitAction(cookie, {
      type: 'SLEEP',
      payload: { hours: 2 },
      idempotencyKey: 'sleep-1',
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('scheduled');
    expect(body.durationSeconds).toBe(7200);

    // Player should now be sleeping
    const stateRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });
    const state = JSON.parse(stateRes.body);
    expect(state.sleepState).toBe('sleeping');
  });

  it('rejects sleeping while already sleeping', async () => {
    const { cookie } = await registerTestPlayer(server);

    await submitAction(cookie, {
      type: 'SLEEP',
      payload: { hours: 2 },
      idempotencyKey: 'sleep-dup-1',
    });

    const res2 = await submitAction(cookie, {
      type: 'SLEEP',
      payload: { hours: 4 },
      idempotencyKey: 'sleep-dup-2',
    });

    expect(res2.statusCode).toBe(409);
    const body = JSON.parse(res2.body);
    expect(body.code).toBe('ACTION_CONFLICT');
  });

  it('resolves sleep and wakes player up', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    const res = await submitAction(cookie, {
      type: 'SLEEP',
      payload: { hours: 2 },
      idempotencyKey: 'sleep-resolve',
    });

    const actionId = JSON.parse(res.body).actionId;

    // Manually fast-forward the scheduled_for to the past
    await pool.query(
      `UPDATE actions SET scheduled_for = NOW() - INTERVAL '3 hours' WHERE action_id = $1`,
      [actionId]
    );

    // Trigger lazy resolution by checking state
    const stateRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });
    const state = JSON.parse(stateRes.body);
    expect(state.sleepState).toBe('awake');

    // Verify the action is now completed
    const actionRes = await server.inject({
      method: 'GET',
      url: `/actions/${actionId}`,
      headers: authHeaders(cookie),
    });
    const action = JSON.parse(actionRes.body);
    expect(action.status).toBe('completed');
    expect(action.result).toBeDefined();
  });
});

// ── WORK_SHIFT ───────────────────────────────────────────────

describe('WORK_SHIFT', () => {
  it('schedules a work shift and produces pay on resolution', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    const res = await submitAction(cookie, {
      type: 'WORK_SHIFT',
      payload: { jobFamily: 'physical', duration: 'short' },
      idempotencyKey: 'work-1',
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('scheduled');
    expect(body.durationSeconds).toBeGreaterThan(0);

    const actionId = body.actionId;

    // Fast-forward
    await pool.query(
      `UPDATE actions SET scheduled_for = NOW() - INTERVAL '1 day' WHERE action_id = $1`,
      [actionId]
    );

    // Trigger resolution and check state
    const stateRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });
    const state = JSON.parse(stateRes.body);

    // Balance should be higher than initial 50000 (got paid)
    expect(state.balanceCents).toBeGreaterThan(50000);

    // Verify the action result has pay info
    const actionRes = await server.inject({
      method: 'GET',
      url: `/actions/${actionId}`,
      headers: authHeaders(cookie),
    });
    const action = JSON.parse(actionRes.body);
    expect(action.status).toBe('completed');
    expect(action.result.payCents).toBeGreaterThan(0);
    expect(action.result.vigorCost).toBeDefined();
  });
});

// ── SOCIAL_CALL ──────────────────────────────────────────────

describe('SOCIAL_CALL', () => {
  it('schedules a social call action', async () => {
    const { cookie } = await registerTestPlayer(server);

    const res = await submitAction(cookie, {
      type: 'SOCIAL_CALL',
      payload: {},
      idempotencyKey: 'social-1',
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('scheduled');
    expect(body.durationSeconds).toBe(900);
  });
});

// ── LEISURE ──────────────────────────────────────────────────

describe('LEISURE', () => {
  it('schedules a leisure action', async () => {
    const { cookie } = await registerTestPlayer(server);

    const res = await submitAction(cookie, {
      type: 'LEISURE',
      payload: {},
      idempotencyKey: 'leisure-1',
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('scheduled');
    expect(body.durationSeconds).toBe(3600);
  });
});

// ── Unknown action type ──────────────────────────────────────

describe('Unknown action type', () => {
  it('rejects unknown type with 400', async () => {
    const { cookie } = await registerTestPlayer(server);

    const res = await submitAction(cookie, {
      type: 'NONEXISTENT',
      payload: {},
      idempotencyKey: 'unknown-1',
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

// ── Action queue ─────────────────────────────────────────────

describe('GET /actions/queue', () => {
  it('returns pending actions', async () => {
    const { cookie } = await registerTestPlayer(server);

    await submitAction(cookie, {
      type: 'SOCIAL_CALL',
      payload: {},
      idempotencyKey: 'q-1',
    });

    await submitAction(cookie, {
      type: 'LEISURE',
      payload: {},
      idempotencyKey: 'q-2',
    });

    const response = await server.inject({
      method: 'GET',
      url: '/actions/queue',
      headers: authHeaders(cookie),
    });

    expect(response.statusCode).toBe(200);
    const queue = JSON.parse(response.body);
    expect(queue.length).toBe(2);
  });
});

// ── Atomicity ────────────────────────────────────────────────

describe('Atomicity', () => {
  it('does not create ledger entries on validation failure', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // Get initial ledger count
    const beforeCount = await pool.query(
      `SELECT COUNT(*) as cnt FROM ledger_entries le
       JOIN player_wallets pw ON (le.from_account = pw.account_id OR le.to_account = pw.account_id)
       WHERE pw.player_id = $1`,
      [playerId]
    );
    const countBefore = parseInt(beforeCount.rows[0].cnt, 10);

    // Submit an invalid action (bad payload for WORK_SHIFT)
    await submitAction(cookie, {
      type: 'WORK_SHIFT',
      payload: { jobFamily: 'invalid_family', duration: 'short' },
      idempotencyKey: 'atomic-test',
    });

    // Ledger count should not have changed
    const afterCount = await pool.query(
      `SELECT COUNT(*) as cnt FROM ledger_entries le
       JOIN player_wallets pw ON (le.from_account = pw.account_id OR le.to_account = pw.account_id)
       WHERE pw.player_id = $1`,
      [playerId]
    );
    const countAfter = parseInt(afterCount.rows[0].cnt, 10);
    expect(countAfter).toBe(countBefore);
  });
});
