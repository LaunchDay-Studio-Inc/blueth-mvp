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

// ── Helpers ────────────────────────────────────────────────────

async function submitAction(cookie: string, body: Record<string, unknown>) {
  return server.inject({
    method: 'POST',
    url: '/actions',
    headers: authHeaders(cookie),
    payload: body,
  });
}

async function advanceTime(cookie: string, minutes: number) {
  return server.inject({
    method: 'POST',
    url: '/debug/advance',
    headers: authHeaders(cookie),
    payload: { minutes },
  });
}

async function getPlayerState(cookie: string) {
  const res = await server.inject({
    method: 'GET',
    url: '/me/state',
    headers: authHeaders(cookie),
  });
  return JSON.parse(res.body);
}

async function getActionQueue(cookie: string) {
  const res = await server.inject({
    method: 'GET',
    url: '/actions/queue',
    headers: authHeaders(cookie),
  });
  return JSON.parse(res.body);
}

// ── Debug Advance Endpoint ───────────────────────────────────

describe('POST /debug/advance', () => {
  it('rejects invalid minutes', async () => {
    const { cookie } = await registerTestPlayer(server);
    const res = await advanceTime(cookie, 0);
    expect(res.statusCode).toBe(400);
  });

  it('rejects minutes > 1440', async () => {
    const { cookie } = await registerTestPlayer(server);
    const res = await advanceTime(cookie, 1500);
    expect(res.statusCode).toBe(400);
  });
});

// ── SOCIAL_CALL: enqueue 15m, fast-forward 20m, verify ──────

describe('SOCIAL_CALL end-to-end with fast-forward', () => {
  it('completes and applies SV+3 MV+1 after fast-forward', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // Lower SV and MV so the delta is visible (they start at cap=100)
    await pool.query(
      'UPDATE player_state SET sv = 80, mv = 80 WHERE player_id = $1',
      [playerId]
    );

    // Get baseline state
    const before = await getPlayerState(cookie);
    const svBefore = before.vigor.sv;
    const mvBefore = before.vigor.mv;
    expect(svBefore).toBe(80);
    expect(mvBefore).toBe(80);

    // Enqueue SOCIAL_CALL (15 minutes)
    const submitRes = await submitAction(cookie, {
      type: 'SOCIAL_CALL',
      payload: {},
      idempotencyKey: 'social-1',
    });
    expect(submitRes.statusCode).toBe(202); // Accepted (scheduled, not instant)

    // Verify it's in the queue
    const queue = await getActionQueue(cookie);
    const socialAction = queue.find((a: { type: string }) => a.type === 'SOCIAL_CALL');
    expect(socialAction).toBeDefined();
    expect(socialAction.status).toBe('scheduled');

    // Fast-forward 20 minutes (past the 15m duration)
    const advRes = await advanceTime(cookie, 20);
    expect(advRes.statusCode).toBe(200);

    // Verify action is now completed
    const queueAfter = await getActionQueue(cookie);
    const stillQueued = queueAfter.find(
      (a: { type: string; status: string }) => a.type === 'SOCIAL_CALL' && a.status !== 'completed'
    );
    expect(stillQueued).toBeUndefined();

    // Verify vigor increased
    const after = await getPlayerState(cookie);
    expect(after.vigor.sv).toBeGreaterThanOrEqual(svBefore + 3);
    expect(after.vigor.mv).toBeGreaterThanOrEqual(mvBefore + 1);
  });
});

// ── WORK_SHIFT: enqueue 2h, fast-forward 130m, verify ───────

describe('WORK_SHIFT end-to-end with fast-forward', () => {
  it('completes and applies pay + vigor cost after fast-forward', async () => {
    const { cookie } = await registerTestPlayer(server);

    // Get baseline state
    const before = await getPlayerState(cookie);
    const pvBefore = before.vigor.pv;
    const mvBefore = before.vigor.mv;
    const balanceBefore = before.balanceCents;

    // Enqueue short WORK_SHIFT for 'physical' (2 hours, costs pv:10 mv:3)
    const submitRes = await submitAction(cookie, {
      type: 'WORK_SHIFT',
      payload: { jobFamily: 'physical', duration: 'short' },
      idempotencyKey: 'work-1',
    });
    expect(submitRes.statusCode).toBe(202);

    // Fast-forward 130 minutes (past the 2h/120m duration)
    const advRes = await advanceTime(cookie, 130);
    expect(advRes.statusCode).toBe(200);

    // Verify action completed
    const queueAfter = await getActionQueue(cookie);
    const stillQueued = queueAfter.find(
      (a: { type: string; status: string }) => a.type === 'WORK_SHIFT' && a.status !== 'completed'
    );
    expect(stillQueued).toBeUndefined();

    // Verify vigor decreased (physical short: pv-10 mv-3)
    const after = await getPlayerState(cookie);
    expect(after.vigor.pv).toBeLessThanOrEqual(pvBefore - 10);
    expect(after.vigor.mv).toBeLessThanOrEqual(mvBefore - 3);

    // Verify money increased (got paid)
    expect(after.balanceCents).toBeGreaterThan(balanceBefore);
  });
});

// ── EAT_MEAL: instant, no fast-forward needed ───────────────

describe('EAT_MEAL instant completion', () => {
  it('completes instantly and charges money', async () => {
    const { cookie } = await registerTestPlayer(server);

    const before = await getPlayerState(cookie);
    const balanceBefore = before.balanceCents;

    const submitRes = await submitAction(cookie, {
      type: 'EAT_MEAL',
      payload: { quality: 'STREET_FOOD' },
      idempotencyKey: 'eat-1',
    });
    expect(submitRes.statusCode).toBe(200); // Instant

    const body = JSON.parse(submitRes.body);
    expect(body.status).toBe('completed');

    // Verify money decreased by 300 (Street Food costs ₿3)
    const after = await getPlayerState(cookie);
    expect(after.balanceCents).toBe(balanceBefore - 300);
  });
});

// ── LEISURE: enqueue 1h, fast-forward 65m, verify ───────────

describe('LEISURE end-to-end with fast-forward', () => {
  it('completes and applies MV+4 SPV+2 + buff after fast-forward', async () => {
    const { cookie } = await registerTestPlayer(server);

    const before = await getPlayerState(cookie);
    const mvBefore = before.vigor.mv;
    const spvBefore = before.vigor.spv;

    // Enqueue LEISURE (1 hour)
    const submitRes = await submitAction(cookie, {
      type: 'LEISURE',
      payload: {},
      idempotencyKey: 'leisure-1',
    });
    expect(submitRes.statusCode).toBe(202);

    // Fast-forward 65 minutes
    const advRes = await advanceTime(cookie, 65);
    expect(advRes.statusCode).toBe(200);

    // Verify completion
    const queueAfter = await getActionQueue(cookie);
    const stillQueued = queueAfter.find(
      (a: { type: string; status: string }) => a.type === 'LEISURE' && a.status !== 'completed'
    );
    expect(stillQueued).toBeUndefined();

    // Verify vigor (MV +4, SPV +2 instant delta)
    const after = await getPlayerState(cookie);
    // MV and SPV are capped at 100, so use >=
    expect(after.vigor.mv).toBeGreaterThanOrEqual(Math.min(100, mvBefore + 4));
    expect(after.vigor.spv).toBeGreaterThanOrEqual(Math.min(100, spvBefore + 2));

    // Verify leisure buff was created
    expect(after.activeBuffs.length).toBeGreaterThan(before.activeBuffs.length);
  });
});
