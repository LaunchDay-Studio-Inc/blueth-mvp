/**
 * Market Service — BCE Market matching engine and order management.
 *
 * Handles:
 *   - Order placement (market + limit orders)
 *   - Order matching (price-time priority)
 *   - Order cancellation
 *   - Circuit breaker enforcement
 *   - Fee collection
 *   - Inventory and ledger transfers
 *   - Market session vigor cost tracking
 *   - NPC maker order refresh (called from tick service)
 *
 * NPC Vendor Sink/Source:
 *   The NPC_VENDOR (account ID 5) acts as "the world" — an explicit money
 *   source and sink. When NPC buys, money flows from NPC_VENDOR to player.
 *   When NPC sells, money flows from player to NPC_VENDOR. The NPC_VENDOR
 *   balance can go negative (money creation) or positive (money destruction).
 *   This is intentional and preserves ledger integrity:
 *   every entry has a valid from/to pair, and the total created/destroyed
 *   is always visible via the NPC_VENDOR account balance.
 */

import type { PoolClient } from 'pg';
import { transferCents, withTransaction, query, queryOne } from '@blueth/db';
import {
  SYSTEM_ACCOUNTS,
  LEDGER_ENTRY_TYPES,
  MARKET_FEE_RATE,
  calculateMarketFee,
  calculateRefPrice,
  calculateNpcPrices,
  computeNpcDemandSupply,
  shouldTriggerCircuitBreaker,
  isMarketHalted,
  CIRCUIT_BREAKER_HALT_MS,
  MARKET_ALPHA,
  MARKET_SPREAD_BPS,
  NPC_ESSENTIAL_ORDER_QTY,
  NPC_NON_ESSENTIAL_ORDER_QTY,
  GOOD_BASE_PRICES,
  ORDER_BOOK_DEPTH,
  MARKET_SESSION_WINDOW_MS,
  InsufficientFundsError,
  InsufficientInventoryError,
  MarketHaltedError,
  ValidationError,
  NotFoundError,
} from '@blueth/core';
import type { GoodCode, OrderSide } from '@blueth/core';
import { txQueryOne } from './action-engine';
import { createLogger } from './observability';

const logger = createLogger('market');

// ── Types ────────────────────────────────────────────────────

