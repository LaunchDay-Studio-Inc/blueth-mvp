import { createTestServer } from './helpers/factories';
import { cleanDatabase, teardown } from './helpers/setup';
import type { FastifyInstance } from 'fastify';

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

describe('Guest Auth', () => {
  it('POST /auth/guest creates a guest player and returns a token', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/guest',
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.token).toBeDefined();
    expect(body.playerId).toBeDefined();
    expect(body.username).toMatch(/^guest_[0-9a-f]{8}$/);
  });

  it('Bearer token authenticates to GET /me/state', async () => {
    // Create guest
    const guestRes = await server.inject({
      method: 'POST',
      url: '/auth/guest',
    });
    const { token } = JSON.parse(guestRes.body);

    // Use token to fetch state
    const stateRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(stateRes.statusCode).toBe(200);
    const state = JSON.parse(stateRes.body);
    expect(state.username).toMatch(/^guest_/);
    expect(state.balanceCents).toBe(50000); // Initial grant
  });

  it('POST /me/token-reset invalidates old token and returns new one', async () => {
    // Create guest
    const guestRes = await server.inject({
      method: 'POST',
      url: '/auth/guest',
    });
    const { token: oldToken } = JSON.parse(guestRes.body);

    // Reset token
    const resetRes = await server.inject({
      method: 'POST',
      url: '/me/token-reset',
      headers: {
        authorization: `Bearer ${oldToken}`,
      },
    });

    expect(resetRes.statusCode).toBe(200);
    const { token: newToken } = JSON.parse(resetRes.body);
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(oldToken);

    // Old token should no longer work
    const oldTokenRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: {
        authorization: `Bearer ${oldToken}`,
      },
    });
    expect(oldTokenRes.statusCode).toBe(401);

    // New token should work
    const newTokenRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: {
        authorization: `Bearer ${newToken}`,
      },
    });
    expect(newTokenRes.statusCode).toBe(200);
  });
});
