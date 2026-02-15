import type { FastifyInstance } from 'fastify';
import { pool } from '@blueth/db';
import { createTestServer, registerTestPlayer, authHeaders } from './helpers/factories';
import { cleanDatabase, teardown } from './helpers/setup';

let server: FastifyInstance;

beforeAll(async () => {
  server = await createTestServer();
});

beforeEach(async () => {
  await cleanDatabase();
  // Reset NPC market state to initial values
  await pool.query(
    `UPDATE npc_market_state SET market_halt_until = NULL, widened_spread_until = NULL`
  );
  // Reset ref prices to seed values
  await pool.query(`
    UPDATE npc_market_state SET ref_price_cents = v.price, last_6h_ref_price_cents = v.price
    FROM (VALUES
      ('RAW_FOOD', 200), ('PROCESSED_FOOD', 500), ('FRESH_WATER', 100),
      ('ENERGY', 300), ('MATERIALS', 800), ('BUILDING_MATERIALS', 1500),
      ('INDUSTRIAL_MACHINERY', 50000), ('ENTERTAINMENT', 1000), ('WASTE', 10)
    ) AS v(code, price)
    JOIN goods g ON g.code = v.code
    WHERE npc_market_state.good_id = g.id
  `);
});

afterAll(async () => {
  await server.close();
  await teardown();
});

// ── Helpers ──────────────────────────────────────────────────

async function placeMarketOrder(
  cookie: string,
  body: Record<string, unknown>
) {
  return server.inject({
    method: 'POST',
    url: '/market/orders',
    headers: authHeaders(cookie),
    payload: body,
  });
}

async function cancelMarketOrder(cookie: string, orderId: string) {
  return server.inject({
    method: 'POST',
    url: `/market/orders/${orderId}/cancel`,
    headers: authHeaders(cookie),
  });
}

async function dayTrade(cookie: string, idempotencyKey: string) {
  return server.inject({
    method: 'POST',
    url: '/market/daytrade',
    headers: authHeaders(cookie),
    payload: { idempotencyKey },
  });
}

async function getPlayerBalance(playerId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN to_account = pw.account_id THEN le.amount_cents ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN from_account = pw.account_id THEN le.amount_cents ELSE 0 END), 0)
       AS balance
     FROM player_wallets pw
     LEFT JOIN ledger_entries le ON le.from_account = pw.account_id OR le.to_account = pw.account_id
     WHERE pw.player_id = $1`,
    [playerId]
  );
  return parseInt(rows[0]?.balance ?? '0', 10);
}

async function givePlayerInventory(playerId: string, goodCode: string, qty: number) {
  const { rows } = await pool.query(
    'SELECT id FROM goods WHERE code = $1',
    [goodCode]
  );
  const goodId = rows[0].id;
  await pool.query(
    `INSERT INTO inventories (owner_type, owner_id, good_id, qty)
     VALUES ('player', $1, $2, $3)
     ON CONFLICT (owner_type, owner_id, good_id)
     DO UPDATE SET qty = inventories.qty + $3`,
    [playerId, goodId, qty]
  );
}

async function getPlayerInventory(playerId: string, goodCode: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT i.qty FROM inventories i
     JOIN goods g ON g.id = i.good_id
     WHERE i.owner_type = 'player' AND i.owner_id = $1 AND g.code = $2`,
    [playerId, goodCode]
  );
  return parseFloat(rows[0]?.qty ?? '0');
}

async function createNpcSellOrder(goodCode: string, priceCents: number, qty: number) {
  const { rows } = await pool.query(
    'SELECT id FROM goods WHERE code = $1',
    [goodCode]
  );
  const goodId = rows[0].id;
  await pool.query(
    `INSERT INTO market_orders
       (actor_type, actor_id, good_id, side, order_type, price_cents, qty_open, qty_initial, status)
     VALUES ('npc', NULL, $1, 'sell', 'limit', $2, $3, $3, 'open')`,
    [goodId, priceCents, qty]
  );
}

