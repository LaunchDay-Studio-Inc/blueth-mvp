/**
 * Business Buy Machinery Handler
 *
 * Action type: BUSINESS_BUY_MACHINERY
 * Duration: 0 (instant)
 * Vigor cost: CV-6, MV-2 (compliance/admin)
 *
 * Purchases industrial machinery for a business.
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
import { buyMachinery } from '../services/business-service';

const BuyMachineryPayloadSchema = z.object({
  businessId: z.string().uuid(),
  qty: z.number().int().positive().default(1),
});

type BuyMachineryPayload = z.infer<typeof BuyMachineryPayloadSchema>;

export const businessBuyMachineryHandler: ActionHandler<BuyMachineryPayload> = {
  type: ACTION_TYPES.BUSINESS_BUY_MACHINERY,

  durationSeconds() {
    return 0;
  },

  validatePayload(raw: unknown): BuyMachineryPayload {
    const result = BuyMachineryPayloadSchema.safeParse(raw);
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

    const result = await buyMachinery(tx, playerId, payload.businessId, payload.qty, actionId);
    return result;
  },
};
