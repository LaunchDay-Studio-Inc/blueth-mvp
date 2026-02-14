import type { VigorDimension, VigorCaps } from './types';
import { VIGOR_KEYS } from './types';

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
 * Regen is hourly and respects per-dimension caps.
 * Cascade: dimensions below threshold reduce overall efficiency.
 * Floor: efficiency never drops below 0.5 (no hard lockout).
 */

const HOURLY_REGEN_RATE = 5; // points per game-hour
const MIN_VIGOR = 0;
const DEFAULT_CAP = 100;
const CASCADE_THRESHOLD = 20;

export interface VigorRegenResult {
  vigor: VigorDimension;
  regenApplied: VigorDimension;
}

/**
 * Apply hourly vigor regeneration, clamped to per-dimension caps.
 */
export function applyVigorRegen(
  current: VigorDimension,
  hours: number,
  caps?: VigorCaps
): VigorRegenResult {
  const regenAmount = HOURLY_REGEN_RATE * hours;
  const result: Record<string, number> = {};
  const applied: Record<string, number> = {};

  for (const key of VIGOR_KEYS) {
    const cap = caps ? caps[`${key}_cap` as keyof VigorCaps] : DEFAULT_CAP;
    const newVal = Math.min(current[key] + regenAmount, cap);
    result[key] = newVal;
    applied[key] = newVal - current[key];
  }

  return {
    vigor: result as unknown as VigorDimension,
    regenApplied: applied as unknown as VigorDimension,
  };
}

/**
 * Deplete vigor for an action. Clamps to MIN_VIGOR (0), never negative.
 */
export function depleteVigor(
  current: VigorDimension,
  cost: Partial<VigorDimension>
): VigorDimension {
  const result: Record<string, number> = {};
  for (const key of VIGOR_KEYS) {
    result[key] = Math.max(current[key] - (cost[key] ?? 0), MIN_VIGOR);
  }
  return result as unknown as VigorDimension;
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
