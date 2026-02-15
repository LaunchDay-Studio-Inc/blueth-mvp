import { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { RegisterSchema, LoginSchema } from '../schemas/auth.schemas';
import * as authService from '../services/auth.service';
import { SESSION_COOKIE, sessionCookieOptions } from '../plugins/auth';
import { ValidationError } from '@blueth/core';

export const authRoutes: FastifyPluginAsync = async (server) => {
  // Tighter rate limit on auth endpoints: 10/min in production, relaxed in dev/test
  const isProduction = process.env.NODE_ENV === 'production';
  await server.register(rateLimit, {
    max: isProduction ? 10 : 1000,
    timeWindow: '1 minute',
  });

  /**
   * POST /auth/register
   * Create a new account with full player bootstrap.
   */
  server.post('/register', async (request, reply) => {
    const parsed = RegisterSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const result = await authService.register(parsed.data.username, parsed.data.password);
    const isProduction = process.env.NODE_ENV === 'production';

    reply
      .setCookie(SESSION_COOKIE, result.sessionId, sessionCookieOptions(isProduction))
      .status(201)
      .send({
        playerId: result.playerId,
        username: result.username,
      });
  });

  /**
   * POST /auth/login
   * Authenticate and create a new session.
   */
  server.post('/login', async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const result = await authService.login(parsed.data.username, parsed.data.password);
    const isProduction = process.env.NODE_ENV === 'production';

    reply
      .setCookie(SESSION_COOKIE, result.sessionId, sessionCookieOptions(isProduction))
      .send({
        playerId: result.playerId,
        username: result.username,
      });
  });

  /**
   * POST /auth/guest
   * Create a guest account with Bearer token auth (for itch.io / cross-origin).
   */
  server.post('/guest', async (_request, reply) => {
    const result = await authService.guestRegister();
    reply.status(201).send({
      token: result.token,
      playerId: result.playerId,
      username: result.username,
    });
  });

  /**
   * POST /auth/logout
   * Clear the session.
   */
  server.post('/logout', async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (sessionId) {
      await authService.logout(sessionId);
    }
    const isProduction = process.env.NODE_ENV === 'production';
    reply.clearCookie(SESSION_COOKIE, sessionCookieOptions(isProduction)).send({ ok: true });
  });
};
