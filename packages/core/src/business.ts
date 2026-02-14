/**
 * Business Domain Logic — Pure functions for the Business engine.
 *
 * Covers:
 *   - Registration fees & location rent
 *   - Machinery purchase & depreciation
 *   - NPC worker satisfaction model [0, 1.3]
 *   - Production planning: input reservation, labor requirement, outputs
 *   - Vigor costs for business actions
 */

import type { GoodCode } from './types';

// ── Constants ────────────────────────────────────────────────

/** Fee to register a new business (sink to BILL_PAYMENT_SINK). */
export const BUSINESS_REGISTRATION_FEE_CENTS = 50000; // ₿500.00

/** Base daily location rent per district modifier. */
export const BUSINESS_BASE_RENT_CENTS = 5000; // ₿50.00/day base

/** Default machinery quantity on purchase (1 unit). */
export const MACHINERY_UNIT_QTY = 1;

// ── Vigor Costs ──────────────────────────────────────────────

export const BUSINESS_VIGOR_COSTS = {
  /** Production planning: MV-6, CV-2 */
  PLAN_PRODUCTION: { mv: 6, cv: 2 },
  /** Hiring session: SV-6, MV-4 */
  HIRE_SESSION: { sv: 6, mv: 4 },
  /** Compliance/admin: CV-6, MV-2 */
  COMPLIANCE_ADMIN: { cv: 6, mv: 2 },
} as const;

// ── Worker Satisfaction ──────────────────────────────────────

/** Minimum satisfaction (bounds: no death spiral). */
export const SATISFACTION_MIN = 0;
/** Maximum satisfaction. */
export const SATISFACTION_MAX = 1.3;
/** Default starting satisfaction for new hires. */
export const SATISFACTION_DEFAULT = 1.0;

/**
 * How wage relative to market average affects satisfaction.
 *
 * wageRatio = actualWage / marketAverageWage
 * delta = WAGE_SATISFACTION_FACTOR * (wageRatio - 1.0)
 *
 * E.g. paying 20% above average: delta = +0.05
 *      paying 20% below average: delta = -0.05
 */
export const WAGE_SATISFACTION_FACTOR = 0.25;

/**
 * How hours per day affect satisfaction.
 *
 * Base expectation: 8 hours/day.
 * Each hour above 8 costs HOURS_SATISFACTION_PENALTY per hour.
 * Each hour below 8 grants HOURS_SATISFACTION_BONUS per hour.
 */
export const HOURS_BASE = 8;
export const HOURS_SATISFACTION_PENALTY = 0.04; // per hour above 8
export const HOURS_SATISFACTION_BONUS = 0.02;   // per hour below 8

/**
 * Calculate new worker satisfaction after a daily update.
 *
 * @param currentSatisfaction - current satisfaction [0, 1.3]
 * @param wageCents - actual daily wage in cents
 * @param marketAverageWageCents - market average daily wage in cents
 * @param hoursPerDay - scheduled hours per day
 * @returns new satisfaction value, clamped to [0, 1.3]
 */
export function updateWorkerSatisfaction(
  currentSatisfaction: number,
  wageCents: number,
  marketAverageWageCents: number,
  hoursPerDay: number,
): number {
  // Wage effect
  const wageRatio = marketAverageWageCents > 0
    ? wageCents / marketAverageWageCents
    : 1.0;
  const wageDelta = WAGE_SATISFACTION_FACTOR * (wageRatio - 1.0);

  // Hours effect
  const hoursDiff = hoursPerDay - HOURS_BASE;
  const hoursDelta = hoursDiff > 0
    ? -HOURS_SATISFACTION_PENALTY * hoursDiff
    : -HOURS_SATISFACTION_BONUS * hoursDiff; // negative diff = bonus (positive delta)

  // Mean-reversion toward 1.0 (gentle pull)
  const meanReversion = 0.02 * (1.0 - currentSatisfaction);

  const newSat = currentSatisfaction + wageDelta + hoursDelta + meanReversion;
  return clampSatisfaction(newSat);
}

/**
 * Clamp satisfaction to [0, 1.3].
 */
