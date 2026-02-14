import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import { queryOne } from '@blueth/db';

const SESSION_COOKIE = 'session_id';
const PUBLIC_PREFIXES = ['/health', '/auth'];

const authPluginImpl: FastifyPluginAsync = async (server) => {
  await server.register(cookie, {
    parseOptions: {},
  });

  server.decorateRequest('player', undefined);

  server.addHook('preHandler', async (request, reply) => {
    // Skip auth for public routes
    if (PUBLIC_PREFIXES.some((p) => request.url.startsWith(p))) return;

    const sessionId = request.cookies[SESSION_COOKIE];
    if (!sessionId) {
      return reply.status(401).send({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });
    }

    const row = await queryOne<{ player_id: string; username: string }>(
      `SELECT s.player_id, p.username
       FROM sessions s
       JOIN players p ON s.player_id = p.id
       WHERE s.id = $1 AND s.expires_at > NOW()`,
      [sessionId]
    );

    if (!row) {
      return reply.status(401).send({
        error: 'Session expired or invalid',
        code: 'SESSION_EXPIRED',
        statusCode: 401,
      });
    }

    request.player = { id: row.player_id, username: row.username };
  });
};

export const authPlugin = fp(authPluginImpl, {
  name: 'auth-plugin',
  fastify: '4.x',
});

/** Cookie options for session_id. */
export function sessionCookieOptions(isProduction: boolean) {
  return {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  };
}

export { SESSION_COOKIE };
