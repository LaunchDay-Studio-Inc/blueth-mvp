/**
 * Business Service — Registration, workers, production, and machinery management.
 *
 * Handles:
 *   - Business registration (fee sink + ledger account creation)
 *   - Location rental (daily rent calculated from district modifier)
 *   - Machinery purchase (capex from player wallet)
 *   - NPC worker hiring and wage management
 *   - Production job scheduling (input reservation at start)
 *   - Production job completion (output creation, waste disposal, machinery dep)
 *   - Worker satisfaction daily update
 *
 * Input Reservation Strategy:
 *   Inputs are deducted from business inventory when production starts.
 *   If the job fails, inputs are returned. This prevents double-spend
 *   across concurrent production jobs and is simpler to reason about
 *   than reserving-at-completion.
 */

import type { PoolClient } from 'pg';
import { transferCents, withTransaction, query, queryOne } from '@blueth/db';
import {
  SYSTEM_ACCOUNTS,
  LEDGER_ENTRY_TYPES,
  DISTRICT_MODIFIERS,
  GOOD_BASE_PRICES,
  BUSINESS_REGISTRATION_FEE_CENTS,
  calculateLocationRent,
  calculateEffectiveLabor,
  hasEnoughLabor,
  applyMachineryDepreciation,
  calculateWasteDisposalFee,
  SATISFACTION_DEFAULT,
  MARKET_AVERAGE_WAGE_CENTS,
  updateWorkerSatisfaction,
  InsufficientFundsError,
  InsufficientInventoryError,
  ValidationError,
  NotFoundError,
} from '@blueth/core';
import { txQueryOne } from './action-engine';
import { createLogger } from './observability';

const logger = createLogger('business');

// ── Types ────────────────────────────────────────────────────

export interface BusinessRow {
  id: string;
  owner_player_id: string;
  name: string;
  district_code: string;
  location_code: string | null;
  account_id: number | null;
  machinery_qty: string;
  daily_location_rent_cents: number;
  created_at: string;
}

export interface BusinessWorkerRow {
  id: string;
  business_id: string;
  npc_id: string | null;
  wage_cents: number;
  satisfaction: string;
  hours_per_day: number;
  created_at: string;
  updated_at: string;
}

export interface RecipeRow {
  id: number;
  code: string;
  name: string;
  duration_seconds: number;
  labor_hours: string;
  machinery_dep: string;
}

export interface RecipeInputRow {
  recipe_id: number;
  good_id: number;
  qty: string;
}

export interface RecipeOutputRow {
  recipe_id: number;
  good_id: number;
  qty: string;
}

export interface ProductionJobRow {
  id: string;
  business_id: string;
  recipe_id: number;
  status: string;
  started_at: string | null;
  finishes_at: string | null;
  result: unknown;
  created_at: string;
}

export interface GoodRow {
  id: number;
  code: string;
  name: string;
  is_essential: boolean;
}

// ── Helpers ──────────────────────────────────────────────────

async function getBusinessForPlayer(
  tx: PoolClient,
  businessId: string,
  playerId: string,
): Promise<BusinessRow> {
  const row = await txQueryOne<BusinessRow>(
    tx,
    'SELECT * FROM businesses WHERE id = $1 AND owner_player_id = $2 FOR UPDATE',
    [businessId, playerId]
  );
  if (!row) throw new NotFoundError('Business', businessId);
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
  ownerId: string,
  goodId: number,
): Promise<number> {
  const row = await txQueryOne<{ qty: string }>(
    tx,
    `SELECT qty FROM inventories
     WHERE owner_type = $1 AND owner_id = $2 AND good_id = $3
     FOR UPDATE`,
    [ownerType, ownerId, goodId]
  );
  return parseFloat(row?.qty ?? '0');
}

async function adjustInventory(
  tx: PoolClient,
  ownerType: string,
  ownerId: string,
  goodId: number,
  delta: number,
): Promise<void> {
  if (delta === 0) return;
  await tx.query(
    `INSERT INTO inventories (owner_type, owner_id, good_id, qty)
     VALUES ($1, $2, $3, GREATEST(0, $4::numeric))
     ON CONFLICT (owner_type, owner_id, good_id)
     DO UPDATE SET qty = GREATEST(0, inventories.qty + $4::numeric), updated_at = NOW()`,
    [ownerType, ownerId, goodId, delta]
  );
}

// ── Business Registration ────────────────────────────────────

export interface RegisterBusinessInput {
  playerId: string;
  name: string;
  districtCode: string;
}

