import type { VigorDimension, GoodCode } from './types';
import { ValidationError } from './errors';

/**
 * Economy System — Blueth City MVP
 *
 * All money values are INTEGER CENTS (1 BCE = 100 cents).
 * Functions that return money always use Math.floor() to stay in integers.
 *
 * Systems:
 *   Skills       — 5 skills, XP-based growth, 0.1-2.0 soft cap
 *   Jobs         — 4 families with vigor-weighted performance
 *   Bills        — Housing tiers with regen bonuses, utilities, failure-resistant rent
 *   Goods        — District pricing modifiers
 *   Ledger       — Double-entry types and integration hooks
 */

// ════════════════════════════════════════════════════════════════
// A) SKILLS
// ════════════════════════════════════════════════════════════════

export const SKILL_NAMES = ['labor', 'admin', 'service', 'management', 'trading'] as const;
export type SkillName = (typeof SKILL_NAMES)[number];

export type SkillSet = Record<SkillName, number>;

const SKILL_MIN = 0.1;
const SKILL_SOFT_CAP = 2.0;

/**
 * XP gain rate. Skill increase per call uses diminishing returns:
 *   delta = baseRate * intensity * (minutes / 60) * (1 - currentSkill / softCap)
 *
 * This gives fast early growth that slows as you approach the cap.
 * baseRate is tuned so a full 8h shift at intensity 1.0 from skill 0.1
 * yields roughly +0.08 per day (about 25 days from 0.1 to ~2.0 at max).
 */
const SKILL_BASE_RATE = 0.015;

/**
 * Add skill XP from use (e.g. completing a work shift).
 *
 * @param current - current skill value (0.1 to 2.0)
 * @param minutes - minutes of use
 * @param intensity - 0.0 to 1.0, how intensively the skill was used
 * @returns new skill value, clamped to [SKILL_MIN, SKILL_SOFT_CAP]
 */
export function addSkillXP(current: number, minutes: number, intensity: number): number {
  if (current < SKILL_MIN) current = SKILL_MIN;
  if (intensity < 0) intensity = 0;
  if (intensity > 1) intensity = 1;
  if (minutes <= 0) return current;

  const headroom = 1 - current / SKILL_SOFT_CAP;
  const delta = SKILL_BASE_RATE * intensity * (minutes / 60) * Math.max(headroom, 0);
  const result = current + delta;
  return Math.min(SKILL_SOFT_CAP, Math.max(SKILL_MIN, result));
}

/** Create a default fresh skill set for a new player. */
export function defaultSkillSet(): SkillSet {
  return { labor: 0.1, admin: 0.1, service: 0.1, management: 0.1, trading: 0.1 };
}

// ════════════════════════════════════════════════════════════════
// B) JOBS
// ════════════════════════════════════════════════════════════════

export const JOB_FAMILIES = ['physical', 'admin', 'service', 'management'] as const;
export type JobFamily = (typeof JOB_FAMILIES)[number];

export const SHIFT_DURATIONS = ['short', 'full'] as const;
export type ShiftDuration = (typeof SHIFT_DURATIONS)[number];

/** Vigor weights for the performance formula. */
interface VigorWeights {
  wPV: number;
  wMV: number;
}

/** Per-family configuration. */
interface JobFamilyConfig {
  vigorWeights: VigorWeights;
  primarySkill: SkillName;
  /** If true, the service formula variant is used (adds SV factor). */
  useSVFactor: boolean;
}

const JOB_FAMILY_CONFIGS: Record<JobFamily, JobFamilyConfig> = {
  physical: {
    vigorWeights: { wPV: 1.0, wMV: 0.3 },
    primarySkill: 'labor',
    useSVFactor: false,
  },
  admin: {
    vigorWeights: { wPV: 0.2, wMV: 1.0 },
    primarySkill: 'admin',
    useSVFactor: false,
  },
  service: {
    vigorWeights: { wPV: 0.2, wMV: 0.4 },
    primarySkill: 'service',
    useSVFactor: true,
  },
  management: {
    vigorWeights: { wPV: 0.3, wMV: 0.9 },
    primarySkill: 'management',
    useSVFactor: false,
  },
};

