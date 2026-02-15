import type { VigorDimension, VigorCaps, VigorKey, VigorState, Buff, MealQuality, SleepState } from './types';
import { VIGOR_KEYS } from './types';
import { InsufficientVigorError } from './errors';
import { getLocalDate } from './time';
import { calculateSpvRegenMultiplier } from './soft-gates';
import { getHousingRegenBonuses } from './economy';
import { DateTime } from 'luxon';

/**
 * Vigor System — Blueth City Core Bible V2
 *
 * 5 dimensions with per-dimension regen rates, circadian multipliers,
 * sleep effects, cascade cross-drain, buff system with caps,
 * meal compliance penalties, and daily reset logic.
 *
 * All operations are pure functions. No mutation. Deterministic.
 */

// ════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════

const MIN_VIGOR = 0;
const DEFAULT_CAP = 100;
const CASCADE_THRESHOLD = 20;
const CRITICAL_DRAIN_RATE = 1.5;       // per hour per critical dimension
const CROSS_DRAIN_CAP_PER_DIM = 3.0;   // max cross-drain per target dim per hour
const BUFF_CAP_PER_DIM_PER_HOUR = 8.0; // max buff bonus per dim per hour
const MAX_PENALTY_LEVEL = 3;           // "no death spiral" clamp

/** Base regen per hour (awake, no buffs, no circadian). */
export const BASE_REGEN_RATES: Readonly<VigorDimension> = {
  pv: 2.0,
  mv: 1.5,
  sv: 1.0,
  cv: 0.5,
  spv: 0.3,
};

// ── Circadian multipliers ────────────────────────────────────

type CircadianPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

/** Circadian multiplier per dimension per period (default 1.0). */
const CIRCADIAN_MULTIPLIERS: Record<CircadianPeriod, Partial<Record<VigorKey, number>>> = {
  morning:   { pv: 1.5, mv: 1.5 },                    // 06-12
  afternoon: { sv: 1.5, cv: 1.5 },                     // 12-18
  evening:   { spv: 1.5, sv: 1.2 },                    // 18-24
  night:     { pv: 0.5, mv: 0.5, sv: 0.5, cv: 0.5, spv: 0.5 }, // 00-06 (awake)
};

/**
 * When sleeping at night, PV gets x2.0 instead of x0.5 (Bible §3.3).
 * MV x1.2 is a general sleep effect handled by getSleepMultiplier (Bible §3.7),
 * NOT a night-specific override — otherwise it would double-count.
 */
const NIGHT_SLEEP_OVERRIDES: Partial<Record<VigorKey, number>> = {
  pv: 2.0,
};

// ── Cascade matrix ───────────────────────────────────────────
//
// When dimension X drops below 20 ("critical"), it drains other dims.
// Matrix: cascadeMatrix[critical_dim][target_dim] = drain coefficient.
// Total drain to target = sum of (coefficient * CRITICAL_DRAIN_RATE)
// for each critical source, capped at CROSS_DRAIN_CAP_PER_DIM.
//
// Design rationale (Bible V2 §3.6):
// - Physical exhaustion (PV<20) primarily drains Mental
// - Mental fatigue (MV<20) broadly impacts Social, Spiritual, Physical, and Civic
// - Social depletion (SV<20) primarily drains Mental and Spiritual
// - Civic burnout (CV<20) primarily drains Mental
// - Spiritual drain (SpV<20) primarily drains Mental and Social

const CASCADE_MATRIX: Record<VigorKey, Partial<Record<VigorKey, number>>> = {
  pv:  { mv: 0.3, sv: 0.1, spv: 0.1 },           // CV: 0 (no cross-drain)
  mv:  { pv: 0.3, sv: 0.4, cv: 0.3, spv: 0.4 },
  sv:  { pv: 0.1, mv: 0.4, cv: 0.2, spv: 0.3 },
  cv:  { mv: 0.3, sv: 0.2, spv: 0.2 },            // PV: 0 (no cross-drain)
  spv: { pv: 0.1, mv: 0.4, sv: 0.3, cv: 0.2 },
};