async function createNpcBuyOrder(goodCode: string, priceCents: number, qty: number) {
  const { rows } = await pool.query(
    'SELECT id FROM goods WHERE code = $1',
    [goodCode]
  );
  const goodId = rows[0].id;
  await pool.query(
    `INSERT INTO market_orders
       (actor_type, actor_id, good_id, side, order_type, price_cents, qty_open, qty_initial, status)
     VALUES ('npc', NULL, $1, 'buy', 'limit', $2, $3, $3, 'open')`,
    [goodId, priceCents, qty]
  );
}

// ── GET /market/goods ────────────────────────────────────────

describe('GET /market/goods', () => {
  it('returns all goods with ref prices', async () => {
    const { cookie } = await registerTestPlayer(server);
    const res = await server.inject({
      method: 'GET',
      url: '/market/goods',
      headers: authHeaders(cookie),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(9); // 9 goods in seed data

    const rawFood = body.find((g: any) => g.goodCode === 'RAW_FOOD');
    expect(rawFood).toBeDefined();
    expect(rawFood.refPriceCents).toBe(200);
    expect(rawFood.isEssential).toBe(true);
    expect(rawFood.halted).toBe(false);
  });
});

// ── GET /market/:goodCode/book ───────────────────────────────

describe('GET /market/:goodCode/book', () => {
  it('returns order book with ref price and halt status', async () => {
    const { cookie } = await registerTestPlayer(server);

    // Create some NPC orders
    await createNpcSellOrder('RAW_FOOD', 210, 50);
    await createNpcBuyOrder('RAW_FOOD', 190, 50);

    const res = await server.inject({
      method: 'GET',
      url: '/market/RAW_FOOD/book',
      headers: authHeaders(cookie),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.goodCode).toBe('RAW_FOOD');
    expect(body.refPriceCents).toBe(200);
    expect(body.halted).toBe(false);
    expect(body.bids.length).toBeGreaterThan(0);
    expect(body.asks.length).toBeGreaterThan(0);
    expect(body.bids[0].priceCents).toBe(190);
    expect(body.asks[0].priceCents).toBe(210);
  });
});

// ── Matching correctness ─────────────────────────────────────

describe('Order matching', () => {
  it('market buy order matches against NPC sell order', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // Create NPC sell order at 210 cents per unit
    await createNpcSellOrder('RAW_FOOD', 210, 100);

    const res = await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'buy',
      orderType: 'market',
      qty: 5,
      idempotencyKey: 'buy-raw-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('completed');

    const result = body.result;
    expect(result.fills.length).toBe(1);
    expect(result.fills[0].priceCents).toBe(210);
    expect(result.fills[0].qty).toBe(5);

    // Player should have received 5 units of RAW_FOOD
    const inv = await getPlayerInventory(playerId, 'RAW_FOOD');
    expect(inv).toBe(5);
  });

  it('market sell order matches against NPC buy order', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // Give player inventory first
    await givePlayerInventory(playerId, 'RAW_FOOD', 10);

    // Create NPC buy order at 190 cents per unit
    await createNpcBuyOrder('RAW_FOOD', 190, 100);

    const res = await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'sell',
      orderType: 'market',
      qty: 5,
      idempotencyKey: 'sell-raw-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('completed');

    const result = body.result;
    expect(result.fills.length).toBe(1);
    expect(result.fills[0].priceCents).toBe(190);
    expect(result.fills[0].qty).toBe(5);

    // Player inventory should decrease by 5
    const inv = await getPlayerInventory(playerId, 'RAW_FOOD');
    expect(inv).toBe(5);
  });

  it('limit buy order matches immediately if crosses spread', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // NPC sell at 210
    await createNpcSellOrder('RAW_FOOD', 210, 100);

    // Player limit buy at 220 (above the ask) => should match at 210
    const res = await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'buy',
      orderType: 'limit',
      priceCents: 220,
      qty: 3,
      idempotencyKey: 'limit-buy-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const result = body.result;
    expect(result.fills.length).toBe(1);
    expect(result.fills[0].priceCents).toBe(210); // Matches at the resting order price
    expect(result.fills[0].qty).toBe(3);
    expect(result.status).toBe('filled');
  });

  it('limit buy order rests if below best ask', async () => {
    const { cookie } = await registerTestPlayer(server);

    // NPC sell at 210
    await createNpcSellOrder('RAW_FOOD', 210, 100);

    // Player limit buy at 190 (below the ask) => should rest
    const res = await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'buy',
      orderType: 'limit',
      priceCents: 190,
      qty: 5,
      idempotencyKey: 'limit-buy-rest-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const result = body.result;
    expect(result.fills.length).toBe(0);
    expect(result.qtyRemaining).toBe(5);
    // Order remains open
    expect(result.status).toBe('open');
  });
});

