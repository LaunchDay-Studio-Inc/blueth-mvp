import type { FastifyInstance } from 'fastify';
import { createTestServer, registerTestPlayer, extractSessionCookie, authHeaders } from './helpers/factories';
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

describe('POST /auth/register', () => {
  it('creates a player with correct initial state', async () => {
    const { cookie, playerId } = await registerTestPlayer(server, 'newplayer');

    // Verify player state via /me/state
    const stateRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });

    expect(stateRes.statusCode).toBe(200);
    const state = JSON.parse(stateRes.body);
    expect(state.playerId).toBe(playerId);
    expect(state.username).toBe('newplayer');
    expect(state.housingTier).toBe(1);
    expect(state.balanceCents).toBe(50000);
    expect(state.vigor.pv).toBe(100);
    expect(state.vigor.mv).toBe(100);
    expect(state.vigor.sv).toBe(100);
    expect(state.vigor.cv).toBe(100);
    expect(state.vigor.spv).toBe(100);
    expect(state.sleepState).toBe('awake');
    expect(state.skills).toEqual({
      labor: 0.1,
      admin: 0.1,
      service: 0.1,
      management: 0.1,
      trading: 0.1,
    });
  });

  it('returns a session cookie', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'cookietest', password: 'password123' },
    });

    expect(response.statusCode).toBe(201);
    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieStr).toMatch(/session_id=/);
    expect(cookieStr).toMatch(/HttpOnly/i);
  });

  it('rejects duplicate username with 400', async () => {
    await registerTestPlayer(server, 'dupuser');

    const response = await server.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'dupuser', password: 'password123' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects short username', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'ab', password: 'password123' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects short password', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'validuser', password: 'short' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('returns session cookie on valid credentials', async () => {
    await registerTestPlayer(server, 'loginuser');

    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'loginuser', password: 'test_password_123' },
    });

    expect(response.statusCode).toBe(200);
    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const body = JSON.parse(response.body);
    expect(body.username).toBe('loginuser');
  });

  it('rejects wrong password with 401', async () => {
    await registerTestPlayer(server, 'wrongpw');

    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'wrongpw', password: 'bad_password' },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('rejects non-existent username with 401', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'nonexistent', password: 'test_password_123' },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('clears session cookie', async () => {
    const { cookie } = await registerTestPlayer(server, 'logoutuser');

    const response = await server.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: authHeaders(cookie),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });

  it('logout set-cookie includes HttpOnly and Path (Bug #11)', async () => {
    const { cookie } = await registerTestPlayer(server, 'logoutcookie');

    const response = await server.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: authHeaders(cookie),
    });

    expect(response.statusCode).toBe(200);
    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    // clearCookie should use full sessionCookieOptions (HttpOnly, SameSite, Path)
    expect(cookieStr).toMatch(/HttpOnly/i);
    expect(cookieStr).toMatch(/Path=\//i);
    expect(cookieStr).toMatch(/SameSite=Lax/i);
  });

  it('invalidates session after logout', async () => {
    const { cookie } = await registerTestPlayer(server, 'logouttest2');

    // Logout
    await server.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: authHeaders(cookie),
    });

    // Try to access protected route with old session
    const stateRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });

    expect(stateRes.statusCode).toBe(401);
  });
});

describe('Protected routes', () => {
  it('returns 401 without session cookie', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/me/state',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 with invalid session cookie', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: { cookie: 'session_id=00000000-0000-0000-0000-000000000000' },
    });

    expect(response.statusCode).toBe(401);
  });
});