/**
 * Work shift vigor costs by job family and duration.
 *
 * Short shift = 2 hours, Full shift = 8 hours.
 * Applied on shift completion (not start).
 */
export const SHIFT_VIGOR_COSTS: Record<JobFamily, Record<ShiftDuration, Partial<VigorDimension>>> = {
  physical: {
    short: { pv: 10, mv: 3 },
    full: { pv: 25, mv: 8 },
  },
  admin: {
    short: { mv: 10, cv: 2 },
    full: { mv: 25, cv: 6 },
  },
  service: {
    short: { sv: 8, mv: 4 },
    full: { sv: 18, mv: 10 },
  },
  management: {
    short: { mv: 12, sv: 3, spv: 2 },
    full: { mv: 28, sv: 8, spv: 5 },
  },
};

/** Shift duration in hours. */
export const SHIFT_HOURS: Record<ShiftDuration, number> = {
  short: 2,
  full: 8,
};

/** Skill XP minutes granted per shift duration. */
const SHIFT_XP_MINUTES: Record<ShiftDuration, number> = {
  short: 120,
  full: 480,
};

/**
 * Calculate job performance multiplier.
 *
 * Formula:
 *   Performance = Skill
 *     * (PV/100)^wPV
 *     * (MV/100)^wMV
 *     * clamp(Satisfaction, 0.5, 1.3)
 *     * clamp(EquipmentQuality, 0.5, 1.5)
 *
 * For Service jobs, also multiply by (0.7 + SV/300).
 *
 * @param family - job family
 * @param skill - current skill level for the family's primary skill
 * @param vigor - current vigor dimension values
 * @param satisfaction - player satisfaction factor (default 1.0)
 * @param equipmentQuality - equipment quality factor (default 1.0)
 * @returns raw performance multiplier (not clamped — caller uses clampedPay)
 */
export function calculatePerformance(
  family: JobFamily,
  skill: number,
  vigor: VigorDimension,
  satisfaction: number = 1.0,
  equipmentQuality: number = 1.0,
): number {
  const config = JOB_FAMILY_CONFIGS[family];
  const { wPV, wMV } = config.vigorWeights;

  const pvFactor = Math.pow(vigor.pv / 100, wPV);
  const mvFactor = Math.pow(vigor.mv / 100, wMV);
  const satClamped = Math.max(0.5, Math.min(1.3, satisfaction));
  const eqClamped = Math.max(0.5, Math.min(1.5, equipmentQuality));

  let perf = skill * pvFactor * mvFactor * satClamped * eqClamped;

  if (config.useSVFactor) {
    perf *= (0.7 + vigor.sv / 300);
  }

  return perf;
}

/**
 * Calculate daily pay from base wage and performance.
 *
 * DailyPay = BaseWage * clamp(Performance, 0.4, 1.5)
 *
 * Returns integer cents.
 */
export function calculateDailyPay(baseWageCents: number, performance: number): number {
  const clamped = Math.max(0.4, Math.min(1.5, performance));
  return Math.floor(baseWageCents * clamped);
}

/**
 * Calculate shift pay (proportional to shift duration vs full day).
 * Returns integer cents.
 */
export function calculateShiftPay(
  baseWageCents: number,
  performance: number,
  shiftDuration: ShiftDuration,
): number {
  const dailyPay = calculateDailyPay(baseWageCents, performance);
  const fraction = SHIFT_HOURS[shiftDuration] / 8;
  return Math.floor(dailyPay * fraction);
}

/**
 * Get vigor cost for completing a work shift.
 */
export function getShiftVigorCost(family: JobFamily, duration: ShiftDuration): Partial<VigorDimension> {
  return { ...SHIFT_VIGOR_COSTS[family][duration] };
}

/**
 * Get skill XP from completing a shift.
 * Returns the new skill value and which skill was trained.
 */