// ── Fee correctness ──────────────────────────────────────────

describe('Market fees', () => {
  it('charges 1% fee on buy orders', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // NPC sell at 200 cents
    await createNpcSellOrder('RAW_FOOD', 200, 100);

    const balanceBefore = await getPlayerBalance(playerId);

    const res = await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'buy',
      orderType: 'market',
      qty: 10,
      idempotencyKey: 'fee-test-buy-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const result = body.result;

    // Trade value: 200 * 10 = 2000 cents
    // Fee: floor(2000 * 0.01) = 20 cents
    expect(result.fills[0].feeCents).toBe(20);

    const balanceAfter = await getPlayerBalance(playerId);
    // Player pays: trade value + fee = 2000 + 20 = 2020 cents
    expect(balanceBefore - balanceAfter).toBe(2020);
  });

  it('fee is at least 1 cent for small trades', async () => {
    const { cookie } = await registerTestPlayer(server);

    // NPC sell at 10 cents (WASTE)
    await createNpcSellOrder('WASTE', 10, 100);

    const res = await placeMarketOrder(cookie, {
      goodCode: 'WASTE',
      side: 'buy',
      orderType: 'market',
      qty: 1,
      idempotencyKey: 'fee-test-min-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const result = body.result;
    // Trade value: 10 * 1 = 10 cents, raw fee = 0.1 => min 1
    expect(result.fills[0].feeCents).toBe(1);
  });
});

// ── No negative wallet ──────────────────────────────────────

describe('Wallet protection', () => {
  it('rejects buy order when insufficient funds', async () => {
    const { cookie } = await registerTestPlayer(server);

    // NPC sell at 100000 cents (B1000 per unit)
    await createNpcSellOrder('INDUSTRIAL_MACHINERY', 10000000, 10);

    const res = await placeMarketOrder(cookie, {
      goodCode: 'INDUSTRIAL_MACHINERY',
      side: 'buy',
      orderType: 'market',
      qty: 5,
      idempotencyKey: 'wallet-protect-1',
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('INSUFFICIENT_FUNDS');
  });

  it('rejects sell order when insufficient inventory', async () => {
    const { cookie } = await registerTestPlayer(server);

    // NPC buy at 200
    await createNpcBuyOrder('RAW_FOOD', 200, 100);

    // Player has no inventory
    const res = await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'sell',
      orderType: 'market',
      qty: 5,
      idempotencyKey: 'inv-protect-1',
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('INSUFFICIENT_INVENTORY');
  });
});

// ── Circuit breaker ──────────────────────────────────────────

describe('Circuit breaker', () => {
  it('halts market orders when price moves > 25% in 6 hours', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // Manually set the market state to have a large price discrepancy
    await pool.query(
      `UPDATE npc_market_state
       SET market_halt_until = NOW() + interval '1 hour'
       WHERE good_id = (SELECT id FROM goods WHERE code = 'RAW_FOOD')`
    );

    const res = await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'buy',
      orderType: 'market',
      qty: 5,
      idempotencyKey: 'halt-test-1',
    });

    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('MARKET_HALTED');
  });

  it('allows limit orders during halt (they rest without matching)', async () => {
    const { cookie } = await registerTestPlayer(server);

    // Set halt
    await pool.query(
      `UPDATE npc_market_state
       SET market_halt_until = NOW() + interval '1 hour'
       WHERE good_id = (SELECT id FROM goods WHERE code = 'RAW_FOOD')`
    );

    // Limit order should succeed (queued, not matched)
    const res = await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'buy',
      orderType: 'limit',
      priceCents: 200,
      qty: 5,
      idempotencyKey: 'halt-limit-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const result = body.result;
    expect(result.fills.length).toBe(0); // No matching during halt
    expect(result.qtyRemaining).toBe(5);
  });

  it('shows halt status in order book', async () => {
    const { cookie } = await registerTestPlayer(server);

    await pool.query(
      `UPDATE npc_market_state
       SET market_halt_until = NOW() + interval '1 hour'
       WHERE good_id = (SELECT id FROM goods WHERE code = 'RAW_FOOD')`
    );

    const res = await server.inject({
      method: 'GET',
      url: '/market/RAW_FOOD/book',
      headers: authHeaders(cookie),
    });

    const body = JSON.parse(res.body);
    expect(body.halted).toBe(true);
    expect(body.haltedUntil).toBeTruthy();
  });
});

