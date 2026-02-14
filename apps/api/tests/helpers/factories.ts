import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildServer } from '../../src/index';

let counter = 0;

/**
 * Build a fresh Fastify server instance for testing.
 * The server is NOT started (no listen), use inject() for requests.
 */
export async function createTestServer(): Promise<FastifyInstance> {
  const server = await buildServer();
  await server.ready();
  return server;
}

/**
 * Register a new test player and return the session cookie string.
 */
export async function registerTestPlayer(
  server: FastifyInstance,
  username?: string
): Promise<{ cookie: string; playerId: string; username: string }> {
  const name = username ?? `testplayer_${Date.now()}_${++counter}`;
  const response = await server.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      username: name,
      password: 'test_password_123',
    },
  });

  if (response.statusCode !== 201) {
    throw new Error(`Registration failed (${response.statusCode}): ${response.body}`);
  }

  const cookie = extractSessionCookie(response);
  const body = JSON.parse(response.body);

  return {
    cookie,
    playerId: body.playerId,
    username: name,
  };
}

/**
 * Extract the session_id cookie value from a response.
 */
export function extractSessionCookie(response: LightMyRequestResponse): string {
  const setCookie = response.headers['set-cookie'];
  if (!setCookie) throw new Error('No set-cookie header in response');
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return cookieStr.split(';')[0]; // "session_id=<uuid>"
}

/**
 * Make an authenticated request using inject().
 */
export function authHeaders(cookie: string): Record<string, string> {
  return { cookie };
}