export function applyShiftSkillXP(
  family: JobFamily,
  currentSkill: number,
  duration: ShiftDuration,
  intensity: number = 1.0,
): { skill: SkillName; newValue: number } {
  const config = JOB_FAMILY_CONFIGS[family];
  return {
    skill: config.primarySkill,
    newValue: addSkillXP(currentSkill, SHIFT_XP_MINUTES[duration], intensity),
  };
}

// ════════════════════════════════════════════════════════════════
// B2) JOB CATALOG (backwards-compatible plus extended)
// ════════════════════════════════════════════════════════════════

export interface JobDefinition {
  id: string;
  name: string;
  description: string;
  family: JobFamily;
  baseWageDaily: number; // cents per full day (8h)
}

export const JOBS_CATALOG: JobDefinition[] = [
  {
    id: 'factory_worker',
    name: 'Factory Worker',
    description: 'Manual labor in the factory',
    family: 'physical',
    baseWageDaily: 12000, // ₿120.00/day
  },
  {
    id: 'office_clerk',
    name: 'Office Clerk',
    description: 'Administrative tasks',
    family: 'admin',
    baseWageDaily: 14400, // ₿144.00/day
  },
  {
    id: 'retail_worker',
    name: 'Retail Worker',
    description: 'Customer-facing service role',
    family: 'service',
    baseWageDaily: 11000, // ₿110.00/day
  },
  {
    id: 'shift_manager',
    name: 'Shift Manager',
    description: 'Oversee operations and coordinate staff',
    family: 'management',
    baseWageDaily: 18000, // ₿180.00/day
  },
];

// ════════════════════════════════════════════════════════════════
// C) BILLS — Housing & Utilities
// ════════════════════════════════════════════════════════════════

export interface HousingTier {
  tier: number;
  name: string;
  dailyRentCents: number;
  regenBonuses: Partial<VigorDimension>; // per-hour regen bonus
}

/**
 * Housing tier table — exactly per spec.
 *
 * Tier 0: Shelter (free, no bonuses)
 * Tier 1: Cheap Room (₿10/day, PV +0.2/hr)
 * Tier 2: Studio (₿20/day, PV +0.5/hr)
 * Tier 3: 1BR (₿35/day, PV +0.8/hr, MV +0.2/hr)
 * Tier 4: Comfortable (₿60/day, PV +1.2/hr, MV +0.4/hr, SV +0.2/hr)
 */
export const HOUSING_TIERS: HousingTier[] = [
  { tier: 0, name: 'Shelter',     dailyRentCents: 0,    regenBonuses: {} },
  { tier: 1, name: 'Cheap Room',  dailyRentCents: 1000, regenBonuses: { pv: 0.2 } },
  { tier: 2, name: 'Studio',      dailyRentCents: 2000, regenBonuses: { pv: 0.5 } },
  { tier: 3, name: '1BR',         dailyRentCents: 3500, regenBonuses: { pv: 0.8, mv: 0.2 } },
  { tier: 4, name: 'Comfortable', dailyRentCents: 6000, regenBonuses: { pv: 1.2, mv: 0.4, sv: 0.2 } },
];

/**
 * Utilities cost per housing tier per day (small daily sink).
 *
 * Shelter: 0 (no utilities)
 * Cheap Room: ₿2/day (water/power basics)
 * Studio: ₿5/day
 * 1BR: ₿8/day
 * Comfortable: ₿12/day
 */
export const UTILITIES_DAILY_COST: Record<number, number> = {
  0: 0,
  1: 200,   // ₿2.00
  2: 500,   // ₿5.00
  3: 800,   // ₿8.00
  4: 1200,  // ₿12.00
};

export function getHousingTier(tier: number): HousingTier {
  if (tier < 0 || tier >= HOUSING_TIERS.length) {
    return HOUSING_TIERS[0]; // default to shelter
  }
  return HOUSING_TIERS[tier];
}

export function getHousingRegenBonuses(tier: number): Partial<VigorDimension> {
  return { ...getHousingTier(tier).regenBonuses };
}

export function getDailyRent(tier: number): number {
  return getHousingTier(tier).dailyRentCents;
}