export interface MarketOrderRow {
  order_id: string;
  actor_type: string;
  actor_id: string | null;
  good_id: number;
  side: string;
  order_type: string;
  price_cents: number | null;
  qty_open: string;
  qty_initial: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MarketTradeRow {
  trade_id: string;
  good_id: number;
  buy_order_id: string;
  sell_order_id: string;
  price_cents: number;
  qty: string;
  fee_cents: number;
  created_at: string;
}

export interface NpcMarketStateRow {
  good_id: number;
  demand: string;
  supply: string;
  ref_price_cents: number;
  last_6h_ref_price_cents: number;
  market_halt_until: string | null;
  alpha: string;
  spread_bps: number;
  widened_spread_until: string | null;
  last_npc_refresh: string;
  updated_at: string;
}

export interface GoodRow {
  id: number;
  code: string;
  name: string;
  is_essential: boolean;
}

export interface PlaceOrderInput {
  playerId: string;
  goodCode: GoodCode;
  side: OrderSide;
  orderType: 'limit' | 'market';
  priceCents?: number;
  qty: number;
  idempotencyKey: string;
}

export interface PlaceOrderResult {
  orderId: string;
  status: string;
  fills: TradeResult[];
  qtyRemaining: number;
}

export interface TradeResult {
  tradeId: string;
  priceCents: number;
  qty: number;
  feeCents: number;
}

// ── Helpers ──────────────────────────────────────────────────

async function getGoodByCode(tx: PoolClient, code: string): Promise<GoodRow> {
  const row = await txQueryOne<GoodRow>(
    tx,
    'SELECT * FROM goods WHERE code = $1',
    [code]
  );
  if (!row) throw new ValidationError(`Unknown good: ${code}`);
  return row;
}

async function getNpcMarketState(tx: PoolClient, goodId: number): Promise<NpcMarketStateRow> {
  const row = await txQueryOne<NpcMarketStateRow>(
    tx,
    'SELECT * FROM npc_market_state WHERE good_id = $1 FOR UPDATE',
    [goodId]
  );
  if (!row) throw new ValidationError(`No market state for good_id ${goodId}`);
  return row;
}

async function getPlayerAccountId(tx: PoolClient, playerId: string): Promise<number> {
  const wallet = await txQueryOne<{ account_id: string }>(
    tx,
    'SELECT account_id FROM player_wallets WHERE player_id = $1',
    [playerId]
  );
  if (!wallet) throw new ValidationError('Player wallet not found');
  return parseInt(wallet.account_id, 10);
}

async function getBalanceInTx(tx: PoolClient, accountId: number): Promise<number> {
  const row = await txQueryOne<{ balance: string }>(
    tx,
    `SELECT
       COALESCE(SUM(CASE WHEN to_account = $1 THEN amount_cents ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN from_account = $1 THEN amount_cents ELSE 0 END), 0)
       AS balance
     FROM ledger_entries
     WHERE from_account = $1 OR to_account = $1`,
    [accountId]
  );
  return parseInt(row?.balance ?? '0', 10);
}

async function getInventoryQty(
  tx: PoolClient,
  ownerType: string,
  ownerId: string | null,
  goodId: number,
): Promise<number> {
  const row = await txQueryOne<{ qty: string }>(
    tx,
    `SELECT qty FROM inventories
     WHERE owner_type = $1 AND owner_id ${ownerId ? '= $2' : 'IS NULL'} AND good_id = $3`,
    ownerId ? [ownerType, ownerId, goodId] : [ownerType, goodId]
  );
  return parseFloat(row?.qty ?? '0');
}

async function adjustInventory(
  tx: PoolClient,
  ownerType: string,
  ownerId: string | null,
  goodId: number,
  delta: number,
): Promise<void> {
  if (delta === 0) return;

  // Upsert: create if not exists, adjust quantity
  await tx.query(
    `INSERT INTO inventories (owner_type, owner_id, good_id, qty)
     VALUES ($1, $2, $3, GREATEST(0, $4::numeric))
     ON CONFLICT (owner_type, owner_id, good_id)
     DO UPDATE SET qty = GREATEST(0, inventories.qty + $4::numeric), updated_at = NOW()`,
    [ownerType, ownerId, goodId, delta]
  );
}

// ── Market Session (vigor cost batching) ─────────────────────

/**
 * Get or create a market session for the player, charging MV-4 if needed.
 * Returns whether vigor was already charged in the current session.
 */
export async function getOrCreateMarketSession(
  tx: PoolClient,
  playerId: string,
): Promise<{ sessionId: string; alreadyCharged: boolean }> {
  const windowStart = new Date(Date.now() - MARKET_SESSION_WINDOW_MS).toISOString();

  // Find active session (order placed within last 5 minutes)
  const existing = await txQueryOne<{ id: string; vigor_charged: boolean }>(
    tx,
    `SELECT id, vigor_charged FROM market_sessions
     WHERE player_id = $1 AND last_order_at >= $2::timestamptz
     ORDER BY last_order_at DESC LIMIT 1`,
    [playerId, windowStart]
  );

  if (existing) {
    // Update last activity
    await tx.query(
      `UPDATE market_sessions SET last_order_at = NOW(), order_count = order_count + 1
       WHERE id = $1`,
      [existing.id]
    );
    return { sessionId: existing.id, alreadyCharged: existing.vigor_charged };
  }

  // Create new session
  const newSession = await txQueryOne<{ id: string }>(
    tx,
    `INSERT INTO market_sessions (player_id, vigor_charged, order_count)
     VALUES ($1, FALSE, 1) RETURNING id`,
    [playerId]
  );

  return { sessionId: newSession!.id, alreadyCharged: false };
}

export async function markSessionVigorCharged(tx: PoolClient, sessionId: string): Promise<void> {
  await tx.query(
    'UPDATE market_sessions SET vigor_charged = TRUE WHERE id = $1',
    [sessionId]
  );
}

// ── Order Placement ──────────────────────────────────────────

/**
 * Place an order on the BCE market.
 *
 * For buy market orders: matches against best available sell orders.
 * For sell market orders: matches against best available buy orders.
 * For limit orders: if crosses the spread, fills immediately.
 * Remaining qty becomes a resting limit order.
 */
export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  return withTransaction(async (tx) => {
    const good = await getGoodByCode(tx, input.goodCode);
    const npcState = await getNpcMarketState(tx, good.id);
    const playerAccountId = await getPlayerAccountId(tx, input.playerId);
    const now = new Date();

    // Check circuit breaker
    const halted = npcState.market_halt_until
      ? isMarketHalted(new Date(npcState.market_halt_until), now)
      : false;

    if (halted && input.orderType === 'market') {
      throw new MarketHaltedError(
        input.goodCode,
        new Date(npcState.market_halt_until!)
      );
    }

    // Validate limit order price
    if (input.orderType === 'limit' && (!input.priceCents || input.priceCents <= 0)) {
      throw new ValidationError('Limit order requires a positive price');
    }

    // Validate quantity
    if (input.qty <= 0) {
      throw new ValidationError('Order quantity must be positive');
    }

    // For buy orders: check player has sufficient funds for estimated cost
    if (input.side === 'buy') {
      const estimatedPrice = input.orderType === 'limit'
        ? input.priceCents!
        : npcState.ref_price_cents;
      const estimatedCost = Math.floor(estimatedPrice * input.qty * (1 + MARKET_FEE_RATE));
      const balance = await getBalanceInTx(tx, playerAccountId);
      if (balance < estimatedCost) {
        throw new InsufficientFundsError(estimatedCost, balance);
      }
    }

    // For sell orders: check player has sufficient inventory
    if (input.side === 'sell') {
      const inventory = await getInventoryQty(tx, 'player', input.playerId, good.id);
      if (inventory < input.qty) {
        throw new InsufficientInventoryError(input.goodCode, input.qty, inventory);
      }
    }

    // Insert the order
    const orderRow = await txQueryOne<MarketOrderRow>(
      tx,
      `INSERT INTO market_orders
         (actor_type, actor_id, good_id, side, order_type, price_cents, qty_open, qty_initial, status)
       VALUES ('player', $1, $2, $3, $4, $5, $6, $6, 'open')
       RETURNING *`,
      [
        input.playerId,
        good.id,
        input.side,
        input.orderType,
        input.orderType === 'limit' ? input.priceCents : null,
        input.qty,
      ]
    );

    if (!orderRow) throw new Error('Failed to insert market order');

    // For sell orders: reserve inventory immediately
    if (input.side === 'sell') {
      await adjustInventory(tx, 'player', input.playerId, good.id, -input.qty);
    }

    // Match if allowed (not halted)
    let fills: TradeResult[] = [];
    if (!halted) {
      fills = await matchOrder(tx, orderRow, good, npcState, playerAccountId);
    }

    // Determine final status
    const finalOrder = await txQueryOne<MarketOrderRow>(
      tx,
      'SELECT * FROM market_orders WHERE order_id = $1',
      [orderRow.order_id]
    );

    // Update reference price based on trades
    if (fills.length > 0) {
      await updateRefPriceFromTrades(tx, good.id, npcState, fills);
    }

    return {
      orderId: orderRow.order_id,
      status: finalOrder?.status ?? orderRow.status,
      fills,
      qtyRemaining: parseFloat(finalOrder?.qty_open ?? '0'),
    };
  });
}

