import type { FastifyInstance } from 'fastify';
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

describe('GET /me/state', () => {
  it('returns correct initial state after registration', async () => {
    const { cookie, playerId } = await registerTestPlayer(server, 'stateuser');

    const response = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });

    expect(response.statusCode).toBe(200);
    const state = JSON.parse(response.body);

    expect(state.playerId).toBe(playerId);
    expect(state.username).toBe('stateuser');
    expect(state.housingTier).toBe(1);
    expect(state.balanceCents).toBe(50000);
    expect(state.balanceFormatted).toBe('₿500.00');
    expect(state.sleepState).toBe('awake');
    expect(state.mealsEatenToday).toBe(0);
    expect(state.pendingActions).toBe(0);

    // Vigor should be 100 across all dimensions
    expect(state.vigor).toEqual({
      pv: 100, mv: 100, sv: 100, cv: 100, spv: 100,
    });

    // Default skills
    expect(state.skills).toEqual({
      labor: 0.1,
      admin: 0.1,
      service: 0.1,
      management: 0.1,
      trading: 0.1,
    });

    // Empty buffs
    expect(state.activeBuffs).toEqual([]);
  });
});
