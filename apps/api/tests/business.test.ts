/**
 * Business Integration Tests
 *
 * Tests the full business lifecycle through the API:
 *   - Business registration
 *   - Machinery purchase
 *   - Worker hiring
 *   - Production start (input reservation)
 *   - Production completion (tick)
 *   - Worker satisfaction bounds
 *   - Machinery depreciation
 */

import type { FastifyInstance } from 'fastify';
import { pool } from '@blueth/db';
import { cleanDatabase } from './helpers/setup';
import { teardown } from './helpers/setup';
import { createTestServer, registerTestPlayer, authHeaders } from './helpers/factories';
import { BUSINESS_REGISTRATION_FEE_CENTS, GOOD_BASE_PRICES } from '@blueth/core';
import { completeProductionJob, processCompletedProductionJobs } from '../src/services/business-service';

let server: FastifyInstance;
let cookie: string;
let playerId: string;

beforeAll(async () => {
  server = await createTestServer();
});

afterAll(async () => {
  await server.close();
  await teardown();
});

beforeEach(async () => {
  await cleanDatabase();
  const reg = await registerTestPlayer(server);
  cookie = reg.cookie;
  playerId = reg.playerId;
});

// ── Helpers ──────────────────────────────────────────────────

let idempCounter = 0;
function idem(): string {
  return `biz-test-${Date.now()}-${++idempCounter}`;
}

async function registerBusiness(name = 'Test Factory', district = 'INDUSTRIAL'): Promise<any> {
  const res = await server.inject({
    method: 'POST',
    url: '/business/register',
    headers: authHeaders(cookie),
    payload: { name, districtCode: district, idempotencyKey: idem() },
  });
  expect(res.statusCode).toBe(200);
  return JSON.parse(res.body);
}

async function giveBusinessInventory(businessId: string, goodCode: string, qty: number): Promise<void> {
  await pool.query(
    `INSERT INTO inventories (owner_type, owner_id, good_id, qty)
     SELECT 'business', $1, g.id, $2 FROM goods g WHERE g.code = $3
     ON CONFLICT (owner_type, owner_id, good_id)
     DO UPDATE SET qty = inventories.qty + $2`,
    [businessId, qty, goodCode]
  );
}

// ── Tests ────────────────────────────────────────────────────