export interface RegisterBusinessResult {
  businessId: string;
  name: string;
  districtCode: string;
  accountId: number;
  registrationFeeCents: number;
  dailyRentCents: number;
}

/**
 * Register a new business.
 * - Charges registration fee from player wallet → BILL_PAYMENT_SINK
 * - Creates a ledger account for the business
 * - Stores business with daily rent based on district modifier
 */
export async function registerBusiness(
  tx: PoolClient,
  input: RegisterBusinessInput,
  actionId: string,
): Promise<RegisterBusinessResult> {
  const { playerId, name, districtCode } = input;

  // Validate district
  const districtModifier = DISTRICT_MODIFIERS[districtCode];
  if (districtModifier === undefined) {
    throw new ValidationError(`Unknown district: ${districtCode}`);
  }

  // Check player can afford registration fee
  const playerAccountId = await getPlayerAccountId(tx, playerId);
  const balance = await getBalanceInTx(tx, playerAccountId);
  if (balance < BUSINESS_REGISTRATION_FEE_CENTS) {
    throw new InsufficientFundsError(BUSINESS_REGISTRATION_FEE_CENTS, balance);
  }

  // Charge registration fee
  await transferCents(
    tx,
    playerAccountId,
    SYSTEM_ACCOUNTS.BILL_PAYMENT_SINK,
    BUSINESS_REGISTRATION_FEE_CENTS,
    LEDGER_ENTRY_TYPES.BUSINESS_REGISTRATION,
    actionId,
    `Business registration: ${name}`
  );

  // Create ledger account for the business
  const accountRow = await txQueryOne<{ id: number }>(
    tx,
    `INSERT INTO ledger_accounts (owner_type, owner_id, currency)
     VALUES ('business', NULL, 'BCE') RETURNING id`,
    []
  );
  const businessAccountId = accountRow!.id;

  // Calculate daily rent
  const dailyRentCents = calculateLocationRent(districtModifier);

  // Create business
  const bizRow = await txQueryOne<BusinessRow>(
    tx,
    `INSERT INTO businesses (owner_player_id, name, district_code, account_id,
       daily_location_rent_cents)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [playerId, name, districtCode, businessAccountId, dailyRentCents]
  );

  // Update the ledger_accounts owner_id now that we have the business ID
  await tx.query(
    `UPDATE ledger_accounts SET owner_id = $1 WHERE id = $2`,
    [bizRow!.id, businessAccountId]
  );

  return {
    businessId: bizRow!.id,
    name: bizRow!.name,
    districtCode: bizRow!.district_code,
    accountId: businessAccountId,
    registrationFeeCents: BUSINESS_REGISTRATION_FEE_CENTS,
    dailyRentCents,
  };
}

// ── Machinery Purchase ───────────────────────────────────────

export interface BuyMachineryResult {
  businessId: string;
  priceCents: number;
  newMachineryQty: number;
}

/**
 * Buy machinery (INDUSTRIAL_MACHINERY) for a business.
 * - Deducts price from player wallet → BILL_PAYMENT_SINK (capex)
 * - Increments business.machinery_qty
 */
export async function buyMachinery(
  tx: PoolClient,
  playerId: string,
  businessId: string,
  qty: number,
  actionId: string,
): Promise<BuyMachineryResult> {
  const biz = await getBusinessForPlayer(tx, businessId, playerId);
  const playerAccountId = await getPlayerAccountId(tx, playerId);

  // Price: INDUSTRIAL_MACHINERY ref price per unit
  const priceCents = GOOD_BASE_PRICES.INDUSTRIAL_MACHINERY * qty;

  const balance = await getBalanceInTx(tx, playerAccountId);
  if (balance < priceCents) {
    throw new InsufficientFundsError(priceCents, balance);
  }

  // Charge capex
  await transferCents(
    tx,
    playerAccountId,
    SYSTEM_ACCOUNTS.BILL_PAYMENT_SINK,
    priceCents,
    LEDGER_ENTRY_TYPES.BUSINESS_CAPEX,
    actionId,
    `Machinery purchase: ${qty} units for ${biz.name}`
  );

  // Increment machinery qty
  const updated = await txQueryOne<{ machinery_qty: string }>(
    tx,
    `UPDATE businesses SET machinery_qty = machinery_qty + $2
     WHERE id = $1 RETURNING machinery_qty`,
    [businessId, qty]
  );

  return {
    businessId,
    priceCents,
    newMachineryQty: parseFloat(updated!.machinery_qty),
  };
}

// ── Worker Hiring ────────────────────────────────────────────

export interface HireWorkerInput {
  playerId: string;
  businessId: string;
  wageCents: number;
  hoursPerDay: number;
}

export interface HireWorkerResult {
  workerId: string;
  businessId: string;
  wageCents: number;
  hoursPerDay: number;
  satisfaction: number;
}

/**
 * Hire an NPC worker for a business.
 * No upfront cost. Wage is charged daily by the tick worker.
 */
export async function hireWorker(
  tx: PoolClient,
  input: HireWorkerInput,
): Promise<HireWorkerResult> {
  const { playerId, businessId, wageCents, hoursPerDay } = input;

  // Validate ownership
  await getBusinessForPlayer(tx, businessId, playerId);

  // Validate inputs
  if (wageCents < 0) throw new ValidationError('Wage must be non-negative');
  if (hoursPerDay <= 0 || hoursPerDay > 24) {
    throw new ValidationError('Hours per day must be between 1 and 24');
  }

  // Insert worker
  const row = await txQueryOne<BusinessWorkerRow>(
    tx,
    `INSERT INTO business_workers (business_id, wage_cents, satisfaction, hours_per_day)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [businessId, wageCents, SATISFACTION_DEFAULT, hoursPerDay]
  );

  return {
    workerId: row!.id,
    businessId,
    wageCents,
    hoursPerDay,
    satisfaction: SATISFACTION_DEFAULT,
  };
}

