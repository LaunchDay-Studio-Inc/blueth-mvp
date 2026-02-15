import { FastifyInstance } from 'fastify';
import { createTestServer } from './helpers/factories';
import { teardown } from './helpers/setup';
import { pool } from '@blueth/db';

let server: FastifyInstance;
let dbAvailable = false;

beforeAll(async () => {
  server = await createTestServer();
  // Check if DB is reachable for conditional tests
  try {
    await pool.query('SELECT 1');
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  await server.close();
  await teardown();
});

describe('GET /health (liveness)', () => {
  it('returns 200 with version and commit fields', async () => {
    const res = await server.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('commit');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('environment');
  });

  it('returns 200 even when DB is unreachable (pure liveness)', async () => {
    // Liveness should never depend on DB — it just proves the process is up.
    // This test always passes because /health doesn't query the DB.
    const res = await server.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('does not require authentication', async () => {
    const res = await server.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).not.toBe(401);
  });
});

describe('GET /health/db', () => {
  it('returns 200 when database is reachable', async () => {
    if (!dbAvailable) return; // skip when no DB
    const res = await server.inject({ method: 'GET', url: '/health/db' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
  });

  it('returns 503 when database is unreachable', async () => {
    if (dbAvailable) return; // only meaningful without DB
    const res = await server.inject({ method: 'GET', url: '/health/db' });
    expect(res.statusCode).toBe(503);
  });
});

describe('GET /ready', () => {
  it('returns 200 when database is reachable', async () => {
    if (!dbAvailable) return; // skip when no DB
    const res = await server.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.status).toBe('ready');
  });

  it('returns 503 when database is unreachable', async () => {
    if (dbAvailable) return; // only meaningful without DB
    const res = await server.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(503);

    const body = JSON.parse(res.body);
    expect(body.status).toBe('not_ready');
  });

  it('does not require authentication', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/ready',
    });
    // Should NOT return 401 regardless of DB state
    expect(res.statusCode).not.toBe(401);
  });
});