// ── Meal types ───────────────────────────────────────────────

interface MealDefinition {
  perHourBonusByDim: Partial<VigorDimension>;
  durationHours: number;
  /** Some bonuses have shorter durations for specific dims. */
  perDimDurationOverrides?: Partial<Record<VigorKey, number>>;
  instantDelta?: Partial<VigorDimension>;
}

export const MEAL_DEFINITIONS: Record<MealQuality, MealDefinition> = {
  STREET_FOOD: {
    perHourBonusByDim: { pv: 2 },
    durationHours: 2,
  },
  HOME_COOKED: {
    perHourBonusByDim: { pv: 3, mv: 1 },
    durationHours: 4,
    perDimDurationOverrides: { mv: 2 },
  },
  RESTAURANT: {
    perHourBonusByDim: { pv: 4, mv: 2 },
    durationHours: 3,
  },
  FINE_DINING: {
    perHourBonusByDim: { pv: 5, mv: 3 },
    durationHours: 4,
    instantDelta: { sv: 2 },
  },
  NUTRIENT_OPTIMAL: {
    perHourBonusByDim: { pv: 6, mv: 4 },
    durationHours: 6,
  },
};

// ── Meal compliance penalty multipliers ──────────────────────

interface MealPenalty {
  regenMultipliers: Partial<Record<VigorKey, number>>;
  immediateDelta?: Partial<VigorDimension>;
}

/**
 * Penalty keyed by meals-eaten count. 3+ meals = no penalty.
 * Penalties last 24h (applied as regen multiplier until next daily reset).
 */
export const MEAL_PENALTY_TABLE: Record<number, MealPenalty> = {
  2: {
    regenMultipliers: { pv: 0.9, mv: 0.95 },
  },
  1: {
    regenMultipliers: { pv: 0.75, mv: 0.85, spv: 0.9 },
  },
  0: {
    regenMultipliers: { pv: 0.5, mv: 0.7, spv: 0.8 },
    immediateDelta: { pv: -10 },
  },
};

// ════════════════════════════════════════════════════════════════
// TYPES — Audit / Result
// ════════════════════════════════════════════════════════════════

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

/** Breakdown of a single hourly tick for UI display. */
export interface HourlyTickBreakdown {
  baseRegen: Record<VigorKey, number>;
  circadianMultiplier: Record<VigorKey, number>;
  sleepAdjustment: Record<VigorKey, number>;
  buffBonus: Record<VigorKey, number>;
  penaltyMultiplier: Record<VigorKey, number>;
  cascadeDrain: Record<VigorKey, number>;
  netDelta: Record<VigorKey, number>;
}

export interface HourlyTickResult {
  newState: VigorState;
  deltaBreakdown: HourlyTickBreakdown;
}

export interface DailyResetResult {
  newState: VigorState;
  penaltyApplied: MealPenalty | null;
  summary: string;
}

// ════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ════════════════════════════════════════════════════════════════

function getCap(key: VigorKey, caps?: VigorCaps): number {
  if (!caps) return DEFAULT_CAP;
  return caps[`${key}_cap` as keyof VigorCaps];
}

function clampDim(value: number, cap: number): number {
  return Math.max(MIN_VIGOR, Math.min(value, cap));
}

function getCircadianPeriod(localHour: number): CircadianPeriod {
  if (localHour >= 6 && localHour < 12) return 'morning';
  if (localHour >= 12 && localHour < 18) return 'afternoon';
  if (localHour >= 18 && localHour < 24) return 'evening';
  return 'night'; // 0-6
}

function getCircadianMultiplier(
  key: VigorKey,
  period: CircadianPeriod,
  sleepState: SleepState
): number {
  if (period === 'night' && sleepState === 'sleeping') {
    return NIGHT_SLEEP_OVERRIDES[key] ?? CIRCADIAN_MULTIPLIERS.night[key] ?? 1.0;
  }
  return CIRCADIAN_MULTIPLIERS[period]?.[key] ?? 1.0;
}