export function clampSatisfaction(value: number): number {
  return Math.max(SATISFACTION_MIN, Math.min(SATISFACTION_MAX, value));
}

// ── Production ───────────────────────────────────────────────

export interface RecipeDefinition {
  code: string;
  name: string;
  durationSeconds: number;
  laborHours: number;
  machineryDep: number;
  inputs: Array<{ goodCode: GoodCode; qty: number }>;
  outputs: Array<{ goodCode: GoodCode; qty: number }>;
}

/**
 * The two MVP recipes, defined as constants for reference/testing.
 */
export const RECIPES: Record<string, RecipeDefinition> = {
  PROCESS_FOOD: {
    code: 'PROCESS_FOOD',
    name: 'Processed Food Production',
    durationSeconds: 3600,
    laborHours: 2,
    machineryDep: 0.01,
    inputs: [
      { goodCode: 'RAW_FOOD', qty: 3 },
      { goodCode: 'FRESH_WATER', qty: 1 },
      { goodCode: 'ENERGY', qty: 1 },
    ],
    outputs: [
      { goodCode: 'PROCESSED_FOOD', qty: 5 },
      { goodCode: 'WASTE', qty: 1 },
    ],
  },
  BUILD_MATERIALS: {
    code: 'BUILD_MATERIALS',
    name: 'Building Materials Production',
    durationSeconds: 7200,
    laborHours: 3,
    machineryDep: 0.02,
    inputs: [
      { goodCode: 'MATERIALS', qty: 2 },
      { goodCode: 'ENERGY', qty: 2 },
    ],
    outputs: [
      { goodCode: 'BUILDING_MATERIALS', qty: 3 },
    ],
  },
};

/**
 * Calculate effective labor hours from workers.
 *
 * effectiveLabor = SUM(worker.hoursPerDay * worker.satisfaction)
 *
 * Satisfaction directly multiplies productivity.
 *
 * @param workers - list of workers with their hours and satisfaction
 * @returns total effective labor hours available
 */
export function calculateEffectiveLabor(
  workers: Array<{ hoursPerDay: number; satisfaction: number }>,
): number {
  let total = 0;
  for (const w of workers) {
    total += w.hoursPerDay * clampSatisfaction(w.satisfaction);
  }
  return total;
}

/**
 * Check if a business has sufficient labor to run a recipe.
 */
export function hasEnoughLabor(
  effectiveLaborHours: number,
  requiredLaborHours: number,
): boolean {
  return effectiveLaborHours >= requiredLaborHours;
}

/**
 * Calculate output quantity multiplier based on effective labor vs required.
 *
 * If effectiveLabor >= requiredLabor: multiplier = 1.0 (no bonus for excess).
 * Always exactly 1.0 — workers meeting requirements means full output.
 * (Satisfaction affects whether enough labor is available, not output qty.)
 */
export function calculateOutputMultiplier(
  _effectiveLaborHours: number,
  _requiredLaborHours: number,
): number {
  return 1.0;
}

/**
 * Apply machinery depreciation.
 * newQty = max(0, currentQty - depreciation)
 */
export function applyMachineryDepreciation(
  currentQty: number,
  depreciation: number,
): number {
  return Math.max(0, currentQty - depreciation);
}

/**
 * Calculate the waste disposal fee for produced waste.
 * Fee = wasteQty * WASTE_DISPOSAL_FEE_PER_UNIT (sink to BILL_PAYMENT_SINK).
 */
export const WASTE_DISPOSAL_FEE_PER_UNIT_CENTS = 50; // ₿0.50 per waste

export function calculateWasteDisposalFee(wasteQty: number): number {
  return Math.floor(wasteQty * WASTE_DISPOSAL_FEE_PER_UNIT_CENTS);
}

/**
 * Calculate location rent based on district modifier.
 */
export function calculateLocationRent(districtModifier: number): number {
  return Math.floor(BUSINESS_BASE_RENT_CENTS * districtModifier);
}

// ── Market Average Wage (simple reference) ──────────────────

/**
 * Reference market average daily wage for NPC workers.
 * Used as baseline for satisfaction calculations.
 */
export const MARKET_AVERAGE_WAGE_CENTS = 12000; // ₿120.00/day