// ── Production Planning & Start ──────────────────────────────

export interface StartProductionInput {
  playerId: string;
  businessId: string;
  recipeCode: string;
}

export interface StartProductionResult {
  jobId: string;
  recipeCode: string;
  durationSeconds: number;
  finishesAt: string;
  inputsReserved: Array<{ goodCode: string; qty: number }>;
}

/**
 * Start a production job.
 *
 * 1. Validate business ownership and recipe existence
 * 2. Check business has sufficient machinery (> 0)
 * 3. Check business workers have enough effective labor hours
 * 4. Reserve inputs (deduct from business inventory)
 * 5. Create production_job with status='running' and finishes_at
 */
export async function startProduction(
  tx: PoolClient,
  input: StartProductionInput,
): Promise<StartProductionResult> {
  const { playerId, businessId, recipeCode } = input;
  const biz = await getBusinessForPlayer(tx, businessId, playerId);

  // Get recipe
  const recipe = await txQueryOne<RecipeRow>(
    tx,
    'SELECT * FROM recipes WHERE code = $1',
    [recipeCode]
  );
  if (!recipe) throw new NotFoundError('Recipe', recipeCode);

  // Check machinery
  const machineryQty = parseFloat(biz.machinery_qty);
  if (machineryQty <= 0) {
    throw new ValidationError('Business has no machinery. Purchase machinery first.');
  }

  // Check labor (use transaction to get consistent snapshot)
  const workerResult = await tx.query<BusinessWorkerRow>(
    `SELECT * FROM business_workers WHERE business_id = $1 FOR UPDATE`,
    [businessId]
  );
  const workers = workerResult.rows;
  const effectiveLabor = calculateEffectiveLabor(
    workers.map((w) => ({
      hoursPerDay: w.hours_per_day,
      satisfaction: parseFloat(w.satisfaction),
    }))
  );

  // Subtract labor already committed by running production jobs
  const committedResult = await tx.query<{ committed: string }>(
    `SELECT COALESCE(SUM(r.labor_hours), 0) AS committed
     FROM production_jobs pj
     JOIN recipes r ON r.id = pj.recipe_id
     WHERE pj.business_id = $1 AND pj.status = 'running'`,
    [businessId]
  );
  const committedLabor = parseFloat(committedResult.rows[0]?.committed ?? '0');
  const availableLabor = effectiveLabor - committedLabor;

  const requiredLabor = parseFloat(recipe.labor_hours);
  if (!hasEnoughLabor(availableLabor, requiredLabor)) {
    throw new ValidationError(
      `Insufficient labor: need ${requiredLabor}h, have ${availableLabor.toFixed(1)}h available (${committedLabor.toFixed(1)}h committed to running jobs)`
    );
  }

  // Get recipe inputs
  const recipeInputs = await query<RecipeInputRow & { code: string }>(
    `SELECT ri.*, g.code FROM recipe_inputs ri
     JOIN goods g ON g.id = ri.good_id
     WHERE ri.recipe_id = $1`,
    [recipe.id]
  );

  // Check and reserve inputs
  const reservedInputs: Array<{ goodCode: string; qty: number }> = [];
  for (const ri of recipeInputs) {
    const qty = parseFloat(ri.qty);
    const available = await getInventoryQty(tx, 'business', businessId, ri.good_id);
    if (available < qty) {
      throw new InsufficientInventoryError(ri.code, qty, available);
    }
    // Deduct from business inventory (reservation)
    await adjustInventory(tx, 'business', businessId, ri.good_id, -qty);
    reservedInputs.push({ goodCode: ri.code, qty });
  }

  // Create production job
  const finishesAt = new Date(Date.now() + recipe.duration_seconds * 1000).toISOString();
  const jobRow = await txQueryOne<ProductionJobRow>(
    tx,
    `INSERT INTO production_jobs (business_id, recipe_id, status, started_at, finishes_at)
     VALUES ($1, $2, 'running', NOW(), $3::timestamptz)
     RETURNING *`,
    [businessId, recipe.id, finishesAt]
  );

  return {
    jobId: jobRow!.id,
    recipeCode: recipe.code,
    durationSeconds: recipe.duration_seconds,
    finishesAt: jobRow!.finishes_at!,
    inputsReserved: reservedInputs,
  };
}