// ── Matching Engine ──────────────────────────────────────────

/**
 * Match an incoming order against the book.
 * Price-time priority: best price first, then oldest order first.
 */
async function matchOrder(
  tx: PoolClient,
  incomingOrder: MarketOrderRow,
  good: GoodRow,
  _npcState: NpcMarketStateRow,
  incomingPlayerAccountId: number,
): Promise<TradeResult[]> {
  const fills: TradeResult[] = [];
  const isBuy = incomingOrder.side === 'buy';
  const oppositeSide = isBuy ? 'sell' : 'buy';

  // Find matching orders on the opposite side
  // Buy matches against sells (lowest price first)
  // Sell matches against buys (highest price first)
  const priceOrder = isBuy ? 'ASC' : 'DESC';

  let qtyRemaining = parseFloat(incomingOrder.qty_open);

  while (qtyRemaining > 0) {
    // Build price condition for matching
    let priceCondition = '';
    const params: unknown[] = [good.id, oppositeSide];

    if (incomingOrder.order_type === 'limit') {
      if (isBuy) {
        // Buy limit: match sells at or below our price
        priceCondition = 'AND price_cents <= $3';
        params.push(incomingOrder.price_cents);
      } else {
        // Sell limit: match buys at or above our price
        priceCondition = 'AND price_cents >= $3';
        params.push(incomingOrder.price_cents);
      }
    }
    // Market orders: match at any price

    const matchQuery = `
      SELECT * FROM market_orders
      WHERE good_id = $1 AND side = $2
        AND status IN ('open', 'partial')
        AND order_type = 'limit'
        ${priceCondition}
      ORDER BY price_cents ${priceOrder}, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const counterOrder = await txQueryOne<MarketOrderRow>(tx, matchQuery, params);
    if (!counterOrder) break;

    const counterQty = parseFloat(counterOrder.qty_open);
    const fillQty = Math.min(qtyRemaining, counterQty);
    const fillPrice = counterOrder.price_cents!; // Limit orders always have a price

    // Calculate fee (split: buyer pays fee, seller pays fee)
    const totalFeeCents = calculateMarketFee(fillPrice, fillQty);
    const fillValueCents = Math.floor(fillPrice * fillQty);

    // Determine buyer and seller account IDs
    let buyerAccountId: number;
    let sellerAccountId: number;

    if (isBuy) {
      buyerAccountId = incomingPlayerAccountId;
      sellerAccountId = counterOrder.actor_type === 'npc'
        ? SYSTEM_ACCOUNTS.NPC_VENDOR
        : await getPlayerAccountId(tx, counterOrder.actor_id!);
    } else {
      buyerAccountId = counterOrder.actor_type === 'npc'
        ? SYSTEM_ACCOUNTS.NPC_VENDOR
        : await getPlayerAccountId(tx, counterOrder.actor_id!);
      sellerAccountId = incomingPlayerAccountId;
    }

    // Validate buyer has sufficient funds (including fee)
    const buyerCost = fillValueCents + totalFeeCents;
    if (buyerAccountId !== SYSTEM_ACCOUNTS.NPC_VENDOR) {
      const buyerBalance = await getBalanceInTx(tx, buyerAccountId);
      if (buyerBalance < buyerCost) {
        // If buyer can't afford full fill, skip this match
        break;
      }
    }

    // Execute the trade ledger entries:
    // 1. Buyer pays seller for goods
    if (fillValueCents > 0) {
      await transferCents(
        tx,
        buyerAccountId,
        sellerAccountId,
        fillValueCents,
        LEDGER_ENTRY_TYPES.MARKET_TRADE,
        null,
        `Market trade: ${fillQty} x ${good.code} @ ${fillPrice}c`
      );
    }

    // 2. Fee from buyer to TAX_SINK
    if (totalFeeCents > 0 && buyerAccountId !== SYSTEM_ACCOUNTS.TAX_SINK) {
      await transferCents(
        tx,
        buyerAccountId,
        SYSTEM_ACCOUNTS.TAX_SINK,
        totalFeeCents,
        LEDGER_ENTRY_TYPES.FEE,
        null,
        `Market fee: ${totalFeeCents}c on ${good.code} trade`
      );
    }

    // 3. Transfer goods to buyer
    const buyerOwnerId = isBuy ? incomingOrder.actor_id : counterOrder.actor_id;
    const buyerOwnerType = isBuy ? incomingOrder.actor_type : counterOrder.actor_type;

    if (buyerOwnerType === 'player' && buyerOwnerId) {
      await adjustInventory(tx, 'player', buyerOwnerId, good.id, fillQty);
    }
    // NPC doesn't need inventory tracking (infinite supply/demand from "the world")

    // 4. For sell side of the counter order: if it was a player resting sell,
    //    inventory was already reserved when the order was placed.
    //    For NPC counter-sells: no inventory needed (world supply).

    // Create trade record
    const buyOrderId = isBuy ? incomingOrder.order_id : counterOrder.order_id;
    const sellOrderId = isBuy ? counterOrder.order_id : incomingOrder.order_id;

    const tradeRow = await txQueryOne<MarketTradeRow>(
      tx,
      `INSERT INTO market_trades (good_id, buy_order_id, sell_order_id, price_cents, qty, fee_cents)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [good.id, buyOrderId, sellOrderId, fillPrice, fillQty, totalFeeCents]
    );

    // Update counter order
    const newCounterQty = counterQty - fillQty;
    const counterStatus = newCounterQty <= 0.000001 ? 'filled' : 'partial';
    await tx.query(
      'UPDATE market_orders SET qty_open = $2, status = $3 WHERE order_id = $1',
      [counterOrder.order_id, Math.max(0, newCounterQty), counterStatus]
    );

    // Update incoming order
    qtyRemaining -= fillQty;
    const incomingStatus = qtyRemaining <= 0.000001 ? 'filled' : 'partial';
    await tx.query(
      'UPDATE market_orders SET qty_open = $2, status = $3 WHERE order_id = $1',
      [incomingOrder.order_id, Math.max(0, qtyRemaining), incomingStatus]
    );

    fills.push({
      tradeId: tradeRow!.trade_id,
      priceCents: fillPrice,
      qty: fillQty,
      feeCents: totalFeeCents,
    });
  }

  // If market order has remaining qty and no more matches => cancel remainder
  if (incomingOrder.order_type === 'market' && qtyRemaining > 0.000001) {
    await tx.query(
      `UPDATE market_orders SET qty_open = 0, status = 'cancelled' WHERE order_id = $1`,
      [incomingOrder.order_id]
    );

    // Refund reserved inventory for unfilled sell portion
    if (incomingOrder.side === 'sell' && incomingOrder.actor_id) {
      await adjustInventory(tx, 'player', incomingOrder.actor_id, good.id, qtyRemaining);
    }
  }

  return fills;
}