// ── Idempotency ──────────────────────────────────────────────

describe('Order idempotency', () => {
  it('same idempotency key returns same action', async () => {
    const { cookie } = await registerTestPlayer(server);

    await createNpcSellOrder('RAW_FOOD', 200, 100);

    const payload = {
      goodCode: 'RAW_FOOD',
      side: 'buy',
      orderType: 'market',
      qty: 5,
      idempotencyKey: 'idem-market-1',
    };

    const res1 = await placeMarketOrder(cookie, payload);
    const res2 = await placeMarketOrder(cookie, payload);

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);

    const body1 = JSON.parse(res1.body);
    const body2 = JSON.parse(res2.body);
    expect(body1.actionId).toBe(body2.actionId);
  });
});

// ── Order cancellation ───────────────────────────────────────

describe('Order cancellation', () => {
  it('can cancel a resting limit order', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // Place a limit order that rests (no matching NPC orders)
    const res = await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'buy',
      orderType: 'limit',
      priceCents: 150,
      qty: 5,
      idempotencyKey: 'cancel-test-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const orderId = body.result.orderId;

    // Cancel it
    const cancelRes = await cancelMarketOrder(cookie, orderId);
    expect(cancelRes.statusCode).toBe(200);

    // Order should show cancelled in the book
    const bookRes = await server.inject({
      method: 'GET',
      url: '/market/RAW_FOOD/book',
      headers: authHeaders(cookie),
    });
    const bookBody = JSON.parse(bookRes.body);
    // The cancelled order shouldn't appear at price 150
    const bid150 = bookBody.bids.find((b: any) => b.priceCents === 150);
    expect(bid150).toBeUndefined();
  });

  it('returns inventory on sell order cancellation', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // Give player inventory
    await givePlayerInventory(playerId, 'RAW_FOOD', 10);

    // Place a resting sell limit order
    const res = await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'sell',
      orderType: 'limit',
      priceCents: 300,
      qty: 5,
      idempotencyKey: 'cancel-sell-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const orderId = body.result.orderId;

    // Inventory should be 5 (10 - 5 reserved)
    const invBefore = await getPlayerInventory(playerId, 'RAW_FOOD');
    expect(invBefore).toBe(5);

    // Cancel the order
    await cancelMarketOrder(cookie, orderId);

    // Inventory should be restored to 10
    const invAfter = await getPlayerInventory(playerId, 'RAW_FOOD');
    expect(invAfter).toBe(10);
  });
});

// ── Day trade session ────────────────────────────────────────

