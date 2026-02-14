import { FastifyPluginAsync } from 'fastify';
import { getFullPlayerState } from '../services/player.service';
import { resolveAllDue } from '../services/action-engine';
import { resetToken } from '../services/guest-token.service';

export const playerRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /me/state
   * Returns the full player state: vigor, money, housing, buffs, skills, etc.
   * Lazy-resolves all due actions before returning state.
   */
  server.get('/state', async (request) => {
    const playerId = request.player!.id;

    // Resolve any actions whose time has come before returning state
    await resolveAllDue(playerId);

    return getFullPlayerState(playerId);
  });

  /**
   * POST /me/token-reset
   * Rotate the guest Bearer token. Old token is invalidated immediately.
   */
  server.post('/token-reset', async (request) => {
    const playerId = request.player!.id;
    return resetToken(playerId);
  });
};