// ── Reference Price Update ───────────────────────────────────

async function updateRefPriceFromTrades(
  tx: PoolClient,
  goodId: number,
  npcState: NpcMarketStateRow,
  fills: TradeResult[],
): Promise<void> {
  if (fills.length === 0) return;

  // Volume-weighted average price of fills
  let totalValue = 0;
  let totalQty = 0;
  for (const fill of fills) {
    totalValue += fill.priceCents * fill.qty;
    totalQty += fill.qty;
  }
  const vwap = totalQty > 0 ? Math.round(totalValue / totalQty) : npcState.ref_price_cents;

  // Blend toward VWAP: ref_price moves 20% toward the trade price
  const blendFactor = 0.2;
  const newRefPrice = Math.max(1, Math.round(
    npcState.ref_price_cents * (1 - blendFactor) + vwap * blendFactor
  ));

  // Check circuit breaker
  const now = new Date();
  let haltUntil = npcState.market_halt_until;

  if (shouldTriggerCircuitBreaker(newRefPrice, npcState.last_6h_ref_price_cents)) {
    haltUntil = new Date(now.getTime() + CIRCUIT_BREAKER_HALT_MS).toISOString();
    logger.warn('Circuit breaker triggered', {
      goodId,
      refPrice: newRefPrice,
      last6hPrice: npcState.last_6h_ref_price_cents,
    });

    // Set widened spread for 1 hour after halt ends
    const widenedUntil = new Date(
      new Date(haltUntil).getTime() + CIRCUIT_BREAKER_HALT_MS
    ).toISOString();

    await tx.query(
      `UPDATE npc_market_state
       SET ref_price_cents = $2, market_halt_until = $3, widened_spread_until = $4
       WHERE good_id = $1`,
      [goodId, newRefPrice, haltUntil, widenedUntil]
    );
  } else {
    await tx.query(
      'UPDATE npc_market_state SET ref_price_cents = $2 WHERE good_id = $1',
      [goodId, newRefPrice]
    );
  }
}