function getSleepMultiplier(key: VigorKey, sleepState: SleepState): number {
  // Sleep multiplier for MV (x1.2) applies any time the player is sleeping,
  // regardless of period. The night PV override is handled in circadian.
  if (sleepState === 'sleeping' && key === 'mv') return 1.2;
  return 1.0;
}

/** Compute total per-hour buff bonus for a dimension, capped at BUFF_CAP. */
function computeBuffBonus(
  key: VigorKey,
  activeBuffs: Buff[],
  now: string
): number {
  let total = 0;
  const nowMs = new Date(now).getTime();
  for (const buff of activeBuffs) {
    const startMs = new Date(buff.startsAt).getTime();
    const endMs = new Date(buff.endsAt).getTime();
    if (nowMs >= startMs && nowMs < endMs) {
      total += buff.perHourBonusByDim[key] ?? 0;
    }
  }
  return Math.min(total, BUFF_CAP_PER_DIM_PER_HOUR);
}

/** Get penalty regen multiplier for a dimension based on penalty level. */
function getPenaltyMultiplier(key: VigorKey, penaltyLevel: number): number {
  if (penaltyLevel <= 0) return 1.0;

  // Use meal-count 0 penalty as the base severe penalty, scaled by level up to 3
  // Level 1 = "2 meals" penalty, Level 2 = "1 meal" penalty, Level 3+ = "0 meals" (clamped)
  const clampedLevel = Math.min(penaltyLevel, MAX_PENALTY_LEVEL);
  const mealsEquivalent = Math.max(0, 3 - clampedLevel);
  const penalty = MEAL_PENALTY_TABLE[mealsEquivalent];
  if (!penalty) return 1.0;
  return penalty.regenMultipliers[key] ?? 1.0;
}

/** Compute cascade cross-drain for each dimension. */
function computeCascadeDrain(vigor: VigorDimension): Record<VigorKey, number> {
  const drain: Record<VigorKey, number> = { pv: 0, mv: 0, sv: 0, cv: 0, spv: 0 };

  for (const sourceKey of VIGOR_KEYS) {
    if (vigor[sourceKey] >= CASCADE_THRESHOLD) continue;
    // This source is critical — apply its drain to targets
    const drainRow = CASCADE_MATRIX[sourceKey];
    for (const targetKey of VIGOR_KEYS) {
      if (targetKey === sourceKey) continue;
      const coeff = drainRow[targetKey] ?? 0;
      drain[targetKey] += coeff * CRITICAL_DRAIN_RATE;
    }
  }

  // Cap per-dim drain
  for (const key of VIGOR_KEYS) {
    drain[key] = Math.min(drain[key], CROSS_DRAIN_CAP_PER_DIM);
  }

  return drain;
}

function makeZeroRecord(): Record<VigorKey, number> {
  return { pv: 0, mv: 0, sv: 0, cv: 0, spv: 0 };
}

function expireBuffs(buffs: Buff[], now: string): Buff[] {
  const nowMs = new Date(now).getTime();
  return buffs.filter((b) => new Date(b.endsAt).getTime() > nowMs);
}

// ════════════════════════════════════════════════════════════════
// BASIC VIGOR OPERATIONS (preserved from previous API)
// ════════════════════════════════════════════════════════════════

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
 * Apply hourly vigor regeneration (simple version for backwards compatibility).
 */
export function applyVigorRegen(
  current: VigorDimension,
  hours: number,
  caps?: VigorCaps
): VigorMutationResult {
  const regenDelta: Partial<VigorDimension> = {};
  for (const key of VIGOR_KEYS) {
    regenDelta[key] = BASE_REGEN_RATES[key] * hours;
  }
  return addVigor(current, regenDelta, caps);
}

