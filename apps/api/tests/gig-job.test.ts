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

describe('GIG_JOB', () => {
  it('schedules a gig with 600-second duration', async () => {
    const { cookie } = await registerTestPlayer(server);

    const res = await submitAction(cookie, {
      type: 'GIG_JOB',
      payload: { gigId: 'courier_run' },
      idempotencyKey: 'gig-1',
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('scheduled');
    expect(body.durationSeconds).toBe(600);
  });

  it('rejects invalid gig IDs', async () => {
    const { cookie } = await registerTestPlayer(server);

    const res = await submitAction(cookie, {
      type: 'GIG_JOB',
      payload: { gigId: 'nonexistent_gig' },
      idempotencyKey: 'gig-bad',
    });

    // Validation errors return 400
    expect(res.statusCode).toBe(400);
  });

  it('produces pay on resolution', async () => {
    const { cookie } = await registerTestPlayer(server);

    // Submit gig
    const res = await submitAction(cookie, {
      type: 'GIG_JOB',
      payload: { gigId: 'courier_run' },
      idempotencyKey: 'gig-pay-1',
    });
    expect(res.statusCode).toBe(202);
    const actionId = JSON.parse(res.body).actionId;

    // Fast-forward the action
    await pool.query(
      `UPDATE actions SET scheduled_for = NOW() - INTERVAL '1 day' WHERE action_id = $1`,
      [actionId]
    );

    // Trigger resolution via GET /me/state (side-effect: runs scheduler)
    const stateRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });
    const state = JSON.parse(stateRes.body);

    // Balance should be higher than initial 50000 (got paid from gig)
    expect(state.balanceCents).toBeGreaterThan(50000);

    // Verify the action result has pay info
    const actionRes = await server.inject({
      method: 'GET',
      url: `/actions/${actionId}`,
      headers: authHeaders(cookie),
    });
    const actionBody = JSON.parse(actionRes.body);
    expect(actionBody.status).toBe('completed');
    expect(actionBody.result.payCents).toBeGreaterThan(0);
    expect(actionBody.result.gigId).toBe('courier_run');
    expect(actionBody.result.jobFamily).toBe('physical');
  });

  it('deducts vigor on resolution', async () => {
    const { cookie } = await registerTestPlayer(server);

    // Submit a physical gig (costs PV)
    const res = await submitAction(cookie, {
      type: 'GIG_JOB',
      payload: { gigId: 'courier_run' },
      idempotencyKey: 'gig-vigor-1',
    });
    const actionId = JSON.parse(res.body).actionId;

    // Fast-forward + resolve
    await pool.query(
      `UPDATE actions SET scheduled_for = NOW() - INTERVAL '1 day' WHERE action_id = $1`,
      [actionId]
    );

    // Trigger resolution
    const stateRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });
    const state = JSON.parse(stateRes.body);

    // courier_run costs pv: 3, so PV should be < 100
    expect(state.vigor.pv).toBeLessThan(100);
  });

  it('accepts all 4 gig types', async () => {
    const { cookie } = await registerTestPlayer(server);
    const gigIds = ['courier_run', 'data_entry_burst', 'cafe_rush', 'quick_inventory'];

    for (let i = 0; i < gigIds.length; i++) {
      const res = await submitAction(cookie, {
        type: 'GIG_JOB',
        payload: { gigId: gigIds[i] },
        idempotencyKey: `gig-all-${i}`,
      });
      expect(res.statusCode).toBe(202);
    }
  });
});
