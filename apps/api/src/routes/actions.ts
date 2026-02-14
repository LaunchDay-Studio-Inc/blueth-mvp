import { FastifyPluginAsync } from 'fastify';
import { SubmitActionSchema } from '../schemas/action.schemas';
import { submitAction, getActionQueue, getActionById, resolveAllDue } from '../services/action-engine';
import { ValidationError, NotFoundError } from '@blueth/core';

export const actionRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /actions
   * Submit an action to the player's queue.
   */
  server.post('/', async (request, reply) => {
    const parsed = SubmitActionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const playerId = request.player!.id;

    // Resolve any due actions before processing new submission
    await resolveAllDue(playerId);

    const result = await submitAction({
      playerId,
      type: parsed.data.type,
      payload: parsed.data.payload,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    const statusCode = result.status === 'completed' ? 200 : 202;
    reply.status(statusCode).send(result);
  });

  /**
   * GET /actions/queue
   * List all pending/scheduled/running actions for the authenticated player.
   */
  server.get('/queue', async (request) => {
    const playerId = request.player!.id;
    await resolveAllDue(playerId);
    return getActionQueue(playerId);
  });

  /**
   * GET /actions/:id
   * Get a single action by ID (must belong to the authenticated player).
   */
  server.get<{ Params: { id: string } }>('/:id', async (request) => {
    const action = await getActionById(request.params.id, request.player!.id);
    if (!action) {
      throw new NotFoundError('Action', request.params.id);
    }
    return action;
  });
};