export function getDailyUtilities(tier: number): number {
  return UTILITIES_DAILY_COST[tier] ?? 0;
}

/** Total daily housing cost (rent + utilities). */
export function getDailyHousingCost(tier: number): number {
  return getDailyRent(tier) + getDailyUtilities(tier);
}

/**
 * Failure-resistant rent processing at daily tick.
 *
 * Approach: Auto-downgrade + discomfort penalty.
 *
 * If the player cannot afford rent+utilities:
 *   1. Do NOT make wallet negative.
 *   2. Auto-downgrade housing by 1 tier (or to Shelter at tier 0).
 *   3. Apply a small temporary discomfort penalty:
 *      - PV -3 (immediate, bounded, recoverable within 1-2 hours of regen)
 *      - SV -2 (discomfort from forced downgrade)
 *   4. Charge the new (lower) tier's rent if affordable; if still not, downgrade again.
 *   5. If player is at Shelter (tier 0, free), no charge needed.
 *
 * The player is never locked out. The penalty is small and recoverable.
 * The wallet never goes negative. Housing simply adjusts to what's affordable.
 *
 * @param currentTier - current housing tier
 * @param walletCents - player's available balance (integer cents)
 * @returns result with deductions, new tier, and penalty
 */
export interface RentProcessingResult {
  newTier: number;
  amountChargedCents: number;
  wasDowngraded: boolean;
  discomfortPenalty: Partial<VigorDimension> | null;
  summary: string;
}

export function processRent(currentTier: number, walletCents: number): RentProcessingResult {
  let tier = currentTier;
  let wasDowngraded = false;

  // Try to find an affordable tier, downgrading as needed
  while (tier > 0) {
    const cost = getDailyHousingCost(tier);
    if (walletCents >= cost) {
      break; // can afford this tier
    }
    tier--;
    wasDowngraded = true;
  }

  const cost = getDailyHousingCost(tier);
  const canAfford = walletCents >= cost;

  // At tier 0 = free, always affordable
  const amountCharged = canAfford ? cost : 0;

  const discomfortPenalty: Partial<VigorDimension> | null = wasDowngraded
    ? { pv: -3, sv: -2 }
    : null;

  const summaryParts: string[] = [];
  if (wasDowngraded) {
    summaryParts.push(
      `Housing downgraded from tier ${currentTier} to tier ${tier} (insufficient funds).`
    );
    summaryParts.push('Discomfort penalty applied: PV -3, SV -2.');
  }
  if (amountCharged > 0) {
    summaryParts.push(
      `Charged ₿${(amountCharged / 100).toFixed(2)} for ${HOUSING_TIERS[tier]?.name ?? 'Shelter'}.`
    );
  } else if (tier === 0) {
    summaryParts.push('Living in Shelter — no rent charged.');
  }

  return {
    newTier: tier,
    amountChargedCents: amountCharged,
    wasDowngraded,
    discomfortPenalty,
    summary: summaryParts.join(' '),
  };
}

// ════════════════════════════════════════════════════════════════
// D) GOODS & DISTRICT PRICING
// ════════════════════════════════════════════════════════════════

/**
 * Base prices for goods in integer cents. Per DB seed.
 */
export const GOOD_BASE_PRICES: Record<GoodCode, number> = {
  RAW_FOOD: 200,
  PROCESSED_FOOD: 500,
  FRESH_WATER: 100,
  ENERGY: 300,
  MATERIALS: 800,
  BUILDING_MATERIALS: 1500,
  INDUSTRIAL_MACHINERY: 50000,
  ENTERTAINMENT: 1000,
  WASTE: 10,
};

/**
 * District pricing modifiers — per seed data.
 */
export const DISTRICT_MODIFIERS: Record<string, number> = {
  CBD: 1.50,
  OLD_TOWN: 1.20,
  MARINA: 1.40,
  TECH_PARK: 1.30,
  MARKET_SQ: 1.00,
  INDUSTRIAL: 0.80,
  HARBOR: 0.90,
  UNIVERSITY: 1.10,
  SUBURBS_N: 0.85,
  SUBURBS_S: 0.85,
  ENTERTAINMENT: 1.25,
  OUTSKIRTS: 0.70,
};