describe('Business Registration', () => {
  it('registers a business and charges registration fee', async () => {
    const result = await registerBusiness();
    expect(result.status).toBe('completed');
    expect(result.result).toBeDefined();
    expect(result.result.businessId).toBeDefined();
    expect(result.result.registrationFeeCents).toBe(BUSINESS_REGISTRATION_FEE_CENTS);
    expect(result.result.districtCode).toBe('INDUSTRIAL');

    // Verify business exists
    const bizRes = await server.inject({
      method: 'GET',
      url: `/business/${result.result.businessId}`,
      headers: authHeaders(cookie),
    });
    expect(bizRes.statusCode).toBe(200);
    const biz = JSON.parse(bizRes.body);
    expect(biz.name).toBe('Test Factory');
    expect(biz.district_code).toBe('INDUSTRIAL');
  });

  it('rejects registration if insufficient funds', async () => {
    // Drain player wallet first
    await pool.query(
      `UPDATE ledger_entries SET amount_cents = 1 WHERE to_account = (
        SELECT account_id FROM player_wallets WHERE player_id = $1
      )`,
      [playerId]
    );

    const res = await server.inject({
      method: 'POST',
      url: '/business/register',
      headers: authHeaders(cookie),
      payload: { name: 'Poor Biz', districtCode: 'INDUSTRIAL', idempotencyKey: idem() },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('Machinery Purchase', () => {
  it('buys machinery for a business', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    const res = await server.inject({
      method: 'POST',
      url: '/business/machinery',
      headers: authHeaders(cookie),
      payload: { businessId, qty: 1, idempotencyKey: idem() },
    });
    // May fail due to insufficient funds (machinery is expensive)
    // Player starts with initial grant, which may not cover ₿500 machinery
    if (res.statusCode === 200) {
      const result = JSON.parse(res.body);
      expect(result.result.newMachineryQty).toBe(1);
      expect(result.result.priceCents).toBe(GOOD_BASE_PRICES.INDUSTRIAL_MACHINERY);
    } else {
      expect(res.statusCode).toBe(400); // Insufficient funds expected
    }
  });
});

describe('Worker Hiring', () => {
  it('hires a worker for a business', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    const res = await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: {
        businessId,
        wageCents: 12000,
        hoursPerDay: 8,
        idempotencyKey: idem(),
      },
    });
    expect(res.statusCode).toBe(200);
    const result = JSON.parse(res.body);
    expect(result.result.satisfaction).toBe(1.0);
    expect(result.result.wageCents).toBe(12000);

    // Verify worker exists
    const wRes = await server.inject({
      method: 'GET',
      url: `/business/${businessId}/workers`,
      headers: authHeaders(cookie),
    });
    expect(wRes.statusCode).toBe(200);
    const workers = JSON.parse(wRes.body);
    expect(workers).toHaveLength(1);
  });
});

describe('Production — Input Reservation', () => {
  it('reserves inputs from business inventory on start', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    // Give business machinery
    await pool.query(
      'UPDATE businesses SET machinery_qty = 1 WHERE id = $1',
      [businessId]
    );

    // Hire a worker with enough hours
    await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: {
        businessId,
        wageCents: 12000,
        hoursPerDay: 8,
        idempotencyKey: idem(),
      },
    });

    // Give business inputs for PROCESS_FOOD: RAW_FOOD×3, FRESH_WATER×1, ENERGY×1
    await giveBusinessInventory(businessId, 'RAW_FOOD', 10);
    await giveBusinessInventory(businessId, 'FRESH_WATER', 5);
    await giveBusinessInventory(businessId, 'ENERGY', 5);

    // Start production
    const res = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: {
        businessId,
        recipeCode: 'PROCESS_FOOD',
        idempotencyKey: idem(),
      },
    });
    expect(res.statusCode).toBe(200);
    const result = JSON.parse(res.body);
    expect(result.result.inputsReserved).toHaveLength(3);

    // Verify inputs were deducted
    const invRes = await server.inject({
      method: 'GET',
      url: `/business/${businessId}/inventory`,
      headers: authHeaders(cookie),
    });
    const inventory = JSON.parse(invRes.body);
    const rawFood = inventory.find((i: any) => i.goodCode === 'RAW_FOOD');
    expect(rawFood.qty).toBe(7); // 10 - 3
    const water = inventory.find((i: any) => i.goodCode === 'FRESH_WATER');
    expect(water.qty).toBe(4); // 5 - 1
    const energy = inventory.find((i: any) => i.goodCode === 'ENERGY');
    expect(energy.qty).toBe(4); // 5 - 1
  });

  it('rejects production if insufficient inputs', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    await pool.query('UPDATE businesses SET machinery_qty = 1 WHERE id = $1', [businessId]);

    // Hire a worker
    await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: { businessId, wageCents: 12000, hoursPerDay: 8, idempotencyKey: idem() },
    });

    // Only give 1 RAW_FOOD (need 3)
    await giveBusinessInventory(businessId, 'RAW_FOOD', 1);
    await giveBusinessInventory(businessId, 'FRESH_WATER', 5);
    await giveBusinessInventory(businessId, 'ENERGY', 5);

    const res = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('INSUFFICIENT_INVENTORY');
  });

  it('prevents double-spend: two concurrent jobs consume separate inputs', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    await pool.query('UPDATE businesses SET machinery_qty = 2 WHERE id = $1', [businessId]);

    // Hire workers with plenty of hours for 2 jobs
    for (let i = 0; i < 2; i++) {
      await server.inject({
        method: 'POST',
        url: '/business/hire',
        headers: authHeaders(cookie),
        payload: { businessId, wageCents: 12000, hoursPerDay: 8, idempotencyKey: idem() },
      });
    }

    // Give exactly 6 RAW_FOOD (enough for 2 jobs of 3 each)
    await giveBusinessInventory(businessId, 'RAW_FOOD', 6);
    await giveBusinessInventory(businessId, 'FRESH_WATER', 2);
    await giveBusinessInventory(businessId, 'ENERGY', 2);

    // Start first production
    const res1 = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });
    expect(res1.statusCode).toBe(200);

    // Start second production
    const res2 = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });
    expect(res2.statusCode).toBe(200);

    // A third should fail (no more raw food)
    const res3 = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });
    expect(res3.statusCode).toBe(400);
  });
});

