/**
 * Business Register Handler
 *
 * Action type: BUSINESS_REGISTER
 * Duration: 0 (instant)
 * Vigor cost: CV-6, MV-2 (compliance/admin)
 *
 * Registers a new business in a district.
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
import { registerBusiness } from '../services/business-service';

const RegisterPayloadSchema = z.object({
  name: z.string().min(1).max(100),
  districtCode: z.string().min(1),
});

type RegisterPayload = z.infer<typeof RegisterPayloadSchema>;

export const businessRegisterHandler: ActionHandler<RegisterPayload> = {
  type: ACTION_TYPES.BUSINESS_REGISTER,

  durationSeconds() {
    return 0;
  },

  validatePayload(raw: unknown): RegisterPayload {
    const result = RegisterPayloadSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
    }
    return result.data;
  },

  checkPreconditions(_payload, state) {
    const cost = BUSINESS_VIGOR_COSTS.COMPLIANCE_ADMIN;
    if (state.cv < cost.cv) {
      throw new ValidationError(`Insufficient CV: need ${cost.cv}, have ${state.cv}`);
    }
    if (state.mv < cost.mv) {
      throw new ValidationError(`Insufficient MV: need ${cost.mv}, have ${state.mv}`);
    }
  },

  async resolve(ctx) {
    const { tx, playerId, payload, playerState, actionId } = ctx;
    const vigor = extractVigor(playerState);
    const caps = extractCaps(playerState);

    // Charge vigor
    const cost = BUSINESS_VIGOR_COSTS.COMPLIANCE_ADMIN;
    const { vigor: newVigor } = subVigor(vigor, cost, caps);

    await tx.query(
      `UPDATE player_state SET mv = $2, cv = $3 WHERE player_id = $1`,
      [playerId, newVigor.mv, newVigor.cv]
    );

    // Register the business
    const result = await registerBusiness(tx, {
      playerId,
      name: payload.name,
      districtCode: payload.districtCode,
    }, actionId);

    return result;
  },
};
