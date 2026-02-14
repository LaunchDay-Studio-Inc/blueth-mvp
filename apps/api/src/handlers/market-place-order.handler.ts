/**
 * Market Place Order Handler
 *
 * Action type: MARKET_PLACE_ORDER
 * Duration: 0 (instant)
 * Vigor cost: MV-4 per session (5-minute batching window)
 *
 * Places a market or limit order on the BCE market.
 */

import {
  ACTION_TYPES,
  ValidationError,
  subVigor,
  MARKET_ORDER_MV_COST,
  GoodCodeSchema,
  OrderSideSchema,
  OrderTypeSchema,
} from '@blueth/core';
import { z } from 'zod';
import type { ActionHandler } from './registry';
import { extractVigor, extractCaps } from './registry';
import {
  placeOrder,
  getOrCreateMarketSession,
  markSessionVigorCharged,
} from '../services/market-service';

const PlaceOrderPayloadSchema = z.object({
  goodCode: GoodCodeSchema,
  side: OrderSideSchema,
  orderType: OrderTypeSchema,
  priceCents: z.number().int().positive().optional(),
  qty: z.number().positive(),
  idempotencyKey: z.string().min(1).max(255),
});

type PlaceOrderPayload = z.infer<typeof PlaceOrderPayloadSchema>;

export const marketPlaceOrderHandler: ActionHandler<PlaceOrderPayload> = {
  type: ACTION_TYPES.MARKET_PLACE_ORDER,

  durationSeconds() {
    return 0; // instant
  },

  validatePayload(raw: unknown): PlaceOrderPayload {
    const result = PlaceOrderPayloadSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
    }
    if (result.data.orderType === 'limit' && !result.data.priceCents) {
      throw new ValidationError('Limit orders require a priceCents');
    }
    return result.data;
  },

  checkPreconditions(_payload, state) {
    // Ensure player has at least MV-4 for vigor cost (may be skipped if session already charged)
    if (state.mv < MARKET_ORDER_MV_COST) {
      throw new ValidationError(
        `Insufficient mental vigor: need MV ${MARKET_ORDER_MV_COST}, have ${state.mv}`
      );
    }
  },

  async resolve(ctx) {
    const { tx, playerId, payload, playerState } = ctx;
    const vigor = extractVigor(playerState);
    const caps = extractCaps(playerState);

    // Handle market session: charge MV-4 once per 5 minutes
    const session = await getOrCreateMarketSession(tx, playerId);

    if (!session.alreadyCharged) {
      const vigorCost = { mv: MARKET_ORDER_MV_COST };
      const { vigor: newVigor } = subVigor(vigor, vigorCost, caps);

      await tx.query(
        `UPDATE player_state SET mv = $2 WHERE player_id = $1`,
        [playerId, newVigor.mv]
      );

      await markSessionVigorCharged(tx, session.sessionId);
    }

    // Place the order via market service
    const result = await placeOrder({
      playerId,
      goodCode: payload.goodCode,
      side: payload.side,
      orderType: payload.orderType,
      priceCents: payload.priceCents,
      qty: payload.qty,
      idempotencyKey: payload.idempotencyKey,
    });

    return result;
  },
};
