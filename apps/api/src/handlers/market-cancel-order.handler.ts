/**
 * Market Cancel Order Handler
 *
 * Action type: MARKET_CANCEL_ORDER
 * Duration: 0 (instant)
 * No vigor cost for cancellation.
 */

import {
  ACTION_TYPES,
  ValidationError,
} from '@blueth/core';
import { z } from 'zod';
import type { ActionHandler } from './registry';
import { cancelOrder } from '../services/market-service';

const CancelOrderPayloadSchema = z.object({
  orderId: z.string().uuid(),
});

type CancelOrderPayload = z.infer<typeof CancelOrderPayloadSchema>;

export const marketCancelOrderHandler: ActionHandler<CancelOrderPayload> = {
  type: ACTION_TYPES.MARKET_CANCEL_ORDER,

  durationSeconds() {
    return 0; // instant
  },

  validatePayload(raw: unknown): CancelOrderPayload {
    const result = CancelOrderPayloadSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
    }
    return result.data;
  },

  checkPreconditions() {
    // No preconditions for cancellation
  },

  async resolve(ctx) {
    const result = await cancelOrder(ctx.playerId, ctx.payload.orderId, ctx.tx);
    return result;
  },
};
