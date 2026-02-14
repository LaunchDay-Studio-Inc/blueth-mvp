import type { VigorDimension } from './types';

/**
 * Vigor system - manages 5 dimensions of vigor with regeneration and depletion
 *
 * Vigor dimensions:
 * - Physical: stamina, health, energy for physical tasks
 * - Mental: focus, concentration, cognitive capacity
 * - Social: charisma, emotional energy, social battery
 * - Creative: inspiration, artistic energy, innovation capacity
 * - Spiritual: purpose, meaning, inner peace
 *
 * Each dimension regenerates hourly and depletes with actions.
 * Cascade effect: very low vigor in one dimension affects others.
 */

const HOURLY_REGEN_RATE = 5; // points per hour
const MIN_VIGOR = 0;
const MAX_VIGOR = 100;
const CASCADE_THRESHOLD = 20; // below this, cascade effect applies

export interface VigorRegenResult {
  vigor: VigorDimension;
  regenApplied: VigorDimension;
}

/**
 * Apply hourly vigor regeneration
 */
export function applyVigorRegen(current: VigorDimension, hours: number): VigorRegenResult {
  const regenAmount = HOURLY_REGEN_RATE * hours;

  const regenApplied: VigorDimension = {
    physical: Math.min(current.physical + regenAmount, MAX_VIGOR) - current.physical,
    mental: Math.min(current.mental + regenAmount, MAX_VIGOR) - current.mental,
    social: Math.min(current.social + regenAmount, MAX_VIGOR) - current.social,
    creative: Math.min(current.creative + regenAmount, MAX_VIGOR) - current.creative,
    spiritual: Math.min(current.spiritual + regenAmount, MAX_VIGOR) - current.spiritual,
  };

  return {
    vigor: {
      physical: Math.min(current.physical + regenAmount, MAX_VIGOR),
      mental: Math.min(current.mental + regenAmount, MAX_VIGOR),
      social: Math.min(current.social + regenAmount, MAX_VIGOR),
      creative: Math.min(current.creative + regenAmount, MAX_VIGOR),
      spiritual: Math.min(current.spiritual + regenAmount, MAX_VIGOR),
    },
    regenApplied,
  };
}

/**
 * Deplete vigor for an action
 * Returns new vigor state after depletion
 */
export function depleteVigor(
  current: VigorDimension,
  cost: Partial<VigorDimension>
): VigorDimension {
  return {
    physical: Math.max(current.physical - (cost.physical ?? 0), MIN_VIGOR),
    mental: Math.max(current.mental - (cost.mental ?? 0), MIN_VIGOR),
    social: Math.max(current.social - (cost.social ?? 0), MIN_VIGOR),
    creative: Math.max(current.creative - (cost.creative ?? 0), MIN_VIGOR),
    spiritual: Math.max(current.spiritual - (cost.spiritual ?? 0), MIN_VIGOR),
  };
}

/**
 * Apply cascade effect: very low vigor in one dimension reduces effectiveness
 * Returns efficiency multiplier (0.0 to 1.0)
 */
export function calculateEfficiency(vigor: VigorDimension): number {
  const dimensions = [vigor.physical, vigor.mental, vigor.social, vigor.creative, vigor.spiritual];
  const belowThreshold = dimensions.filter(v => v < CASCADE_THRESHOLD);

  if (belowThreshold.length === 0) return 1.0;

  // For each dimension below threshold, reduce efficiency
  // Formula: 0.5 minimum efficiency even if all dimensions are at 0
  const penalty = belowThreshold.length * 0.1;
  return Math.max(0.5, 1.0 - penalty);
}

/**
 * Check if player can afford vigor cost for an action
 */
export function canAffordVigorCost(
  current: VigorDimension,
  cost: Partial<VigorDimension>
): boolean {
  return (
    current.physical >= (cost.physical ?? 0) &&
    current.mental >= (cost.mental ?? 0) &&
    current.social >= (cost.social ?? 0) &&
    current.creative >= (cost.creative ?? 0) &&
    current.spiritual >= (cost.spiritual ?? 0)
  );
}