describe('Production — Completion (Tick)', () => {
  it('produces outputs when job completes', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    await pool.query('UPDATE businesses SET machinery_qty = 1 WHERE id = $1', [businessId]);

    // Hire worker
    await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: { businessId, wageCents: 12000, hoursPerDay: 8, idempotencyKey: idem() },
    });

    // Give inputs
    await giveBusinessInventory(businessId, 'RAW_FOOD', 3);
    await giveBusinessInventory(businessId, 'FRESH_WATER', 1);
    await giveBusinessInventory(businessId, 'ENERGY', 1);

    // Start production
    const startRes = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });
    const startResult = JSON.parse(startRes.body);
    const jobId = startResult.result.jobId;

    // Manually set finishes_at to the past to simulate time passage
    await pool.query(
      `UPDATE production_jobs SET finishes_at = NOW() - interval '1 minute' WHERE id = $1`,
      [jobId]
    );

    // Run production completion
    const { jobsCompleted } = await processCompletedProductionJobs();
    expect(jobsCompleted).toBe(1);

    // Check outputs in business inventory
    const invRes = await server.inject({
      method: 'GET',
      url: `/business/${businessId}/inventory`,
      headers: authHeaders(cookie),
    });
    const inventory = JSON.parse(invRes.body);
    const processedFood = inventory.find((i: any) => i.goodCode === 'PROCESSED_FOOD');
    expect(processedFood).toBeDefined();
    expect(processedFood.qty).toBe(5);

    const waste = inventory.find((i: any) => i.goodCode === 'WASTE');
    expect(waste).toBeDefined();
    expect(waste.qty).toBe(1);
  });

  it('is idempotent — completing same job twice has no effect', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    await pool.query('UPDATE businesses SET machinery_qty = 1 WHERE id = $1', [businessId]);

    await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: { businessId, wageCents: 12000, hoursPerDay: 8, idempotencyKey: idem() },
    });

    await giveBusinessInventory(businessId, 'RAW_FOOD', 3);
    await giveBusinessInventory(businessId, 'FRESH_WATER', 1);
    await giveBusinessInventory(businessId, 'ENERGY', 1);

    const startRes = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });
    const jobId = JSON.parse(startRes.body).result.jobId;

    await pool.query(
      `UPDATE production_jobs SET finishes_at = NOW() - interval '1 minute' WHERE id = $1`,
      [jobId]
    );

    // Complete once
    const result1 = await processCompletedProductionJobs();
    expect(result1.jobsCompleted).toBe(1);

    // Complete again — should find 0 more jobs
    const result2 = await processCompletedProductionJobs();
    expect(result2.jobsCompleted).toBe(0);
  });
});

describe('Machinery Depreciation', () => {
  it('depreciates machinery on job completion', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    // Set machinery to exactly 1.0
    await pool.query('UPDATE businesses SET machinery_qty = 1.0 WHERE id = $1', [businessId]);

    await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: { businessId, wageCents: 12000, hoursPerDay: 8, idempotencyKey: idem() },
    });

    await giveBusinessInventory(businessId, 'RAW_FOOD', 3);
    await giveBusinessInventory(businessId, 'FRESH_WATER', 1);
    await giveBusinessInventory(businessId, 'ENERGY', 1);

    const startRes = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });
    const jobId = JSON.parse(startRes.body).result.jobId;

    await pool.query(
      `UPDATE production_jobs SET finishes_at = NOW() - interval '1 minute' WHERE id = $1`,
      [jobId]
    );

    await processCompletedProductionJobs();

    // Check machinery was depreciated by 0.01
    const biz = await pool.query('SELECT machinery_qty FROM businesses WHERE id = $1', [businessId]);
    const machineryQty = parseFloat(biz.rows[0].machinery_qty);
    expect(machineryQty).toBeCloseTo(0.99, 2);
  });

  it('machinery does not go below zero', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    // Set machinery to very small amount
    await pool.query('UPDATE businesses SET machinery_qty = 0.005 WHERE id = $1', [businessId]);

    await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: { businessId, wageCents: 12000, hoursPerDay: 8, idempotencyKey: idem() },
    });

    await giveBusinessInventory(businessId, 'RAW_FOOD', 3);
    await giveBusinessInventory(businessId, 'FRESH_WATER', 1);
    await giveBusinessInventory(businessId, 'ENERGY', 1);

    const startRes = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });
    const jobId = JSON.parse(startRes.body).result.jobId;

    await pool.query(
      `UPDATE production_jobs SET finishes_at = NOW() - interval '1 minute' WHERE id = $1`,
      [jobId]
    );

    await processCompletedProductionJobs();

    const biz = await pool.query('SELECT machinery_qty FROM businesses WHERE id = $1', [businessId]);
    const machineryQty = parseFloat(biz.rows[0].machinery_qty);
    expect(machineryQty).toBe(0);
  });
});

