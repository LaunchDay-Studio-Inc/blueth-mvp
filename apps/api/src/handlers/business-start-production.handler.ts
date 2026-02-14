/**
 * Business Start Production Handler
 *
 * Action type: BUSINESS_START_PRODUCTION
 * Duration: 0 (instant — the production job runs asynchronously via tick)
 * Vigor cost: MV-6, CV-2 (production planning)
 *
 * Starts a production job by reserving inputs from business inventory.
 * The tick worker completes the job when finishes_at <= now.
 */

import {
  ACTION_TYPES,
  ValidationError,
  subVigor,
  BUSINESS_VIGOR_COSTS,
} from '@blueth/core';
import { z } from 'zod';
import type { ActionHandler } from './registry';
import { extractVigor, extractCaps } from './registry';
import { startProduction } from '../services/business-service';

const StartProductionPayloadSchema = z.object({
  businessId: z.string().uuid(),
  recipeCode: z.string().min(1),
});

type StartProductionPayload = z.infer<typeof StartProductionPayloadSchema>;

export const businessStartProductionHandler: ActionHandler<StartProductionPayload> = {
  type: ACTION_TYPES.BUSINESS_START_PRODUCTION,

  durationSeconds() {
    return 0; // Instant — production job is tracked separately
  },

  validatePayload(raw: unknown): StartProductionPayload {
    const result = StartProductionPayloadSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
    }
    return result.data;
  },

  checkPreconditions(_payload, state) {
    const cost = BUSINESS_VIGOR_COSTS.PLAN_PRODUCTION;
    if (state.mv < cost.mv) {
      throw new ValidationError(`Insufficient MV: need ${cost.mv}, have ${state.mv}`);
    }
    if (state.cv < cost.cv) {
      throw new ValidationError(`Insufficient CV: need ${cost.cv}, have ${state.cv}`);
    }
  },

  async resolve(ctx) {
    const { tx, playerId, payload, playerState } = ctx;
    const vigor = extractVigor(playerState);
    const caps = extractCaps(playerState);

    // Charge vigor
    const cost = BUSINESS_VIGOR_COSTS.PLAN_PRODUCTION;
    const { vigor: newVigor } = subVigor(vigor, cost, caps);

    await tx.query(
      `UPDATE player_state SET mv = $2, cv = $3 WHERE player_id = $1`,
      [playerId, newVigor.mv, newVigor.cv]
    );

    const result = await startProduction(tx, {
      playerId,
      businessId: payload.businessId,
      recipeCode: payload.recipeCode,
    });

    return result;
  },
};