// ── Production Job Completion (called from tick worker) ──────

export interface CompleteJobResult {
  jobId: string;
  businessId: string;
  recipeCode: string;
  outputsProduced: Array<{
    goodCode: string;
    qty: number;
  }>;
  wasteDisposalFeeCents: number;
  wasteFeePaidCents: number;
  wasteFeeUnpaidCents: number;
  machineryDepreciation: number;
  newMachineryQty: number;
}

/**
 * Complete a single production job.
 *
 * 1. Lock the job row (FOR UPDATE SKIP LOCKED)
 * 2. Produce outputs into business inventory
 * 3. Charge waste disposal fee from business account → BILL_PAYMENT_SINK
 * 4. Apply machinery depreciation
 * 5. Mark job completed with result JSON
 *
 * Called by the tick worker for jobs where finishes_at <= now.
 */
export async function completeProductionJob(
  tx: PoolClient,
  jobId: string,
): Promise<CompleteJobResult | null> {
  // Lock the job
  const job = await txQueryOne<ProductionJobRow>(
    tx,
    `SELECT * FROM production_jobs WHERE id = $1 AND status = 'running' FOR UPDATE SKIP LOCKED`,
    [jobId]
  );
  if (!job) return null; // Already completed or locked by another worker

  // Get recipe
  const recipe = await txQueryOne<RecipeRow>(
    tx,
    'SELECT * FROM recipes WHERE id = $1',
    [job.recipe_id]
  );
  if (!recipe) {
    await tx.query(
      `UPDATE production_jobs SET status = 'failed', result = $2 WHERE id = $1`,
      [jobId, JSON.stringify({ error: 'Recipe not found' })]
    );
    return null;
  }

  // Get business
  const biz = await txQueryOne<BusinessRow>(
    tx,
    'SELECT * FROM businesses WHERE id = $1 FOR UPDATE',
    [job.business_id]
  );
  if (!biz) {
    await tx.query(
      `UPDATE production_jobs SET status = 'failed', result = $2 WHERE id = $1`,
      [jobId, JSON.stringify({ error: 'Business not found' })]
    );
    return null;
  }

  // Get recipe outputs
  const recipeOutputs = await query<RecipeOutputRow & { code: string }>(
    `SELECT ro.*, g.code FROM recipe_outputs ro
     JOIN goods g ON g.id = ro.good_id
     WHERE ro.recipe_id = $1`,
    [recipe.id]
  );

  // Produce outputs
  const outputsProduced: Array<{ goodCode: string; qty: number }> = [];
  let wasteQty = 0;
  for (const ro of recipeOutputs) {
    const qty = parseFloat(ro.qty);
    await adjustInventory(tx, 'business', job.business_id, ro.good_id, qty);
    outputsProduced.push({ goodCode: ro.code, qty });
    if (ro.code === 'WASTE') {
      wasteQty += qty;
    }
  }

  // Waste disposal fee
  const wasteDisposalFeeCents = calculateWasteDisposalFee(wasteQty);
  let wasteFeePaidCents = 0;
  let wasteFeeUnpaidCents = 0;
  if (wasteDisposalFeeCents > 0 && biz.account_id) {
    const bizBalance = await getBalanceInTx(tx, biz.account_id);
    const payable = Math.min(wasteDisposalFeeCents, bizBalance);
    if (payable > 0) {
      await transferCents(
        tx,
        biz.account_id,
        SYSTEM_ACCOUNTS.BILL_PAYMENT_SINK,
        payable,
        LEDGER_ENTRY_TYPES.WASTE_DISPOSAL,
        null,
        `Waste disposal: ${wasteQty} units from ${recipe.code}`
      );
      wasteFeePaidCents = payable;
    }
    wasteFeeUnpaidCents = wasteDisposalFeeCents - payable;
  }

  // Machinery depreciation
  const machineryDep = parseFloat(recipe.machinery_dep);
  const currentMachinery = parseFloat(biz.machinery_qty);
  const newMachineryQty = applyMachineryDepreciation(currentMachinery, machineryDep);

  await tx.query(
    'UPDATE businesses SET machinery_qty = $2 WHERE id = $1',
    [job.business_id, newMachineryQty]
  );

  // Build result
  const result: CompleteJobResult = {
    jobId: job.id,
    businessId: job.business_id,
    recipeCode: recipe.code,
    outputsProduced,
    wasteDisposalFeeCents,
    wasteFeePaidCents,
    wasteFeeUnpaidCents,
    machineryDepreciation: machineryDep,
    newMachineryQty,
  };

  // Mark completed
  await tx.query(
    `UPDATE production_jobs SET status = 'completed', result = $2 WHERE id = $1`,
    [jobId, JSON.stringify(result)]
  );

  return result;
}