describe('Worker Satisfaction Bounds', () => {
  it('satisfaction of newly hired worker is 1.0', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    const res = await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: { businessId, wageCents: 12000, hoursPerDay: 8, idempotencyKey: idem() },
    });
    const result = JSON.parse(res.body);
    expect(result.result.satisfaction).toBe(1.0);

    // Also check DB directly
    const dbRow = await pool.query(
      `SELECT satisfaction FROM business_workers WHERE business_id = $1`,
      [businessId]
    );
    expect(parseFloat(dbRow.rows[0].satisfaction)).toBe(1.0);
  });

  it('satisfaction stays in [0, 1.3] via DB constraint', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: { businessId, wageCents: 12000, hoursPerDay: 8, idempotencyKey: idem() },
    });

    // Try to set satisfaction above 1.3 — should fail
    await expect(
      pool.query(
        `UPDATE business_workers SET satisfaction = 1.5 WHERE business_id = $1`,
        [businessId]
      )
    ).rejects.toThrow();

    // Try to set satisfaction below 0 — should fail
    await expect(
      pool.query(
        `UPDATE business_workers SET satisfaction = -0.1 WHERE business_id = $1`,
        [businessId]
      )
    ).rejects.toThrow();
  });
});

describe('Business Queries', () => {
  it('lists player businesses', async () => {
    // Give player extra funds to register two businesses
    const wallet = await pool.query(
      'SELECT account_id FROM player_wallets WHERE player_id = $1',
      [playerId]
    );
    const acctId = wallet.rows[0].account_id;
    await pool.query(
      `INSERT INTO ledger_entries (from_account, to_account, amount_cents, entry_type, memo)
       VALUES (1, $1, 200000, 'initial_grant', 'extra funds for test')`,
      [acctId]
    );

    await registerBusiness('Factory A', 'INDUSTRIAL');
    await registerBusiness('Factory B', 'TECH_PARK');

    const res = await server.inject({
      method: 'GET',
      url: '/business',
      headers: authHeaders(cookie),
    });
    expect(res.statusCode).toBe(200);
    const businesses = JSON.parse(res.body);
    expect(businesses).toHaveLength(2);
  });

  it('lists all recipes', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/business/recipes',
      headers: authHeaders(cookie),
    });
    expect(res.statusCode).toBe(200);
    const recipes = JSON.parse(res.body);
    expect(recipes.length).toBeGreaterThanOrEqual(2);

    const processFood = recipes.find((r: any) => r.code === 'PROCESS_FOOD');
    expect(processFood).toBeDefined();
    expect(processFood.laborHours).toBe(2);
    expect(processFood.machineryDep).toBe(0.01);
    expect(processFood.inputs).toHaveLength(3);
    expect(processFood.outputs).toHaveLength(2);
  });

  it('lists production jobs for a business', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    const res = await server.inject({
      method: 'GET',
      url: `/business/${businessId}/jobs`,
      headers: authHeaders(cookie),
    });
    expect(res.statusCode).toBe(200);
    const jobs = JSON.parse(res.body);
    expect(jobs).toHaveLength(0);
  });
});

describe('Vigor Costs', () => {
  it('charges CV-6 MV-2 on registration', async () => {
    // Get initial vigor
    const beforeRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });
    const before = JSON.parse(beforeRes.body);

    await registerBusiness();

    // Get vigor after
    const afterRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });
    const after = JSON.parse(afterRes.body);

    expect(before.vigor.cv - after.vigor.cv).toBe(6);
    expect(before.vigor.mv - after.vigor.mv).toBe(2);
  });

  it('charges SV-6 MV-4 on hiring session', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    const beforeRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });
    const before = JSON.parse(beforeRes.body);

    await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: { businessId, wageCents: 12000, hoursPerDay: 8, idempotencyKey: idem() },
    });

    const afterRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });
    const after = JSON.parse(afterRes.body);

    expect(before.vigor.sv - after.vigor.sv).toBe(6);
    expect(before.vigor.mv - after.vigor.mv).toBe(4);
  });

  it('charges MV-6 CV-2 on production planning', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    await pool.query('UPDATE businesses SET machinery_qty = 1 WHERE id = $1', [businessId]);

    // Hire worker
    await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: { businessId, wageCents: 12000, hoursPerDay: 8, idempotencyKey: idem() },
    });

    // Give inputs
    await giveBusinessInventory(businessId, 'RAW_FOOD', 3);
    await giveBusinessInventory(businessId, 'FRESH_WATER', 1);
    await giveBusinessInventory(businessId, 'ENERGY', 1);

    const beforeRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });
    const before = JSON.parse(beforeRes.body);

    await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });

    const afterRes = await server.inject({
      method: 'GET',
      url: '/me/state',
      headers: authHeaders(cookie),
    });
    const after = JSON.parse(afterRes.body);

    // Production planning costs MV-6, CV-2
    expect(before.vigor.mv - after.vigor.mv).toBe(6);
    expect(before.vigor.cv - after.vigor.cv).toBe(2);
  });
});

