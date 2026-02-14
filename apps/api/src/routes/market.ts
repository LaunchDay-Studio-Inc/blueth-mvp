/**
 * Market Routes — BCE Market API endpoints.
 *
 * GET  /market/goods            — List all tradeable goods with ref prices
 * GET  /market/:goodCode/book   — Order book (top N bids/asks + ref price + halt status)
 * GET  /market/:goodCode/history — Trade history + ref price points
 * POST /market/orders           — Place an order (creates MARKET_PLACE_ORDER action)
 * POST /market/orders/:id/cancel — Cancel an order (creates MARKET_CANCEL_ORDER action)
 * POST /market/daytrade         — Day trade session (creates MARKET_DAY_TRADE_SESSION action)
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '@blueth/core';
import { submitAction, resolveAllDue } from '../services/action-engine';
import { listMarketGoods, getOrderBook, getTradeHistory } from '../services/market-service';

export const marketRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /market/goods
   * List all tradeable goods with current reference prices.
   */
  server.get('/goods', async () => {
    return listMarketGoods();
  });

  /**
   * GET /market/:goodCode/book
   * Get order book for a specific good.
   */
  server.get<{ Params: { goodCode: string } }>('/:goodCode/book', async (request) => {
    return getOrderBook(request.params.goodCode);
  });

  /**
   * GET /market/:goodCode/history
   * Get trade history for a specific good.
   */
  server.get<{ Params: { goodCode: string }; Querystring: { limit?: string } }>(
    '/:goodCode/history',
    async (request) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      return getTradeHistory(request.params.goodCode, limit);
    }
  );

  /**
   * POST /market/orders
   * Place a market or limit order.
   *
   * Body: {
   *   goodCode: GoodCode,
   *   side: 'buy' | 'sell',
   *   orderType: 'limit' | 'market',
   *   priceCents?: number,    // required for limit
   *   qty: number,
   *   idempotencyKey: string  // for the action
   * }
   */
  server.post('/orders', async (request, reply) => {
    const bodySchema = z.object({
      goodCode: z.string(),
      side: z.string(),
      orderType: z.string(),
      priceCents: z.number().int().positive().optional(),
      qty: z.number().positive(),
      idempotencyKey: z.string().min(1).max(255),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const playerId = request.player!.id;

    // Resolve any pending actions first
    await resolveAllDue(playerId);

    const result = await submitAction({
      playerId,
      type: 'MARKET_PLACE_ORDER',
      payload: {
        goodCode: parsed.data.goodCode,
        side: parsed.data.side,
        orderType: parsed.data.orderType,
        priceCents: parsed.data.priceCents,
        qty: parsed.data.qty,
        idempotencyKey: parsed.data.idempotencyKey,
      },
      idempotencyKey: parsed.data.idempotencyKey,
    });

    reply.status(200).send(result);
  });

  /**
   * POST /market/orders/:id/cancel
   * Cancel an existing order.
   */
  server.post<{ Params: { id: string } }>('/orders/:id/cancel', async (request, reply) => {
    const playerId = request.player!.id;
    const orderId = request.params.id;

    // Use a unique idempotency key for cancellation
    const idempotencyKey = `cancel-${orderId}`;

    await resolveAllDue(playerId);

    const result = await submitAction({
      playerId,
      type: 'MARKET_CANCEL_ORDER',
      payload: { orderId },
      idempotencyKey,
    });

    reply.status(200).send(result);
  });

  /**
   * POST /market/daytrade
   * Execute a day trade session.
   *
   * Body: {
   *   idempotencyKey: string
   * }
   */
  server.post('/daytrade', async (request, reply) => {
    const bodySchema = z.object({
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
      type: 'MARKET_DAY_TRADE_SESSION',
      payload: {},
      idempotencyKey: parsed.data.idempotencyKey,
    });

    reply.status(200).send(result);
  });
};