// ── Process All Due Production Jobs (tick entry point) ───────

/**
 * Find and complete all production jobs where finishes_at <= now.
 * Called from the hourly tick worker.
 */
export async function processCompletedProductionJobs(): Promise<{
  jobsCompleted: number;
  errors: number;
}> {
  let jobsCompleted = 0;
  let errors = 0;

  // Query for due jobs (not locked)
  const dueJobs = await query<ProductionJobRow>(
    `SELECT * FROM production_jobs
     WHERE status = 'running' AND finishes_at <= NOW()
     ORDER BY finishes_at ASC
     LIMIT 100`
  );

  for (const job of dueJobs) {
    try {
      await withTransaction(async (tx) => {
        const result = await completeProductionJob(tx, job.id);
        if (result) {
          jobsCompleted++;
          logger.info('Production job completed', {
            jobId: result.jobId,
            businessId: result.businessId,
            recipeCode: result.recipeCode,
          });
        }
      });
    } catch (err) {
      errors++;
      logger.error('Failed to complete production job', {
        jobId: job.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { jobsCompleted, errors };
}

// ── Daily Worker Satisfaction & Wages (tick entry point) ─────

/**
 * Process daily business operations:
 * 1. Charge worker wages from business account
 * 2. Update worker satisfaction
 * 3. Charge location rent
 *
 * Called from the daily tick.
 */
export async function processBusinessDailyTick(): Promise<{
  businessesProcessed: number;
  wagesPaid: number;
  errors: number;
}> {
  let businessesProcessed = 0;
  let wagesPaid = 0;
  let errors = 0;

  const businesses = await query<BusinessRow>(
    'SELECT * FROM businesses ORDER BY id'
  );

  for (const biz of businesses) {
    try {
      await withTransaction(async (tx) => {
        const lockedBiz = await txQueryOne<BusinessRow>(
          tx,
          'SELECT * FROM businesses WHERE id = $1 FOR UPDATE',
          [biz.id]
        );
        if (!lockedBiz || !lockedBiz.account_id) return;

        // Get owner's player account for funding
        const playerAccountId = await getPlayerAccountId(tx, lockedBiz.owner_player_id);

        // 1. Process worker wages
        const workers = await query<BusinessWorkerRow>(
          `SELECT * FROM business_workers WHERE business_id = $1 FOR UPDATE`,
          [biz.id]
        );

        for (const worker of workers) {
          // Pay wage from player wallet to BILL_PAYMENT_SINK
          let actualPaidCents = 0;
          if (worker.wage_cents > 0) {
            const balance = await getBalanceInTx(tx, playerAccountId);
            if (balance >= worker.wage_cents) {
              await transferCents(
                tx,
                playerAccountId,
                SYSTEM_ACCOUNTS.BILL_PAYMENT_SINK,
                worker.wage_cents,
                LEDGER_ENTRY_TYPES.WORKER_WAGE,
                null,
                `Worker wage: ${biz.name}`
              );
              actualPaidCents = worker.wage_cents;
              wagesPaid++;
            }
          }

          // Update satisfaction — use actual paid amount, not configured wage
          const newSat = updateWorkerSatisfaction(
            parseFloat(worker.satisfaction),
            actualPaidCents,
            MARKET_AVERAGE_WAGE_CENTS,
            worker.hours_per_day,
          );

          await tx.query(
            'UPDATE business_workers SET satisfaction = $2 WHERE id = $1',
            [worker.id, newSat]
          );
        }

        // 2. Charge location rent from player wallet
        if (lockedBiz.daily_location_rent_cents > 0) {
          const balance = await getBalanceInTx(tx, playerAccountId);
          if (balance >= lockedBiz.daily_location_rent_cents) {
            await transferCents(
              tx,
              playerAccountId,
              SYSTEM_ACCOUNTS.BILL_PAYMENT_SINK,
              lockedBiz.daily_location_rent_cents,
              LEDGER_ENTRY_TYPES.BUSINESS_RENT,
              null,
              `Business location rent: ${biz.name}`
            );
          }
        }

        businessesProcessed++;
      });
    } catch (err) {
      errors++;
      logger.error('Failed daily tick for business', {
        businessId: biz.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { businessesProcessed, wagesPaid, errors };
}

// ── Query Functions ──────────────────────────────────────────

export async function getBusinessesForPlayer(playerId: string): Promise<BusinessRow[]> {
  return query<BusinessRow>(
    'SELECT * FROM businesses WHERE owner_player_id = $1 ORDER BY created_at DESC',
    [playerId]
  );
}

export async function getBusinessById(
  businessId: string,
  playerId: string,
): Promise<BusinessRow | null> {
  return queryOne<BusinessRow>(
    'SELECT * FROM businesses WHERE id = $1 AND owner_player_id = $2',
    [businessId, playerId]
  );
}

export async function getBusinessWorkers(businessId: string): Promise<BusinessWorkerRow[]> {
  return query<BusinessWorkerRow>(
    'SELECT * FROM business_workers WHERE business_id = $1 ORDER BY created_at ASC',
    [businessId]
  );
}

export async function getProductionJobs(businessId: string): Promise<ProductionJobRow[]> {
  return query<ProductionJobRow>(
    'SELECT * FROM production_jobs WHERE business_id = $1 ORDER BY created_at DESC LIMIT 50',
    [businessId]
  );
}

export async function getBusinessInventory(
  businessId: string,
): Promise<Array<{ goodCode: string; goodName: string; qty: number }>> {
  const rows = await query<{ code: string; name: string; qty: string }>(
    `SELECT g.code, g.name, i.qty
     FROM inventories i
     JOIN goods g ON g.id = i.good_id
     WHERE i.owner_type = 'business' AND i.owner_id = $1 AND i.qty > 0
     ORDER BY g.code`,
    [businessId]
  );
  return rows.map((r) => ({
    goodCode: r.code,
    goodName: r.name,
    qty: parseFloat(r.qty),
  }));
}

export async function listRecipes(): Promise<Array<{
  code: string;
  name: string;
  durationSeconds: number;
  laborHours: number;
  machineryDep: number;
  inputs: Array<{ goodCode: string; qty: number }>;
  outputs: Array<{ goodCode: string; qty: number }>;
}>> {
  const recipes = await query<RecipeRow>('SELECT * FROM recipes ORDER BY id');
  const result = [];

  for (const r of recipes) {
    const inputs = await query<RecipeInputRow & { code: string }>(
      `SELECT ri.*, g.code FROM recipe_inputs ri
       JOIN goods g ON g.id = ri.good_id
       WHERE ri.recipe_id = $1`,
      [r.id]
    );
    const outputs = await query<RecipeOutputRow & { code: string }>(
      `SELECT ro.*, g.code FROM recipe_outputs ro
       JOIN goods g ON g.id = ro.good_id
       WHERE ro.recipe_id = $1`,
      [r.id]
    );

    result.push({
      code: r.code,
      name: r.name,
      durationSeconds: r.duration_seconds,
      laborHours: parseFloat(r.labor_hours),
      machineryDep: parseFloat(r.machinery_dep),
      inputs: inputs.map((i) => ({ goodCode: i.code, qty: parseFloat(i.qty) })),
      outputs: outputs.map((o) => ({ goodCode: o.code, qty: parseFloat(o.qty) })),
    });
  }

  return result;
}