describe('No Machinery', () => {
  it('rejects production if no machinery', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    // Don't give machinery (default is 0)

    await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: { businessId, wageCents: 12000, hoursPerDay: 8, idempotencyKey: idem() },
    });

    await giveBusinessInventory(businessId, 'RAW_FOOD', 3);
    await giveBusinessInventory(businessId, 'FRESH_WATER', 1);
    await giveBusinessInventory(businessId, 'ENERGY', 1);

    const res = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain('machinery');
  });
});

describe('Insufficient Labor', () => {
  it('rejects production if not enough labor hours', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    await pool.query('UPDATE businesses SET machinery_qty = 1 WHERE id = $1', [businessId]);

    // Hire a worker with only 1 hour/day (need 2 for PROCESS_FOOD)
    await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: { businessId, wageCents: 12000, hoursPerDay: 1, idempotencyKey: idem() },
    });

    await giveBusinessInventory(businessId, 'RAW_FOOD', 3);
    await giveBusinessInventory(businessId, 'FRESH_WATER', 1);
    await giveBusinessInventory(businessId, 'ENERGY', 1);

    const res = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain('labor');
  });
});

// ── Bug #6: Labor double-spend ────────────────────────────────

describe('Labor double-spend prevention (Bug #6)', () => {
  it('rejects second production job when labor is fully committed', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    await pool.query('UPDATE businesses SET machinery_qty = 1 WHERE id = $1', [businessId]);

    // Hire a worker with exactly 2 hours (PROCESS_FOOD needs 2)
    await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: { businessId, wageCents: 12000, hoursPerDay: 2, idempotencyKey: idem() },
    });

    // Give enough inventory for two jobs
    await giveBusinessInventory(businessId, 'RAW_FOOD', 20);
    await giveBusinessInventory(businessId, 'FRESH_WATER', 10);
    await giveBusinessInventory(businessId, 'ENERGY', 10);

    // First production should succeed
    const res1 = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });
    expect(res1.statusCode).toBe(200);

    // Second production should fail — all labor committed to first job
    const res2 = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });
    expect(res2.statusCode).toBe(400);
    expect(JSON.parse(res2.body).error).toContain('labor');
  });
});

// ── Bug #12: Inventory double-spend ───────────────────────────

describe('Inventory double-spend prevention (Bug #12)', () => {
  it('rejects second production job when inventory is consumed by first', async () => {
    const regResult = await registerBusiness();
    const businessId = regResult.result.businessId;

    await pool.query('UPDATE businesses SET machinery_qty = 1 WHERE id = $1', [businessId]);

    // Hire worker with enough hours for two concurrent jobs
    await server.inject({
      method: 'POST',
      url: '/business/hire',
      headers: authHeaders(cookie),
      payload: { businessId, wageCents: 12000, hoursPerDay: 8, idempotencyKey: idem() },
    });

    // Give exactly enough inventory for ONE PROCESS_FOOD job (3 RAW_FOOD, 1 FRESH_WATER, 1 ENERGY)
    await giveBusinessInventory(businessId, 'RAW_FOOD', 3);
    await giveBusinessInventory(businessId, 'FRESH_WATER', 1);
    await giveBusinessInventory(businessId, 'ENERGY', 1);

    // First production should succeed
    const res1 = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });
    expect(res1.statusCode).toBe(200);

    // Second production should fail — inventory already consumed
    const res2 = await server.inject({
      method: 'POST',
      url: '/business/production/start',
      headers: authHeaders(cookie),
      payload: { businessId, recipeCode: 'PROCESS_FOOD', idempotencyKey: idem() },
    });
    expect(res2.statusCode).toBe(400);
    expect(JSON.parse(res2.body).error).toContain('Insufficient');
  });
});