/**
 * Calculate NPC market price from supply/demand ratio.
 * Clamps multiplier to [0.5, 2.0] range around base price.
 * Returns integer cents.
 */
export function calculateMarketPrice(
  basePrice: number,
  supply: number,
  demand: number,
): number {
  if (supply === 0) return basePrice * 2;
  if (demand === 0) return Math.floor(basePrice * 0.5);

  const ratio = demand / supply;
  const multiplier = Math.max(0.5, Math.min(2.0, ratio));
  return Math.floor(basePrice * multiplier);
}

/**
 * Apply a district pricing modifier to a base price.
 * Returns integer cents.
 *
 * finalPrice = floor(basePrice * districtModifier)
 */
export function applyDistrictModifier(
  basePriceCents: number,
  districtCode: string,
): number {
  const modifier = DISTRICT_MODIFIERS[districtCode] ?? 1.0;
  return Math.floor(basePriceCents * modifier);
}

/**
 * Calculate final good price with market + district modifiers.
 * Returns integer cents.
 */
export function calculateFinalGoodPrice(
  goodCode: GoodCode,
  supply: number,
  demand: number,
  districtCode: string,
): number {
  const basePrice = GOOD_BASE_PRICES[goodCode];
  const marketPrice = calculateMarketPrice(basePrice, supply, demand);
  return applyDistrictModifier(marketPrice, districtCode);
}

/**
 * Calculate job payout with efficiency multiplier (from vigor cascade).
 * Returns integer cents.
 *
 * @deprecated Use calculateShiftPay for the full performance-based formula.
 */
export function calculateJobPayout(
  jobPayPerHour: number,
  hoursWorked: number,
  efficiency: number,
): number {
  return Math.floor(jobPayPerHour * hoursWorked * efficiency);
}

// ════════════════════════════════════════════════════════════════
// E) LEDGER TYPES & INTEGRATION HOOKS
// ════════════════════════════════════════════════════════════════

/**
 * Ledger entry type constants.
 * Every money movement references one of these.
 */
export const LEDGER_ENTRY_TYPES = {
  JOB_PAY: 'job_pay',
  PURCHASE: 'purchase',
  SALE: 'sale',
  RENT: 'rent',
  UTILITIES: 'utilities',
  TAX: 'tax',
  FEE: 'fee',
  INITIAL_GRANT: 'initial_grant',
  MARKET_TRADE: 'market_trade',
  NPC_SUBSIDY: 'npc_subsidy',
} as const;

export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[keyof typeof LEDGER_ENTRY_TYPES];

/**
 * A ledger entry represents a single money movement.
 * from_account and to_account are ledger account IDs.
 * amount_cents is always positive; direction is from->to.
 */
export interface LedgerEntry {
  fromAccount: number;
  toAccount: number;
  amountCents: number;
  entryType: LedgerEntryType;
  actionId?: string;
  memo?: string;
}

/**
 * Validate that a ledger entry is well-formed.
 * - amount must be positive integer
 * - from != to
 */
export function validateLedgerEntry(entry: LedgerEntry): void {
  if (!Number.isInteger(entry.amountCents) || entry.amountCents <= 0) {
    throw new ValidationError(
      `Ledger entry amount must be positive integer, got ${entry.amountCents}`
    );
  }
  if (entry.fromAccount === entry.toAccount) {
    throw new ValidationError(
      `Ledger entry cannot transfer to self: account ${entry.fromAccount}`
    );
  }
}

/**
 * Validate that a set of ledger entries for a single action is balanced.
 * "Balanced" means: every cent debited from one account is credited to another.
 * This is guaranteed by construction (each entry has a from and to),
 * but this function verifies no negative amounts or self-transfers crept in.
 */
export function validateLedgerBalance(entries: LedgerEntry[]): void {
  for (const entry of entries) {
    validateLedgerEntry(entry);
  }
}