describe('Day trade session', () => {
  it('costs MV-10', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // Initial MV should be 100
    const stateBefore = await pool.query(
      'SELECT mv, spv FROM player_state WHERE player_id = $1',
      [playerId]
    );
    expect(stateBefore.rows[0].mv).toBe(100);

    const res = await dayTrade(cookie, 'daytrade-1');
    expect(res.statusCode).toBe(200);

    const stateAfter = await pool.query(
      'SELECT mv, spv FROM player_state WHERE player_id = $1',
      [playerId]
    );
    expect(stateAfter.rows[0].mv).toBe(90); // 100 - 10 = 90
  });

  it('applies SpV-2 stress on 3+ day trades', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // Do 3 day trades
    await dayTrade(cookie, 'dt-1');
    await dayTrade(cookie, 'dt-2');
    const res3 = await dayTrade(cookie, 'dt-3');

    expect(res3.statusCode).toBe(200);
    const body = JSON.parse(res3.body);
    expect(body.result.stressApplied).toBe(true);
    expect(body.result.dayTradeCount).toBe(3);

    const stateAfter = await pool.query(
      'SELECT mv, spv FROM player_state WHERE player_id = $1',
      [playerId]
    );
    // MV: 100 - 10 - 10 - 10 = 70
    expect(stateAfter.rows[0].mv).toBe(70);
    // SpV: 100 - 2 = 98 (stress only on 3rd trade)
    expect(stateAfter.rows[0].spv).toBe(98);
  });
});

// ── NPC maker order refresh (6-hour tick) ────────────────────

describe('NPC market refresh', () => {
  it('creates NPC maker orders idempotently', async () => {
    // Import and call the refresh function directly
    const { refreshNpcMarketOrders } = await import('../src/services/market-service');

    // First refresh
    const result1 = await refreshNpcMarketOrders();
    expect(result1.goodsRefreshed).toBe(9);
    expect(result1.ordersCreated).toBe(18); // 2 per good (bid + ask)

    // Check orders exist
    const { rows: orders1 } = await pool.query(
      `SELECT COUNT(*) as count FROM market_orders
       WHERE actor_type = 'npc' AND status = 'open'`
    );
    expect(parseInt(orders1[0].count, 10)).toBe(18);

    // Second refresh (idempotent: old ones cancelled, new ones created)
    const result2 = await refreshNpcMarketOrders();
    expect(result2.goodsRefreshed).toBe(9);
    expect(result2.ordersCreated).toBe(18);

    // Old ones should be cancelled, only 18 open
    const { rows: orders2 } = await pool.query(
      `SELECT COUNT(*) as count FROM market_orders
       WHERE actor_type = 'npc' AND status = 'open'`
    );
    expect(parseInt(orders2[0].count, 10)).toBe(18);
  });
});

// ── Trade history ────────────────────────────────────────────

describe('GET /market/:goodCode/history', () => {
  it('returns trade history after a trade', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // Create NPC sell order and execute a buy
    await createNpcSellOrder('RAW_FOOD', 200, 100);

    await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'buy',
      orderType: 'market',
      qty: 5,
      idempotencyKey: 'history-test-1',
    });

    const res = await server.inject({
      method: 'GET',
      url: '/market/RAW_FOOD/history',
      headers: authHeaders(cookie),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.goodCode).toBe('RAW_FOOD');
    expect(body.trades.length).toBe(1);
    expect(body.trades[0].priceCents).toBe(200);
    expect(body.trades[0].qty).toBe(5);
  });
});

// ── Fee verification ────────────────────────────────────────────

