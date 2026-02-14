/**
 * Soft-Gating — Blueth City MVP
 *
 * Low vigor dimensions reduce effectiveness without hard lockouts.
 * Every function returns a bounded multiplier so the player is
 * never completely blocked, just less efficient.
 *
 * B) Soft-gate rules:
 *   PV — Physical job performance (handled by economy.ts VigorWeights, not here)
 *   MV — Trading / business planning slippage
 *   SV — Service jobs / hiring outcomes
 *   CV — Admin fees / admin action speed
 *   SpV — Global regen penalty (max −10 %)
 */

import type { VigorDimension } from './types';

// ── Thresholds ──────────────────────────────────────────────

/** Below this value the soft-gate starts ramping. */
const SOFT_GATE_THRESHOLD = 50;

// ── MV → Trading Slippage ───────────────────────────────────

/**
 * Low MV makes trading/business planning less effective.
 * Returns a slippage factor [0, 0.15] applied to trade prices.
 *
 * MV ≥ 50  → 0 (no slippage)
 * MV = 0   → 0.15 (15 % price slippage)
 *
 * Usage: effective buy price  = price * (1 + slippage)
 *        effective sell price = price * (1 - slippage)
 */
export function calculateMvTradingSlippage(mv: number): number {
  if (mv >= SOFT_GATE_THRESHOLD) return 0;
  return Math.min(0.15, Math.max(0, (1 - mv / SOFT_GATE_THRESHOLD) * 0.15));
}

/**
 * Returns a clamped "efficiency" multiplier for trading/business.
 * [0.85, 1.0].  Lower MV → lower multiplier.
 */
export function calculateMvTradeEfficiency(mv: number): number {
  return 1 - calculateMvTradingSlippage(mv);
}

// ── SV → Service / Hiring ───────────────────────────────────

/**
 * Low SV reduces service job performance and hiring outcomes.
 * Returns multiplier [0.70, 1.00].
 *
 * SV ≥ 50  → 1.0
 * SV = 0   → 0.70
 */
export function calculateSvServiceMultiplier(sv: number): number {
  if (sv >= SOFT_GATE_THRESHOLD) return 1.0;
  return Math.max(0.70, 0.70 + (sv / SOFT_GATE_THRESHOLD) * 0.30);
}

// ── CV → Admin Fees & Speed ─────────────────────────────────

/**
 * Low CV increases fees on administrative actions (registration, permits).
 * Returns a fee multiplier [1.00, 1.25].
 *
 * CV ≥ 50  → 1.0  (normal fees)
 * CV = 0   → 1.25 (25 % surcharge)
 */
export function calculateCvFeeMultiplier(cv: number): number {
  if (cv >= SOFT_GATE_THRESHOLD) return 1.0;
  return Math.min(1.25, 1.0 + (1 - cv / SOFT_GATE_THRESHOLD) * 0.25);
}

/**
 * Low CV slows admin-class actions.
 * Returns a duration multiplier [1.0, 1.5].
 *
 * CV ≥ 50  → 1.0  (normal speed)
 * CV = 0   → 1.5  (50 % slower)
 */
export function calculateCvAdminSpeedMultiplier(cv: number): number {
  if (cv >= SOFT_GATE_THRESHOLD) return 1.0;
  return Math.min(1.5, 1.0 + (1 - cv / SOFT_GATE_THRESHOLD) * 0.5);
}

// ── SpV → Global Regen Penalty ──────────────────────────────

/**
 * Low SpV applies a mild global regen penalty, max −10 %.
 * Returns a multiplier [0.90, 1.00].
 *
 * SpV ≥ 50  → 1.0
 * SpV = 0   → 0.90
 */
export function calculateSpvRegenMultiplier(spv: number): number {
  if (spv >= SOFT_GATE_THRESHOLD) return 1.0;
  return Math.max(0.90, 0.90 + (spv / SOFT_GATE_THRESHOLD) * 0.10);
}

// ── Composite Helper ────────────────────────────────────────

export interface SoftGateReport {
  mvSlippage: number;
  svServiceMult: number;
  cvFeeMult: number;
  cvSpeedMult: number;
  spvRegenMult: number;
}

/**
 * Compute all soft-gate values at once from a vigor snapshot.
 * Useful for the projection / preview endpoint.
 */
export function computeSoftGates(vigor: VigorDimension): SoftGateReport {
  return {
    mvSlippage: calculateMvTradingSlippage(vigor.mv),
    svServiceMult: calculateSvServiceMultiplier(vigor.sv),
    cvFeeMult: calculateCvFeeMultiplier(vigor.cv),
    cvSpeedMult: calculateCvAdminSpeedMultiplier(vigor.cv),
    spvRegenMult: calculateSpvRegenMultiplier(vigor.spv),
  };
}

export { SOFT_GATE_THRESHOLD };