// ── Order Cancellation ───────────────────────────────────────

export async function cancelOrder(
  playerId: string,
  orderId: string,
): Promise<{ success: boolean }> {
  return withTransaction(async (tx) => {
    const order = await txQueryOne<MarketOrderRow>(
      tx,
      `SELECT * FROM market_orders
       WHERE order_id = $1 AND actor_type = 'player' AND actor_id = $2
       FOR UPDATE`,
      [orderId, playerId]
    );

    if (!order) throw new NotFoundError('Order', orderId);
    if (order.status === 'filled' || order.status === 'cancelled') {
      throw new ValidationError(`Cannot cancel order with status: ${order.status}`);
    }

    const qtyOpen = parseFloat(order.qty_open);

    // Cancel the order
    await tx.query(
      `UPDATE market_orders SET status = 'cancelled', qty_open = 0 WHERE order_id = $1`,
      [orderId]
    );

    // Refund reserved inventory for sell orders
    if (order.side === 'sell' && qtyOpen > 0 && order.actor_id) {
      await adjustInventory(tx, 'player', order.actor_id, order.good_id, qtyOpen);
    }

    return { success: true };
  });
}

// ── Market Queries ───────────────────────────────────────────

export interface OrderBookLevel {
  priceCents: number;
  totalQty: number;
  orderCount: number;
}

