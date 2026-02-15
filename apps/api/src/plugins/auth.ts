import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import crypto from 'crypto';
import { queryOne } from '@blueth/db';

const SESSION_COOKIE = 'session_id';
const PUBLIC_PREFIXES = ['/health', '/auth', '/ready'];

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

const authPluginImpl: FastifyPluginAsync = async (server) => {
  await server.register(cookie, {
    parseOptions: {},
  });

  server.decorateRequest('player', undefined);

  server.addHook('preHandler', async (request, reply) => {
    // Skip auth for public routes
    if (PUBLIC_PREFIXES.some((p) => request.url.startsWith(p))) return;

    // 1. Try cookie-based session auth (existing path)
    const sessionId = request.cookies[SESSION_COOKIE];
    if (sessionId) {
      const row = await queryOne<{ player_id: string; username: string }>(
        `SELECT s.player_id, p.username
         FROM sessions s
         JOIN players p ON s.player_id = p.id
         WHERE s.id = $1 AND s.expires_at > NOW()`,
        [sessionId]
      );
      if (row) {
        request.player = { id: row.player_id, username: row.username };
        return;
      }
    }

    // 2. Try Bearer token auth (guest / itch.io path)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const raw = authHeader.slice(7);
      const tokenHash = hashToken(raw);
      const row = await queryOne<{ player_id: string; username: string }>(
        `SELECT gt.player_id, p.username
         FROM guest_tokens gt
         JOIN players p ON gt.player_id = p.id
         WHERE gt.token_hash = $1 AND gt.expires_at > NOW()`,
        [tokenHash]
      );
      if (row) {
        request.player = { id: row.player_id, username: row.username };
        return;
      }
    }

    // Neither auth method succeeded
    return reply.status(401).send({
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
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