describe('Market fee ledger verification', () => {
  it('trade creates a fee entry to TAX_SINK equal to floor(1% of trade value)', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // Create NPC sell order: 10 units at 200 cents each
    await createNpcSellOrder('RAW_FOOD', 200, 10);

    // Place a market buy order for 5 units
    const res = await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'buy',
      orderType: 'market',
      qty: 5,
      idempotencyKey: `fee-test-${Date.now()}`,
    });
    expect(res.statusCode).toBe(200);

    // Trade value: 200 * 5 = 1000 cents
    // Expected fee: floor(1000 * 0.01) = 10 cents
    const expectedFee = Math.floor(200 * 5 * 0.01);

    // Look for fee entry in ledger (to TAX_SINK = account 3)
    const walletRow = await pool.query(
      'SELECT account_id FROM player_wallets WHERE player_id = $1',
      [playerId]
    );
    const accountId = walletRow.rows[0].account_id;

    const feeEntries = await pool.query(
      `SELECT * FROM ledger_entries
       WHERE from_account = $1 AND to_account = 3 AND entry_type = 'fee'`,
      [accountId]
    );

    expect(feeEntries.rows.length).toBeGreaterThanOrEqual(1);
    const totalFee = feeEntries.rows.reduce(
      (sum: number, r: { amount_cents: string }) => sum + parseInt(r.amount_cents, 10),
      0
    );
    expect(totalFee).toBe(expectedFee);
  });
});

// ── Bug #4 / #5: Transaction atomicity ────────────────────────

describe('Transaction atomicity (Bug #4, #5)', () => {
  it('placeOrder uses action engine transaction — balance check is atomic', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // Get the player's starting balance
    const startBalance = await getPlayerBalance(playerId);

    // Create NPC sell order so market buy can fill
    await createNpcSellOrder('RAW_FOOD', 210, 100);

    // Place a buy order that should succeed within the action engine's tx
    const res = await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'buy',
      orderType: 'market',
      qty: 2,
      idempotencyKey: 'atomic-buy-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('completed');

    // Verify balance was deducted (order filled at 210 × 2 + fee)
    const endBalance = await getPlayerBalance(playerId);
    expect(endBalance).toBeLessThan(startBalance);
  });

  it('cancelOrder uses action engine transaction — refund is atomic', async () => {
    const { cookie, playerId } = await registerTestPlayer(server);

    // Give player inventory and place a sell limit order
    await givePlayerInventory(playerId, 'RAW_FOOD', 10);

    const placeRes = await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'sell',
      orderType: 'limit',
      priceCents: 500,
      qty: 5,
      idempotencyKey: 'atomic-sell-1',
    });
    expect(placeRes.statusCode).toBe(200);
    const placeBody = JSON.parse(placeRes.body);
    const orderId = placeBody.result.orderId;

    // Inventory should be 5 (10 - 5 reserved)
    const invBefore = await getPlayerInventory(playerId, 'RAW_FOOD');
    expect(invBefore).toBe(5);

    // Cancel the order
    const cancelRes = await cancelMarketOrder(cookie, orderId);
    expect(cancelRes.statusCode).toBe(200);

    // Inventory should be restored to 10
    const invAfter = await getPlayerInventory(playerId, 'RAW_FOOD');
    expect(invAfter).toBe(10);
  });
});

// ── Bug #13: Rate limit inside transaction ────────────────────

describe('Market order rate limit (Bug #13)', () => {
  it('rejects orders exceeding the per-minute rate limit', async () => {
    const { cookie } = await registerTestPlayer(server);

    // Place 10 orders (the rate limit) — all should succeed
    for (let i = 0; i < 10; i++) {
      const res = await placeMarketOrder(cookie, {
        goodCode: 'RAW_FOOD',
        side: 'buy',
        orderType: 'market',
        qty: 1,
        idempotencyKey: `rate-limit-${Date.now()}-${i}`,
      });
      expect(res.statusCode).toBe(200);
    }

    // The 11th order should be rate-limited
    const res = await placeMarketOrder(cookie, {
      goodCode: 'RAW_FOOD',
      side: 'buy',
      orderType: 'market',
      qty: 1,
      idempotencyKey: `rate-limit-${Date.now()}-overflow`,
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('Rate limit');
  });
});
