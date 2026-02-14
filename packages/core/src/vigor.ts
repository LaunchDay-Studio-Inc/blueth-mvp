import type { VigorDimension, VigorCaps, VigorKey } from './types';
import { VIGOR_KEYS } from './types';
import { InsufficientVigorError } from './errors';

/**
 * Vigor system — 5 dimensions with regeneration, depletion, and cascade.
 *
 * Dimensions:
 *   PV (Physical)  — stamina, health, energy for physical tasks
 *   MV (Mental)    — focus, concentration, cognitive capacity
 *   SV (Social)    — charisma, emotional energy, social battery
 *   CV (Creative)  — inspiration, artistic energy, innovation
 *   SpV (Spiritual) — purpose, meaning, inner peace
 *
 * All operations return an audit entry describing what changed,
 * so callers can log the mutation.
 */

export const HOURLY_REGEN_RATE = 5;
const MIN_VIGOR = 0;
const DEFAULT_CAP = 100;
const CASCADE_THRESHOLD = 20;

// ── Types ─────────────────────────────────────────────────────

export interface VigorAuditEntry {
  dimension: VigorKey;
  before: number;
  after: number;
  delta: number;
}

export interface VigorMutationResult {
  vigor: VigorDimension;
  audit: VigorAuditEntry[];
}

// ── Core helpers ──────────────────────────────────────────────

function getCap(key: VigorKey, caps?: VigorCaps): number {
  if (!caps) return DEFAULT_CAP;
  return caps[`${key}_cap` as keyof VigorCaps];
}

function clampDim(value: number, cap: number): number {
  return Math.max(MIN_VIGOR, Math.min(value, cap));
}

// ── Public API ────────────────────────────────────────────────

/**
 * Add vigor to each dimension (e.g. regen, food buff).
 * Clamps each dimension to [0, cap].
 * Returns new state + audit trail.
 */
export function addVigor(
  current: VigorDimension,
  delta: Partial<VigorDimension>,
  caps?: VigorCaps
): VigorMutationResult {
  const result: Record<string, number> = {};
  const audit: VigorAuditEntry[] = [];

  for (const key of VIGOR_KEYS) {
    const cap = getCap(key, caps);
    const before = current[key];
    const after = clampDim(before + (delta[key] ?? 0), cap);
    result[key] = after;
    if (after !== before) {
      audit.push({ dimension: key, before, after, delta: after - before });
    }
  }

  return { vigor: result as unknown as VigorDimension, audit };
}

/**
 * Subtract vigor from each dimension (e.g. action cost).
 * Clamps each dimension to [0, cap].
 * Returns new state + audit trail.
 */
export function subVigor(
  current: VigorDimension,
  cost: Partial<VigorDimension>,
  caps?: VigorCaps
): VigorMutationResult {
  const result: Record<string, number> = {};
  const audit: VigorAuditEntry[] = [];

  for (const key of VIGOR_KEYS) {
    const cap = getCap(key, caps);
    const before = current[key];
    const after = clampDim(before - (cost[key] ?? 0), cap);
    result[key] = after;
    if (after !== before) {
      audit.push({ dimension: key, before, after, delta: after - before });
    }
  }

  return { vigor: result as unknown as VigorDimension, audit };
}

/**
 * Apply hourly vigor regeneration, clamped to per-dimension caps.
 */
export function applyVigorRegen(
  current: VigorDimension,
  hours: number,
  caps?: VigorCaps
): VigorMutationResult {
  const regenDelta: Partial<VigorDimension> = {};
  const amount = HOURLY_REGEN_RATE * hours;
  for (const key of VIGOR_KEYS) {
    regenDelta[key] = amount;
  }
  return addVigor(current, regenDelta, caps);
}

/**
 * Deplete vigor for an action. Clamps to 0, never negative.
 * Alias for subVigor — kept for semantic clarity.
 */
export function depleteVigor(
  current: VigorDimension,
  cost: Partial<VigorDimension>,
  caps?: VigorCaps
): VigorMutationResult {
  return subVigor(current, cost, caps);
}

/**
 * Calculate efficiency multiplier from cascade effect.
 * Each dimension below CASCADE_THRESHOLD incurs a 0.1 penalty.
 * Floor at 0.5 — player always retains some effectiveness.
 */
export function calculateEfficiency(vigor: VigorDimension): number {
  const belowCount = VIGOR_KEYS.filter((k) => vigor[k] < CASCADE_THRESHOLD).length;
  if (belowCount === 0) return 1.0;
  return Math.max(0.5, 1.0 - belowCount * 0.1);
}

/**
 * Check whether the player has enough vigor to pay an action cost.
 */
export function canAffordVigorCost(
  current: VigorDimension,
  cost: Partial<VigorDimension>
): boolean {
  return VIGOR_KEYS.every((k) => current[k] >= (cost[k] ?? 0));
}

/**
 * Assert that the player can afford the vigor cost.
 * Throws InsufficientVigorError for the first dimension that's short.
 */
export function assertVigorCost(
  current: VigorDimension,
  cost: Partial<VigorDimension>
): void {
  for (const key of VIGOR_KEYS) {
    const required = cost[key] ?? 0;
    if (current[key] < required) {
      throw new InsufficientVigorError(key, required, current[key]);
    }
  }
}