/**
 * Deplete vigor for an action. Alias for subVigor.
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

// ════════════════════════════════════════════════════════════════
// BIBLE V2 — CORE FUNCTIONS
// ════════════════════════════════════════════════════════════════

/**
 * Apply a single hourly vigor tick.
 *
 * Steps:
 * 1. Calculate base regen per dim
 * 2. Apply circadian multiplier (with sleep overrides at night)
 * 3. Apply sleep multiplier (MV x1.2 while sleeping)
 * 4. Apply active buff bonuses (capped at +8/hr per dim)
 * 5. Apply meal penalty multipliers (with 3-day severity clamp)
 * 6. Apply cascade cross-drain for dims < 20 (capped at 3.0/hr per dim)
 * 7. Clamp vigor to [0..cap]
 * 8. Expire ended buffs
 * 9. Return new state + breakdown
 */
export function applyHourlyVigorTick(
  state: VigorState,
  now: Date | string,
  timezone: string = 'Asia/Dubai'
): HourlyTickResult {
  const nowIso = now instanceof Date ? now.toISOString() : now;
  const dt = DateTime.fromISO(
    now instanceof Date ? now.toISOString() : now,
    { zone: timezone }
  );
  const localHour = dt.hour;
  const period = getCircadianPeriod(localHour);

  // Step 1: Base regen
  const baseRegen = { ...BASE_REGEN_RATES };

  // Step 2: Circadian multipliers
  const circadianMult = makeZeroRecord();
  for (const key of VIGOR_KEYS) {
    circadianMult[key] = getCircadianMultiplier(key, period, state.sleepState);
  }

  // Step 3: Sleep multipliers (MV x1.2)
  const sleepAdj = makeZeroRecord();
  for (const key of VIGOR_KEYS) {
    sleepAdj[key] = getSleepMultiplier(key, state.sleepState);
  }

  // Step 4: Buff bonuses (capped at +8/hr per dim)
  const buffBonus = makeZeroRecord();
  for (const key of VIGOR_KEYS) {
    buffBonus[key] = computeBuffBonus(key, state.activeBuffs, nowIso);
  }

  // Step 5: Penalty multipliers
  const penaltyMult = makeZeroRecord();
  for (const key of VIGOR_KEYS) {
    penaltyMult[key] = getPenaltyMultiplier(key, state.mealPenaltyLevel);
  }

  // Step 6: Cascade drain
  const cascadeDrain = computeCascadeDrain(state.vigor);

  // Compute net delta per dimension
  const netDelta = makeZeroRecord();
  const newVigorRaw: Record<string, number> = {};

  // SpV global regen penalty: max −10 %
  const spvRegenMult = calculateSpvRegenMultiplier(state.vigor.spv);

  for (const key of VIGOR_KEYS) {
    const base = baseRegen[key];
    const circadian = circadianMult[key];
    const sleep = sleepAdj[key];
    const penalty = penaltyMult[key];
    const buff = buffBonus[key];
    const drain = cascadeDrain[key];

    // Regen = base * circadian * sleep * penalty * spvGlobal + buff - drain
    const regen = base * circadian * sleep * penalty * spvRegenMult;
    const total = regen + buff - drain;
    netDelta[key] = total;

    const cap = getCap(key, state.caps);
    newVigorRaw[key] = clampDim(state.vigor[key] + total, cap);
  }

  const newVigor = newVigorRaw as unknown as VigorDimension;

  // Step 8: Expire buffs
  const remainingBuffs = expireBuffs(state.activeBuffs, nowIso);

  const newState: VigorState = {
    ...state,
    vigor: newVigor,
    activeBuffs: remainingBuffs,
  };

  const breakdown: HourlyTickBreakdown = {
    baseRegen: { ...BASE_REGEN_RATES },
    circadianMultiplier: circadianMult,
    sleepAdjustment: sleepAdj,
    buffBonus,
    penaltyMultiplier: penaltyMult,
    cascadeDrain,
    netDelta,
  };

  return { newState, deltaBreakdown: breakdown };
}

/**
 * Apply daily reset at local midnight.
 *
 * 1. Count meals eaten today
 * 2. Determine penalty level (clamp at 3)
 * 3. Apply immediate penalty effects (e.g. PV -10 for 0 meals)
 * 4. Update mealPenaltyLevel for next 24h regen multiplier
 * 5. Reset daily counters
 */