export interface OrderBookResponse {
  goodCode: string;
  refPriceCents: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  halted: boolean;
  haltedUntil: string | null;
}

export async function getOrderBook(goodCode: string): Promise<OrderBookResponse> {
  const good = await queryOne<GoodRow>(
    'SELECT * FROM goods WHERE code = $1',
    [goodCode]
  );
  if (!good) throw new NotFoundError('Good', goodCode);

  const npcState = await queryOne<NpcMarketStateRow>(
    'SELECT * FROM npc_market_state WHERE good_id = $1',
    [good.id]
  );
  if (!npcState) throw new NotFoundError('Market state', goodCode);

  const now = new Date();
  const halted = npcState.market_halt_until
    ? isMarketHalted(new Date(npcState.market_halt_until), now)
    : false;

  // Get top N bid levels
  const bids = await query<{ price_cents: string; total_qty: string; order_count: string }>(
    `SELECT price_cents, SUM(qty_open) as total_qty, COUNT(*) as order_count
     FROM market_orders
     WHERE good_id = $1 AND side = 'buy' AND status IN ('open', 'partial')
       AND order_type = 'limit'
     GROUP BY price_cents
     ORDER BY price_cents DESC
     LIMIT $2`,
    [good.id, ORDER_BOOK_DEPTH]
  );

  // Get top N ask levels
  const asks = await query<{ price_cents: string; total_qty: string; order_count: string }>(
    `SELECT price_cents, SUM(qty_open) as total_qty, COUNT(*) as order_count
     FROM market_orders
     WHERE good_id = $1 AND side = 'sell' AND status IN ('open', 'partial')
       AND order_type = 'limit'
     GROUP BY price_cents
     ORDER BY price_cents ASC
     LIMIT $2`,
    [good.id, ORDER_BOOK_DEPTH]
  );

  return {
    goodCode,
    refPriceCents: npcState.ref_price_cents,
    bids: bids.map((b) => ({
      priceCents: parseInt(b.price_cents, 10),
      totalQty: parseFloat(b.total_qty),
      orderCount: parseInt(b.order_count, 10),
    })),
    asks: asks.map((a) => ({
      priceCents: parseInt(a.price_cents, 10),
      totalQty: parseFloat(a.total_qty),
      orderCount: parseInt(a.order_count, 10),
    })),
    halted,
    haltedUntil: halted ? npcState.market_halt_until : null,
  };
}

