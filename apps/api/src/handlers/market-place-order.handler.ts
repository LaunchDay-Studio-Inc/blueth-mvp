/**
 * Market Place Order Handler
 *
 * Action type: MARKET_PLACE_ORDER
 * Duration: 0 (instant)
 * Vigor cost: MV-4 per session (5-minute batching window)
 *
 * Places a market or limit order on the BCE market.
 * Includes rate limiting (max N orders/minute) and spam detection.
 */

import {
  ACTION_TYPES,
  ValidationError,
  subVigor,
  MARKET_ORDER_MV_COST,
  ORDER_RATE_LIMIT_PER_MIN,
  GoodCodeSchema,
  OrderSideSchema,
  OrderTypeSchema,
} from '@blueth/core';
import { z } from 'zod';
import type { ActionHandler } from './registry';
import { extractVigor, extractCaps } from './registry';
import { txQueryOne } from '../services/action-engine';
import {
  placeOrder,
  getOrCreateMarketSession,
  markSessionVigorCharged,
} from '../services/market-service';
import { detectOrderSpam } from '../services/anomaly-service';

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

    // C) API rate limit: check orders in last minute (inside transaction for consistency)
    const rateRow = await txQueryOne<{ cnt: string }>(
      tx,
      `SELECT COUNT(*) AS cnt FROM market_orders
       WHERE actor_type = 'player' AND actor_id = $1
       AND created_at > NOW() - interval '1 minute'`,
      [playerId],
    );
    const recentOrderCount = parseInt(rateRow?.cnt ?? '0', 10);
    if (recentOrderCount >= ORDER_RATE_LIMIT_PER_MIN) {
      throw new ValidationError(
        `Rate limit: max ${ORDER_RATE_LIMIT_PER_MIN} orders per minute (placed ${recentOrderCount})`
      );
    }

    // Handle market session: charge MV-4 once per 5 minutes
    const session = await getOrCreateMarketSession(tx, playerId);

    if (!session.alreadyCharged) {
      const vigorCost = { mv: MARKET_ORDER_MV_COST };
      const { vigor: newVigor } = subVigor(vigor, vigorCost, caps);

      await tx.query(
        `UPDATE player_state SET mv = $2 WHERE player_id = $1`,
        [playerId, Math.round(newVigor.mv)]
      );

      await markSessionVigorCharged(tx, session.sessionId);
    }

    // Place the order via market service (using action engine's transaction)
    const result = await placeOrder({
      playerId,
      goodCode: payload.goodCode,
      side: payload.side,
      orderType: payload.orderType,
      priceCents: payload.priceCents,
      qty: payload.qty,
      idempotencyKey: payload.idempotencyKey,
    }, tx);

    // E) Non-blocking spam detection
    detectOrderSpam(playerId).catch(() => {});

    return result;
  },
};