export function applyDailyReset(
  state: VigorState,
  nowLocalMidnight: Date | string
): DailyResetResult {
  const nowIso =
    nowLocalMidnight instanceof Date
      ? nowLocalMidnight.toISOString()
      : nowLocalMidnight;
  const localDate = getLocalDate(nowIso);

  const mealsToday = state.mealsEatenToday;

  // Determine new penalty level
  let newPenaltyLevel: number;
  if (mealsToday >= 3) {
    // Good compliance — reduce penalty toward 0
    newPenaltyLevel = Math.max(0, state.mealPenaltyLevel - 1);
  } else if (mealsToday === 2) {
    // Mild penalty
    newPenaltyLevel = Math.min(state.mealPenaltyLevel + 1, MAX_PENALTY_LEVEL);
  } else if (mealsToday === 1) {
    // Moderate penalty
    newPenaltyLevel = Math.min(state.mealPenaltyLevel + 1, MAX_PENALTY_LEVEL);
  } else {
    // 0 meals — severe penalty
    newPenaltyLevel = Math.min(state.mealPenaltyLevel + 1, MAX_PENALTY_LEVEL);
  }

  // Apply penalty lookup
  const penaltyKey = mealsToday >= 3 ? null : mealsToday;
  const penalty = penaltyKey !== null ? MEAL_PENALTY_TABLE[penaltyKey] ?? null : null;

  // Apply immediate effects
  let newVigor = { ...state.vigor };
  const summaryParts: string[] = [];

  if (penalty?.immediateDelta) {
    const result = addVigor(newVigor, penalty.immediateDelta, state.caps);
    newVigor = result.vigor;
    summaryParts.push(
      `Immediate penalty: ${Object.entries(penalty.immediateDelta)
        .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`)
        .join(', ')}`
    );
  }

  if (penalty) {
    const penaltyDesc = Object.entries(penalty.regenMultipliers)
      .map(([k, v]) => `${k} x${v}`)
      .join(', ');
    summaryParts.push(`Regen penalty for 24h: ${penaltyDesc}`);
  }

  if (mealsToday >= 3 && state.mealPenaltyLevel > 0) {
    summaryParts.push(`Good meal compliance — penalty level reduced to ${newPenaltyLevel}`);
  }

  if (summaryParts.length === 0) {
    summaryParts.push('No meal penalty — sufficient meals eaten.');
  }

  const newState: VigorState = {
    ...state,
    vigor: newVigor,
    mealPenaltyLevel: newPenaltyLevel,
    mealsEatenToday: 0,
    lastMealTimes: [],
    lastDailyResetLocalDate: localDate,
  };

  return {
    newState,
    penaltyApplied: penalty,
    summary: summaryParts.join(' '),
  };
}

// ════════════════════════════════════════════════════════════════
// BUFF CREATORS
// ════════════════════════════════════════════════════════════════

let buffIdCounter = 0;
function nextBuffId(): string {
  buffIdCounter += 1;
  return `buff_${Date.now()}_${buffIdCounter}`;
}

/**
 * Create a meal buff. Different meal qualities produce different
 * per-hour bonuses and durations.
 *
 * For meals with per-dim duration overrides (e.g. Home Cooked: MV 2h, PV 4h),
 * we create separate buffs so they expire independently.
 */
export function createMealBuff(mealQuality: MealQuality, now: Date | string): Buff[] {
  const def = MEAL_DEFINITIONS[mealQuality];
  const nowIso = now instanceof Date ? now.toISOString() : now;
  const startMs = new Date(nowIso).getTime();
  const buffs: Buff[] = [];

  if (def.perDimDurationOverrides) {
    // Split into separate buffs per dimension group
    const defaultDims: Partial<VigorDimension> = {};
    const overriddenDims = new Set(Object.keys(def.perDimDurationOverrides));

    for (const [k, v] of Object.entries(def.perHourBonusByDim)) {
      if (!overriddenDims.has(k)) {
        defaultDims[k as VigorKey] = v;
      }
    }

    // Default duration buff
    if (Object.keys(defaultDims).length > 0) {
      buffs.push({
        id: nextBuffId(),
        source: 'MEAL',
        startsAt: nowIso,
        endsAt: new Date(startMs + def.durationHours * 60 * 60 * 1000).toISOString(),
        perHourBonusByDim: defaultDims,
        instantDeltaByDim: def.instantDelta,
        metadata: { mealQuality },
      });
    }

    // Override duration buffs
    for (const [dimKey, hours] of Object.entries(def.perDimDurationOverrides)) {
      const bonusValue = def.perHourBonusByDim[dimKey as VigorKey];
      if (bonusValue === undefined) continue;
      buffs.push({
        id: nextBuffId(),
        source: 'MEAL',
        startsAt: nowIso,
        endsAt: new Date(startMs + hours * 60 * 60 * 1000).toISOString(),
        perHourBonusByDim: { [dimKey]: bonusValue },
        metadata: { mealQuality, overrideDim: dimKey },
      });
    }

    // If no default-duration dims but instant delta exists, attach to first buff
    if (Object.keys(defaultDims).length === 0 && def.instantDelta && buffs.length > 0) {
      buffs[0].instantDeltaByDim = def.instantDelta;
    }
  } else {
    // Single buff for all dims
    buffs.push({
      id: nextBuffId(),
      source: 'MEAL',
      startsAt: nowIso,
      endsAt: new Date(startMs + def.durationHours * 60 * 60 * 1000).toISOString(),
      perHourBonusByDim: def.perHourBonusByDim,
      instantDeltaByDim: def.instantDelta,
      metadata: { mealQuality },
    });
  }

  return buffs;
}

/**
 * Create a leisure buff: MV +1/hr, SpV +0.5/hr for 3 hours.
 * Also returns an instant delta: MV +4, SpV +2.
 */
export function createLeisureBuff(now: Date | string): {
  buff: Buff;
  instantDelta: Partial<VigorDimension>;
} {
  const nowIso = now instanceof Date ? now.toISOString() : now;
  const startMs = new Date(nowIso).getTime();
  const durationHours = 3;

  const buff: Buff = {
    id: nextBuffId(),
    source: 'LEISURE',
    startsAt: nowIso,
    endsAt: new Date(startMs + durationHours * 60 * 60 * 1000).toISOString(),
    perHourBonusByDim: { mv: 1, spv: 0.5 },
  };

  const instantDelta: Partial<VigorDimension> = { mv: 4, spv: 2 };

  return { buff, instantDelta };
}

/**
 * Social call instant delta: SV +3, MV +1.
 * No ongoing buff — just a one-time boost.
 */
export function createSocialCallInstantDelta(): Partial<VigorDimension> {
  return { sv: 3, mv: 1 };
}

// ════════════════════════════════════════════════════════════════
// HARD LOCKOUT VALIDATION
// ════════════════════════════════════════════════════════════════

/**
 * Even at 0 vigor, a player can always:
 * - SLEEP
 * - EAT (if they have money)
 * - Work a low-intensity job (with reduced performance)
 *
 * This function validates that a given action type is permitted
 * regardless of vigor state. Returns true if the action is allowed
 * even when vigor is depleted.
 */
export function validateNoHardLockouts(
  vigor: VigorDimension,
  actionType: string
): { allowed: boolean; reason?: string } {
  const ALWAYS_ALLOWED = ['SLEEP', 'EAT_MEAL'];
  const LOW_INTENSITY_JOBS = ['WORK_SHIFT']; // Work is allowed but efficiency drops

  if (ALWAYS_ALLOWED.includes(actionType)) {
    return { allowed: true };
  }

  if (LOW_INTENSITY_JOBS.includes(actionType)) {
    const efficiency = calculateEfficiency(vigor);
    return {
      allowed: true,
      reason: efficiency < 1.0
        ? `Reduced performance: ${Math.round(efficiency * 100)}% efficiency`
        : undefined,
    };
  }

  // For other actions, check if any dim is at 0
  const hasZeroDim = VIGOR_KEYS.some((k) => vigor[k] <= 0);
  if (hasZeroDim) {
    return {
      allowed: false,
      reason: 'One or more vigor dimensions depleted. Rest, eat, or sleep first.',
    };
  }

  return { allowed: true };
}

// ════════════════════════════════════════════════════════════════
// EXPORTED CONSTANTS (for testing / UI)
// ════════════════════════════════════════════════════════════════

export {
  CASCADE_THRESHOLD,
  CRITICAL_DRAIN_RATE,
  CROSS_DRAIN_CAP_PER_DIM,
  BUFF_CAP_PER_DIM_PER_HOUR,
  MAX_PENALTY_LEVEL,
  CASCADE_MATRIX,
  CIRCADIAN_MULTIPLIERS,
  NIGHT_SLEEP_OVERRIDES,
};

/** @deprecated Use BASE_REGEN_RATES instead. Kept for backward compat with existing tests. */
export const HOURLY_REGEN_RATE = 5;

// ════════════════════════════════════════════════════════════════
// ACTION OUTCOME PROJECTIONS (for UX preview)
// ════════════════════════════════════════════════════════════════

export interface ActionProjection {
  vigorDelta: Partial<VigorDimension>;
  vigorAfter: VigorDimension;
  moneyCostCents: number;
  moneyGainCents: number;
  durationSeconds: number;
  completionTime: string; // ISO timestamp
  warnings: string[];
}

/**
 * Project the outcome of an action before the player commits.
 * Pure function — no DB access. Uses current vigor + known action costs.
 */
export function projectActionOutcome(opts: {
  currentVigor: VigorDimension;
  caps: VigorCaps;
  vigorCost: Partial<VigorDimension>;
  vigorGain: Partial<VigorDimension>;
  moneyCostCents: number;
  moneyGainCents: number;
  durationSeconds: number;
  currentBalanceCents: number;
  queueEndTime: Date;
}): ActionProjection {
  const warnings: string[] = [];

  // Calculate vigor after cost + gain
  const delta: Partial<VigorDimension> = {};
  const after: Record<string, number> = {};

  for (const key of VIGOR_KEYS) {
    const cost = opts.vigorCost[key] ?? 0;
    const gain = opts.vigorGain[key] ?? 0;
    const net = gain - cost;
    if (net !== 0) delta[key as VigorKey] = net;

    const cap = getCap(key, opts.caps);
    after[key] = clampDim(opts.currentVigor[key] + net, cap);

    // Warn if dimension will drop below cascade threshold
    if (after[key] < CASCADE_THRESHOLD && opts.currentVigor[key] >= CASCADE_THRESHOLD) {
      warnings.push(`${key.toUpperCase()} will drop below ${CASCADE_THRESHOLD} — cascade drain risk`);
    }
    // Warn if dimension will hit zero
    if (after[key] <= 0 && opts.currentVigor[key] > 0) {
      warnings.push(`${key.toUpperCase()} will reach 0 — exhaustion risk`);
    }
  }

  // Warn if insufficient funds
  if (opts.moneyCostCents > 0 && opts.currentBalanceCents < opts.moneyCostCents) {
    warnings.push(
      `Insufficient funds: need ₿${(opts.moneyCostCents / 100).toFixed(2)}, ` +
      `have ₿${(opts.currentBalanceCents / 100).toFixed(2)}`
    );
  }

  // Calculate completion time
  const startTime = new Date(Math.max(opts.queueEndTime.getTime(), Date.now()));
  const completionTime = new Date(startTime.getTime() + opts.durationSeconds * 1000);

  return {
    vigorDelta: delta,
    vigorAfter: after as unknown as VigorDimension,
    moneyCostCents: opts.moneyCostCents,
    moneyGainCents: opts.moneyGainCents,
    durationSeconds: opts.durationSeconds,
    completionTime: completionTime.toISOString(),
    warnings,
  };
}

// ════════════════════════════════════════════════════════════════
// REGEN BREAKDOWN — Read-only computation for UI display
// ════════════════════════════════════════════════════════════════

/** Per-dimension regen breakdown detail for UI display. */
export interface DimBreakdown {
  baseRate: number;
  housingBonus: number;
  circadianMultiplier: number;
  circadianPeriod: string;
  sleepMultiplier: number;
  penaltyMultiplier: number;
  spvRegenMultiplier: number;
  buffBonus: number;
  cascadeDrain: number;
  netPerHour: number;
}

/** Full regen breakdown across all vigor dimensions. */
export interface RegenBreakdown {
  perDim: Record<VigorKey, DimBreakdown>;
  activeBuffDetails: Array<{
    id: string;
    source: string;
    remainingMs: number;
    perHourBonusByDim: Partial<VigorDimension>;
  }>;
  criticalDims: VigorKey[];
  localHour: number;
}

/**
 * Compute the current regen breakdown for all vigor dimensions.
 *
 * Pure function — no mutation. Uses the SAME internal helpers as
 * `applyHourlyVigorTick()` to ensure zero math duplication.
 *
 * The net rate formula:
 *   net = (base * circadian * sleep * penalty * spvRegen) + housing + buff - drain
 *
 * Housing bonus is additive (not in the multiplicative chain) because the
 * hourly tick does not pipe it through circadian/sleep/penalty modifiers.
 */
export function computeRegenBreakdown(
  vigor: VigorDimension,
  sleepState: SleepState,
  activeBuffs: Buff[],
  mealPenaltyLevel: number,
  housingTier: number,
  nowIso: string,
  timezone: string,
): RegenBreakdown {
  const dt = DateTime.fromISO(nowIso, { zone: timezone });
  const localHour = dt.hour;
  const period = getCircadianPeriod(localHour);

  const housingBonuses = getHousingRegenBonuses(housingTier);
  const spvRegenMult = calculateSpvRegenMultiplier(vigor.spv);
  const cascadeDrain = computeCascadeDrain(vigor);

  const perDim = {} as Record<VigorKey, DimBreakdown>;
  for (const key of VIGOR_KEYS) {
    const base = BASE_REGEN_RATES[key];
    const housing = housingBonuses[key] ?? 0;
    const circadian = getCircadianMultiplier(key, period, sleepState);
    const sleep = getSleepMultiplier(key, sleepState);
    const penalty = getPenaltyMultiplier(key, mealPenaltyLevel);
    const buff = computeBuffBonus(key, activeBuffs, nowIso);
    const drain = cascadeDrain[key];

    const regen = base * circadian * sleep * penalty * spvRegenMult;
    const net = regen + housing + buff - drain;

    perDim[key] = {
      baseRate: base,
      housingBonus: housing,
      circadianMultiplier: circadian,
      circadianPeriod: period,
      sleepMultiplier: sleep,
      penaltyMultiplier: penalty,
      spvRegenMultiplier: spvRegenMult,
      buffBonus: buff,
      cascadeDrain: drain,
      netPerHour: net,
    };
  }

  // Active buff details with remaining time
  const nowMs = new Date(nowIso).getTime();
  const activeBuffDetails = activeBuffs
    .filter((b) => {
      const startMs = new Date(b.startsAt).getTime();
      const endMs = new Date(b.endsAt).getTime();
      return nowMs >= startMs && nowMs < endMs;
    })
    .map((b) => ({
      id: b.id,
      source: b.source,
      remainingMs: new Date(b.endsAt).getTime() - nowMs,
      perHourBonusByDim: b.perHourBonusByDim,
    }));

  // Dimensions below cascade threshold
  const criticalDims = VIGOR_KEYS.filter((k) => vigor[k] < CASCADE_THRESHOLD);

  return { perDim, activeBuffDetails, criticalDims, localHour };
}
