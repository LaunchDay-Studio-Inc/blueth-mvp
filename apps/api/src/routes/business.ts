/**
 * Business Routes — Business management API endpoints.
 *
 * POST /business/register         — Register a new business
 * POST /business/machinery        — Buy machinery
 * POST /business/hire             — Hire a worker
 * POST /business/production/start — Start a production job
 * GET  /business                  — List player's businesses
 * GET  /business/:businessId      — Get business details
 * GET  /business/:businessId/workers    — List business workers
 * GET  /business/:businessId/jobs       — List production jobs
 * GET  /business/:businessId/inventory  — List business inventory
 * GET  /business/recipes                — List all recipes
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '@blueth/core';
import { submitAction, resolveAllDue } from '../services/action-engine';
import {
  getBusinessesForPlayer,
  getBusinessById,
  getBusinessWorkers,
  getProductionJobs,
  getBusinessInventory,
  listRecipes,
} from '../services/business-service';

export const businessRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /business/recipes
   * List all available recipes.
   */
  server.get('/recipes', async () => {
    return listRecipes();
  });

  /**
   * GET /business
   * List all businesses owned by the current player.
   */
  server.get('/', async (request) => {
    const playerId = request.player!.id;
    return getBusinessesForPlayer(playerId);
  });

  /**
   * GET /business/:businessId
   * Get details for a specific business.
   */
  server.get<{ Params: { businessId: string } }>(
    '/:businessId',
    async (request) => {
      const playerId = request.player!.id;
      const biz = await getBusinessById(request.params.businessId, playerId);
      if (!biz) {
        throw new ValidationError('Business not found');
      }
      return biz;
    }
  );

  /**
   * GET /business/:businessId/workers
   * List workers for a business.
   */
  server.get<{ Params: { businessId: string } }>(
    '/:businessId/workers',
    async (request) => {
      const playerId = request.player!.id;
      // Verify ownership
      const biz = await getBusinessById(request.params.businessId, playerId);
      if (!biz) throw new ValidationError('Business not found');
      return getBusinessWorkers(request.params.businessId);
    }
  );

  /**
   * GET /business/:businessId/jobs
   * List production jobs for a business.
   */
  server.get<{ Params: { businessId: string } }>(
    '/:businessId/jobs',
    async (request) => {
      const playerId = request.player!.id;
      const biz = await getBusinessById(request.params.businessId, playerId);
      if (!biz) throw new ValidationError('Business not found');
      return getProductionJobs(request.params.businessId);
    }
  );

  /**
   * GET /business/:businessId/inventory
   * List inventory for a business.
   */
  server.get<{ Params: { businessId: string } }>(
    '/:businessId/inventory',
    async (request) => {
      const playerId = request.player!.id;
      const biz = await getBusinessById(request.params.businessId, playerId);
      if (!biz) throw new ValidationError('Business not found');
      return getBusinessInventory(request.params.businessId);
    }
  );

  /**
   * POST /business/register
   * Register a new business.
   */
  server.post('/register', async (request, reply) => {
    const bodySchema = z.object({
      name: z.string().min(1).max(100),
      districtCode: z.string().min(1),
      idempotencyKey: z.string().min(1).max(255),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const playerId = request.player!.id;
    await resolveAllDue(playerId);

    const result = await submitAction({
      playerId,
      type: 'BUSINESS_REGISTER',
      payload: {
        name: parsed.data.name,
        districtCode: parsed.data.districtCode,
      },
      idempotencyKey: parsed.data.idempotencyKey,
    });

    reply.status(200).send(result);
  });

  /**
   * POST /business/machinery
   * Buy machinery for a business.
   */
  server.post('/machinery', async (request, reply) => {
    const bodySchema = z.object({
      businessId: z.string().uuid(),
      qty: z.number().int().positive().default(1),
      idempotencyKey: z.string().min(1).max(255),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const playerId = request.player!.id;
    await resolveAllDue(playerId);

    const result = await submitAction({
      playerId,
      type: 'BUSINESS_BUY_MACHINERY',
      payload: {
        businessId: parsed.data.businessId,
        qty: parsed.data.qty,
      },
      idempotencyKey: parsed.data.idempotencyKey,
    });

    reply.status(200).send(result);
  });

  /**
   * POST /business/hire
   * Hire an NPC worker for a business.
   */
  server.post('/hire', async (request, reply) => {
    const bodySchema = z.object({
      businessId: z.string().uuid(),
      wageCents: z.number().int().min(0),
      hoursPerDay: z.number().int().min(1).max(24),
      idempotencyKey: z.string().min(1).max(255),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const playerId = request.player!.id;
    await resolveAllDue(playerId);

    const result = await submitAction({
      playerId,
      type: 'BUSINESS_HIRE_SESSION',
      payload: {
        businessId: parsed.data.businessId,
        wageCents: parsed.data.wageCents,
        hoursPerDay: parsed.data.hoursPerDay,
      },
      idempotencyKey: parsed.data.idempotencyKey,
    });

    reply.status(200).send(result);
  });

  /**
   * POST /business/production/start
   * Start a production job.
   */
  server.post('/production/start', async (request, reply) => {
    const bodySchema = z.object({
      businessId: z.string().uuid(),
      recipeCode: z.string().min(1),
      idempotencyKey: z.string().min(1).max(255),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const playerId = request.player!.id;
    await resolveAllDue(playerId);

    const result = await submitAction({
      playerId,
      type: 'BUSINESS_START_PRODUCTION',
      payload: {
        businessId: parsed.data.businessId,
        recipeCode: parsed.data.recipeCode,
      },
      idempotencyKey: parsed.data.idempotencyKey,
    });

    reply.status(200).send(result);
  });
};
