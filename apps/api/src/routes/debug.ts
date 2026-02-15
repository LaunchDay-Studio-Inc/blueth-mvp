/**
 * Debug routes — only registered when NODE_ENV !== 'production'.
 * Provides a time fast-forward tool for testing action completion.
 */

import { FastifyPluginAsync } from 'fastify';
import { execute } from '@blueth/db';
import { resolveAllDue } from '../services/action-engine';
import { getFullPlayerState } from '../services/player.service';
import { ValidationError } from '@blueth/core';

export const debugRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /debug/advance
   * Fast-forward time for the authenticated player's actions.
   *
   * Moves all scheduled actions' `scheduled_for` backwards by `minutes`,
   * making them immediately due. Then resolves all due actions and returns
   * the updated player state.
   *
   * Body: { minutes: number } (1..1440)
   */
  server.post<{ Body: { minutes: number } }>('/advance', async (request) => {
    const { minutes } = request.body ?? {};

    if (typeof minutes !== 'number' || minutes < 1 || minutes > 1440) {
      throw new ValidationError('minutes must be a number between 1 and 1440');
    }

    const playerId = request.player!.id;

    // Shift scheduled_for backwards by N minutes for all of this player's
    // non-completed actions. This is equivalent to advancing time forward.
    const shifted = await execute(
      `UPDATE actions
       SET scheduled_for = scheduled_for - ($2 || ' minutes')::interval
       WHERE player_id = $1
       AND status IN ('pending', 'scheduled', 'running')`,
      [playerId, minutes.toString()]
    );

    // Now resolve all due actions (those whose completion time is now in the past)
    await resolveAllDue(playerId);

    // Return updated state + a summary of what happened
    const state = await getFullPlayerState(playerId);

    return {
      advanced: minutes,
      actionsShifted: shifted,
      state,
    };
  });
};