/**
 * Create a job pay ledger entry.
 * Money flows: JOB_PAYROLL (system source) -> player wallet.
 */
export function createJobPayEntry(
  playerAccountId: number,
  amountCents: number,
  actionId?: string,
): LedgerEntry {
  return {
    fromAccount: 1, // SYSTEM_ACCOUNTS.JOB_PAYROLL
    toAccount: playerAccountId,
    amountCents,
    entryType: LEDGER_ENTRY_TYPES.JOB_PAY,
    actionId,
    memo: `Job pay: ${amountCents} cents`,
  };
}

/**
 * Create a rent payment ledger entry.
 * Money flows: player wallet -> BILL_PAYMENT_SINK.
 */
export function createRentEntry(
  playerAccountId: number,
  amountCents: number,
  actionId?: string,
): LedgerEntry {
  return {
    fromAccount: playerAccountId,
    toAccount: 4, // SYSTEM_ACCOUNTS.BILL_PAYMENT_SINK
    amountCents,
    entryType: LEDGER_ENTRY_TYPES.RENT,
    actionId,
    memo: `Rent payment: ${amountCents} cents`,
  };
}

/**
 * Create a utilities payment ledger entry.
 * Money flows: player wallet -> BILL_PAYMENT_SINK.
 */
export function createUtilitiesEntry(
  playerAccountId: number,
  amountCents: number,
  actionId?: string,
): LedgerEntry {
  return {
    fromAccount: playerAccountId,
    toAccount: 4, // SYSTEM_ACCOUNTS.BILL_PAYMENT_SINK
    amountCents,
    entryType: LEDGER_ENTRY_TYPES.UTILITIES,
    actionId,
    memo: `Utilities: ${amountCents} cents`,
  };
}

/**
 * Create a purchase ledger entry (player buys from NPC vendor).
 * Money flows: player wallet -> NPC_VENDOR.
 */
export function createPurchaseEntry(
  playerAccountId: number,
  amountCents: number,
  goodCode: string,
  actionId?: string,
): LedgerEntry {
  return {
    fromAccount: playerAccountId,
    toAccount: 5, // SYSTEM_ACCOUNTS.NPC_VENDOR
    amountCents,
    entryType: LEDGER_ENTRY_TYPES.PURCHASE,
    actionId,
    memo: `Purchase ${goodCode}: ${amountCents} cents`,
  };
}

// ── Economy Hooks (integration interface) ─────────────────────

/**
 * Integration hooks for future modules.
 *
 * These interfaces define the contract between the economy core
 * and modules (production, market, etc.) that haven't been built yet.
 * Implementing modules will provide concrete implementations.
 */

export interface ConsumeGoodsRequest {
  ownerId: string;
  ownerType: 'player' | 'business';
  items: Array<{ goodCode: GoodCode; qty: number }>;
  actionId: string;
}

export interface ProduceGoodsRequest {
  ownerId: string;
  ownerType: 'player' | 'business';
  items: Array<{ goodCode: GoodCode; qty: number }>;
  actionId: string;
}

export interface FeeRequest {
  fromAccountId: number;
  amountCents: number;
  feeType: string;
  actionId: string;
}

export interface SinkRequest {
  fromAccountId: number;
  toSinkAccountId: number;
  amountCents: number;
  sinkType: string;
  actionId: string;
}

/**
 * EconomyHooks — interface that future modules implement.
 *
 * In the MVP, these are NOT called automatically.
 * They define the contract for when production, market, and other
 * modules are built.
 */
export interface EconomyHooks {
  /** Consume goods from inventory (check availability, decrement). */
  consumeGoods(req: ConsumeGoodsRequest): Promise<void>;

  /** Produce goods into inventory (increment). */
  produceGoods(req: ProduceGoodsRequest): Promise<void>;

  /** Charge a fee (e.g. market listing fee, tax). */
  chargeFee(req: FeeRequest): Promise<LedgerEntry>;

  /** Send money to a sink (e.g. waste disposal, rent). */
  sendToSink(req: SinkRequest): Promise<LedgerEntry>;
}
