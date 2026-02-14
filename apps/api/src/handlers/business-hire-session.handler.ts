/**
 * Business Hire Session Handler
 *
 * Action type: BUSINESS_HIRE_SESSION
 * Duration: 0 (instant)
 * Vigor cost: SV-6, MV-4 (hiring session)
 *
 * Hires an NPC worker for a business.
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
import { hireWorker } from '../services/business-service';

const HireSessionPayloadSchema = z.object({
  businessId: z.string().uuid(),
  wageCents: z.number().int().min(0),
  hoursPerDay: z.number().int().min(1).max(24),
});

type HireSessionPayload = z.infer<typeof HireSessionPayloadSchema>;

export const businessHireSessionHandler: ActionHandler<HireSessionPayload> = {
  type: ACTION_TYPES.BUSINESS_HIRE_SESSION,

  durationSeconds() {
    return 0;
  },

  validatePayload(raw: unknown): HireSessionPayload {
    const result = HireSessionPayloadSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
    }
    return result.data;
  },

  checkPreconditions(_payload, state) {
    const cost = BUSINESS_VIGOR_COSTS.HIRE_SESSION;
    if (state.sv < cost.sv) {
      throw new ValidationError(`Insufficient SV: need ${cost.sv}, have ${state.sv}`);
    }
    if (state.mv < cost.mv) {
      throw new ValidationError(`Insufficient MV: need ${cost.mv}, have ${state.mv}`);
    }
  },

  async resolve(ctx) {
    const { tx, playerId, payload, playerState } = ctx;
    const vigor = extractVigor(playerState);
    const caps = extractCaps(playerState);

    // Charge vigor
    const cost = BUSINESS_VIGOR_COSTS.HIRE_SESSION;
    const { vigor: newVigor } = subVigor(vigor, cost, caps);

    await tx.query(
      `UPDATE player_state SET mv = $2, sv = $3 WHERE player_id = $1`,
      [playerId, newVigor.mv, newVigor.sv]
    );

    const result = await hireWorker(tx, {
      playerId,
      businessId: payload.businessId,
      wageCents: payload.wageCents,
      hoursPerDay: payload.hoursPerDay,
    });

    return result;
  },
};