export interface TradeHistoryEntry {
  tradeId: string;
  priceCents: number;
  qty: number;
  feeCents: number;
  createdAt: string;
}

export interface TradeHistoryResponse {
  goodCode: string;
  trades: TradeHistoryEntry[];
  refPriceHistory: Array<{ refPriceCents: number; timestamp: string }>;
}

export async function getTradeHistory(
  goodCode: string,
  limit: number = 50,
): Promise<TradeHistoryResponse> {
  const good = await queryOne<GoodRow>(
    'SELECT * FROM goods WHERE code = $1',
    [goodCode]
  );
  if (!good) throw new NotFoundError('Good', goodCode);

  const trades = await query<MarketTradeRow>(
    `SELECT * FROM market_trades
     WHERE good_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [good.id, limit]
  );

  const npcState = await queryOne<NpcMarketStateRow>(
    'SELECT * FROM npc_market_state WHERE good_id = $1',
    [good.id]
  );

  return {
    goodCode,
    trades: trades.map((t) => ({
      tradeId: t.trade_id,
      priceCents: t.price_cents,
      qty: parseFloat(t.qty),
      feeCents: t.fee_cents,
      createdAt: t.created_at,
    })),
    refPriceHistory: npcState
      ? [{ refPriceCents: npcState.ref_price_cents, timestamp: npcState.updated_at }]
      : [],
  };
}

export interface MarketGoodInfo {
  goodCode: string;
  name: string;
  isEssential: boolean;
  refPriceCents: number;
  halted: boolean;
}

export async function listMarketGoods(): Promise<MarketGoodInfo[]> {
  const rows = await query<GoodRow & NpcMarketStateRow>(
    `SELECT g.*, nms.ref_price_cents, nms.market_halt_until
     FROM goods g
     JOIN npc_market_state nms ON g.id = nms.good_id
     ORDER BY g.id`
  );

  const now = new Date();
  return rows.map((r) => ({
    goodCode: r.code,
    name: r.name,
    isEssential: r.is_essential,
    refPriceCents: r.ref_price_cents,
    halted: r.market_halt_until
      ? isMarketHalted(new Date(r.market_halt_until), now)
      : false,
  }));
}

// ── NPC Market Simulation (6-hour tick) ──────────────────────

/**
 * Refresh NPC maker orders for all goods.
 * Called from the six-hour tick worker.
 *
 * For each good:
 * 1. Compute new demand/supply based on affordability index
 * 2. Update reference price using P_ref formula
 * 3. Cancel stale NPC orders
 * 4. Place new NPC bid/ask orders around P_ref
 * 5. Check circuit breaker
 * 6. Snapshot last_6h_ref_price for next cycle
 */
export async function refreshNpcMarketOrders(): Promise<{
  goodsRefreshed: number;
  ordersCreated: number;
  circuitBreakers: number;
}> {
  let goodsRefreshed = 0;
  let ordersCreated = 0;
  let circuitBreakers = 0;

  const goods = await query<GoodRow>('SELECT * FROM goods ORDER BY id');

  for (const good of goods) {
    try {
      await withTransaction(async (tx) => {
        const npcState = await getNpcMarketState(tx, good.id);
        const now = new Date();
        const goodCode = good.code as GoodCode;
        const alpha = MARKET_ALPHA[goodCode] ?? parseFloat(npcState.alpha);
        const basePriceCents = GOOD_BASE_PRICES[goodCode] ?? npcState.ref_price_cents;
        const currentDemand = parseFloat(npcState.demand);
        const currentSupply = parseFloat(npcState.supply);

        // 1. Compute new demand/supply
        const { newDemand, newSupply } = computeNpcDemandSupply(
          good.is_essential,
          npcState.ref_price_cents,
          basePriceCents,
          currentDemand,
          currentSupply,
        );

        // 2. Calculate new reference price
        const newRefPrice = calculateRefPrice(
          npcState.ref_price_cents,
          alpha,
          newDemand,
          newSupply,
        );

        // 3. Check circuit breaker
        let haltUntil = npcState.market_halt_until;
        let widenedUntil = npcState.widened_spread_until;

        if (shouldTriggerCircuitBreaker(newRefPrice, npcState.last_6h_ref_price_cents)) {
          haltUntil = new Date(now.getTime() + CIRCUIT_BREAKER_HALT_MS).toISOString();
          widenedUntil = new Date(
            new Date(haltUntil).getTime() + CIRCUIT_BREAKER_HALT_MS
          ).toISOString();
          circuitBreakers++;
          logger.warn('Circuit breaker triggered at 6h tick', {
            goodCode: good.code,
            newRefPrice,
            last6hPrice: npcState.last_6h_ref_price_cents,
          });
        }

        // 4. Cancel existing NPC orders for this good
        await tx.query(
          `UPDATE market_orders SET status = 'cancelled', qty_open = 0
           WHERE actor_type = 'npc' AND good_id = $1 AND status IN ('open', 'partial')`,
          [good.id]
        );

        // 5. Place new NPC maker orders
        const isWidened = widenedUntil
          ? now < new Date(widenedUntil)
          : false;
        const spreadBps = MARKET_SPREAD_BPS[goodCode] ?? npcState.spread_bps;
        const { bidCents, askCents } = calculateNpcPrices(newRefPrice, spreadBps, isWidened);

        const orderQty = good.is_essential ? NPC_ESSENTIAL_ORDER_QTY : NPC_NON_ESSENTIAL_ORDER_QTY;

        // NPC buy order (bid)
        await tx.query(
          `INSERT INTO market_orders
             (actor_type, actor_id, good_id, side, order_type, price_cents, qty_open, qty_initial, status)
           VALUES ('npc', NULL, $1, 'buy', 'limit', $2, $3, $3, 'open')`,
          [good.id, bidCents, orderQty]
        );

        // NPC sell order (ask)
        await tx.query(
          `INSERT INTO market_orders
             (actor_type, actor_id, good_id, side, order_type, price_cents, qty_open, qty_initial, status)
           VALUES ('npc', NULL, $1, 'sell', 'limit', $2, $3, $3, 'open')`,
          [good.id, askCents, orderQty]
        );

        ordersCreated += 2;

        // 6. Update NPC market state
        await tx.query(
          `UPDATE npc_market_state
           SET demand = $2, supply = $3, ref_price_cents = $4,
               last_6h_ref_price_cents = $4,
               market_halt_until = $5, widened_spread_until = $6,
               last_npc_refresh = NOW()
           WHERE good_id = $1`,
          [good.id, newDemand, newSupply, newRefPrice, haltUntil, widenedUntil]
        );

        goodsRefreshed++;
      });
    } catch (err) {
      logger.error('Failed to refresh NPC orders for good', {
        goodCode: good.code,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { goodsRefreshed, ordersCreated, circuitBreakers };
}
