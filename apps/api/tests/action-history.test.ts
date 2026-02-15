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

async function submitAction(cookie: string, body: Record<string, unknown>) {
  return server.inject({
    method: 'POST',
    url: '/actions',
    headers: authHeaders(cookie),
    payload: body,
  });
}

// ── Action History Endpoint ─────────────────────────────────

describe('GET /actions/history', () => {
  it('returns empty array when no actions completed', async () => {
    const { cookie } = await registerTestPlayer(server);

    const res = await server.inject({
      method: 'GET',
      url: '/actions/history',
      headers: authHeaders(cookie),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  it('shows completed SOCIAL_CALL with vigor delta after resolution', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // Lower SV/MV so vigor gains are visible (not capped at 100)
    await pool.query(
      `UPDATE player_state SET sv = 80, mv = 80 WHERE player_id = $1`,
      [playerId]
    );

    // 1. Submit SOCIAL_CALL
    const submitRes = await submitAction(cookie, {
      type: 'SOCIAL_CALL',
      payload: {},
      idempotencyKey: 'history-social-1',
    });

    expect(submitRes.statusCode).toBe(202);
    const actionId = JSON.parse(submitRes.body).actionId;

    // 2. Fast-forward: shift scheduled_for to the past
    await pool.query(
      `UPDATE actions SET scheduled_for = NOW() - INTERVAL '1 hour' WHERE action_id = $1`,
      [actionId]
    );

    // 3. Trigger lazy resolution via history endpoint (it calls resolveAllDue)
    const historyRes = await server.inject({
      method: 'GET',
      url: '/actions/history',
      headers: authHeaders(cookie),
    });

    expect(historyRes.statusCode).toBe(200);
    const history = JSON.parse(historyRes.body);

    // Should have exactly 1 completed action
    expect(history.length).toBe(1);
    expect(history[0].action_id).toBe(actionId);
    expect(history[0].type).toBe('SOCIAL_CALL');
    expect(history[0].status).toBe('completed');
    expect(history[0].finished_at).toBeTruthy();

    // Result should contain vigorDelta with sv and mv gains
    expect(history[0].result).toBeDefined();
    expect(history[0].result.vigorDelta).toBeDefined();
    expect(history[0].result.vigorDelta.sv).toBe(3);
    expect(history[0].result.vigorDelta.mv).toBe(1);
  });

  it('does not include pending/running actions', async () => {
    const { cookie } = await registerTestPlayer(server);

    // Submit a SOCIAL_CALL (15 min duration, won't complete yet)
    const submitRes = await submitAction(cookie, {
      type: 'SOCIAL_CALL',
      payload: {},
      idempotencyKey: 'history-pending-1',
    });
    expect(submitRes.statusCode).toBe(202);

    // History should be empty (action is still pending/running)
    const historyRes = await server.inject({
      method: 'GET',
      url: '/actions/history',
      headers: authHeaders(cookie),
    });

    expect(historyRes.statusCode).toBe(200);
    const history = JSON.parse(historyRes.body);
    expect(history.length).toBe(0);
  });

  it('returns actions ordered by finished_at DESC', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    await pool.query(
      `UPDATE player_state SET sv = 50, mv = 50 WHERE player_id = $1`,
      [playerId]
    );

    // Submit two SOCIAL_CALLs
    const res1 = await submitAction(cookie, {
      type: 'SOCIAL_CALL',
      payload: {},
      idempotencyKey: 'history-order-1',
    });
    const id1 = JSON.parse(res1.body).actionId;

    const res2 = await submitAction(cookie, {
      type: 'SOCIAL_CALL',
      payload: {},
      idempotencyKey: 'history-order-2',
    });
    const id2 = JSON.parse(res2.body).actionId;

    // Fast-forward both
    await pool.query(
      `UPDATE actions SET scheduled_for = NOW() - INTERVAL '1 hour' WHERE action_id = ANY($1)`,
      [[id1, id2]]
    );

    // Resolve via history endpoint
    const historyRes = await server.inject({
      method: 'GET',
      url: '/actions/history',
      headers: authHeaders(cookie),
    });

    const history = JSON.parse(historyRes.body);
    expect(history.length).toBe(2);

    // Most recently finished should be first
    const t0 = new Date(history[0].finished_at).getTime();
    const t1 = new Date(history[1].finished_at).getTime();
    expect(t0).toBeGreaterThanOrEqual(t1);
  });
});
