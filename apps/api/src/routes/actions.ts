import { FastifyPluginAsync } from 'fastify';
import { SubmitActionSchema } from '../schemas/action.schemas';
import { submitAction, getActionQueue, getActionHistory, getActionById, resolveAllDue, getQueueEndTime } from '../services/action-engine';
import { getFullPlayerState } from '../services/player.service';
import {
  ValidationError,
  NotFoundError,
  DomainError,
  projectActionOutcome,
  getShiftVigorCost,
  calculatePerformance,
  calculateShiftPay,
  JOBS_CATALOG,
  SHIFT_HOURS,
  MEAL_PRICES_CENTS,
  MEAL_DEFINITIONS,
  MARKET_ORDER_MV_COST,
  computeSoftGates,
} from '@blueth/core';
import type { JobFamily, ShiftDuration, MealQuality, VigorDimension } from '@blueth/core';

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

    try {
      const result = await submitAction({
        playerId,
        type: parsed.data.type,
        payload: parsed.data.payload,
        idempotencyKey: parsed.data.idempotencyKey,
      });

      const statusCode = result.status === 'completed' ? 200 : 202;
      reply.status(statusCode).send(result);
    } catch (err) {
      // Augment DomainError responses with suggestions field
      if (err instanceof DomainError) {
        const augmented = err as DomainError & { suggestions?: string[] };
        reply.status(err.statusCode).send({
          code: err.code,
          message: err.message,
          suggestions: augmented.suggestions ?? [],
        });
        return;
      }
      throw err;
    }
  });

  /**
   * POST /actions/preview
   * Preview the projected outcome of an action before committing.
   * Returns projected vigor delta, money delta, completion time, warnings, soft-gates.
   */
  server.post('/preview', async (request) => {
    const parsed = SubmitActionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const playerId = request.player!.id;
    const { type, payload } = parsed.data;

    // Get current state
    const state = await getFullPlayerState(playerId);
    const queueEndTime = await getQueueEndTime(playerId);

    const vigor = state.vigor;
    const caps = state.caps;
    const balanceCents = state.balanceCents;

    // Build projection based on action type
    let vigorCost: Partial<VigorDimension> = {};
    let vigorGain: Partial<VigorDimension> = {};
    let moneyCostCents = 0;
    let moneyGainCents = 0;
    let durationSeconds = 0;

    switch (type) {
      case 'SLEEP': {
        const hours = (payload as Record<string, unknown>)?.hours as number ?? 8;
        durationSeconds = hours * 3600;
        // Estimated regen gain (base rates, no circadian/buff adjustment)
        vigorGain = { pv: 2 * hours, mv: 1.5 * hours, sv: 1 * hours, cv: 0.5 * hours, spv: 0.3 * hours };
        break;
      }

      case 'EAT_MEAL': {
        const quality = ((payload as Record<string, unknown>)?.quality as string ?? 'STREET_FOOD') as MealQuality;
        moneyCostCents = MEAL_PRICES_CENTS[quality] ?? 300;
        const mealDef = MEAL_DEFINITIONS[quality];
        if (mealDef?.instantDelta) {
          vigorGain = { ...mealDef.instantDelta };
        }
        durationSeconds = 0;
        break;
      }

      case 'WORK_SHIFT': {
        const jobFamily = ((payload as Record<string, unknown>)?.jobFamily as string ?? 'physical') as JobFamily;
        const duration = ((payload as Record<string, unknown>)?.duration as string ?? 'full') as ShiftDuration;
        vigorCost = getShiftVigorCost(jobFamily, duration);
        durationSeconds = SHIFT_HOURS[duration] * 3600;

        const job = JOBS_CATALOG.find((j) => j.family === jobFamily);
        if (job) {
          const familyToSkill: Record<string, string> = {
            physical: 'labor', admin: 'admin', service: 'service', management: 'management',
          };
          const skillName = familyToSkill[jobFamily] ?? 'labor';
          const skill = (state.skills as Record<string, number>)[skillName] ?? 0.1;
          const perf = calculatePerformance(jobFamily, skill, vigor);
          moneyGainCents = calculateShiftPay(job.baseWageDaily, perf, duration);
        }
        break;
      }

      case 'LEISURE': {
        durationSeconds = 3600;
        vigorGain = { mv: 4, spv: 2 };
        break;
      }

      case 'SOCIAL_CALL': {
        durationSeconds = 900;
        vigorGain = { sv: 3, mv: 1 };
        break;
      }

      case 'MARKET_PLACE_ORDER': {
        durationSeconds = 0;
        vigorCost = { mv: MARKET_ORDER_MV_COST };
        break;
      }

      default:
        break;
    }

    const projection = projectActionOutcome({
      currentVigor: vigor,
      caps,
      vigorCost,
      vigorGain,
      moneyCostCents,
      moneyGainCents,
      durationSeconds,
      currentBalanceCents: balanceCents,
      queueEndTime,
    });

    const softGates = computeSoftGates(vigor);

    return { ...projection, softGates };
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
   * GET /actions/history
   * List recent completed/failed actions for the authenticated player.
   */
  server.get('/history', async (request) => {
    const playerId = request.player!.id;
    await resolveAllDue(playerId);
    return getActionHistory(playerId);
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
