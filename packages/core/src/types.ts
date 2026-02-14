import { z } from 'zod';

// ============================================================
// Vigor
// ============================================================

export const VigorDimensionSchema = z.object({
  pv: z.number().int().min(0),   // Physical Vigor
  mv: z.number().int().min(0),   // Mental Vigor
  sv: z.number().int().min(0),   // Social Vigor
  cv: z.number().int().min(0),   // Creative Vigor
  spv: z.number().int().min(0),  // Spiritual Vigor
});

export type VigorDimension = z.infer<typeof VigorDimensionSchema>;

export const VigorCapsSchema = z.object({
  pv_cap: z.number().int().positive(),
  mv_cap: z.number().int().positive(),
  sv_cap: z.number().int().positive(),
  cv_cap: z.number().int().positive(),
  spv_cap: z.number().int().positive(),
});

export type VigorCaps = z.infer<typeof VigorCapsSchema>;

export const VIGOR_KEYS = ['pv', 'mv', 'sv', 'cv', 'spv'] as const;
export type VigorKey = (typeof VIGOR_KEYS)[number];

export const SleepStateSchema = z.enum(['awake', 'sleeping', 'exhausted']);
export type SleepState = z.infer<typeof SleepStateSchema>;

// ── Buff System ──

export const BuffSourceSchema = z.enum([
  'MEAL',
  'LEISURE',
  'SOCIAL_CALL',
  'PENALTY',
]);
export type BuffSource = z.infer<typeof BuffSourceSchema>;

export const MealQualitySchema = z.enum([
  'STREET_FOOD',
  'HOME_COOKED',
  'RESTAURANT',
  'FINE_DINING',
  'NUTRIENT_OPTIMAL',
]);
export type MealQuality = z.infer<typeof MealQualitySchema>;

export interface Buff {
  id: string;
  source: BuffSource;
  startsAt: string; // ISO timestamp
  endsAt: string;   // ISO timestamp
  perHourBonusByDim: Partial<VigorDimension>;
  instantDeltaByDim?: Partial<VigorDimension>;
  metadata?: Record<string, unknown>;
}

// ── VigorState (full system state for a player) ──

export interface VigorState {
  vigor: VigorDimension;
  caps: VigorCaps;
  sleepState: SleepState;
  activeBuffs: Buff[];
  lastMealTimes: string[];      // ISO timestamps
  mealsEatenToday: number;
  mealPenaltyLevel: number;     // 0..3 (clamped)
  lastDailyResetLocalDate: string | null; // YYYY-MM-DD
}

// ============================================================
// Player
// ============================================================

export const PlayerStateSchema = z.object({
  player_id: z.string().uuid(),
  pv: z.number().int().min(0),
  mv: z.number().int().min(0),
  sv: z.number().int().min(0),
  cv: z.number().int().min(0),
  spv: z.number().int().min(0),
  pv_cap: z.number().int().positive(),
  mv_cap: z.number().int().positive(),
  sv_cap: z.number().int().positive(),
  cv_cap: z.number().int().positive(),
  spv_cap: z.number().int().positive(),
  sleep_state: SleepStateSchema,
  housing_tier: z.number().int().min(0),
  last_meal_times: z.array(z.string()),
  meal_day_count: z.number().int().min(0),
  meal_penalty_level: z.number().int().min(0),
  last_daily_reset: z.string().nullable(),
  updated_at: z.string(),
});

export type PlayerState = z.infer<typeof PlayerStateSchema>;

// ============================================================
// Actions
// ============================================================

export const ActionStatusSchema = z.enum([
  'pending',
  'scheduled',
  'running',
  'completed',
  'failed',
  'cancelled',
]);
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

// ============================================================
// Economy — Goods
// ============================================================

export const GOOD_CODES = [
  'RAW_FOOD',
  'PROCESSED_FOOD',
  'FRESH_WATER',
  'ENERGY',
  'MATERIALS',
  'BUILDING_MATERIALS',
  'INDUSTRIAL_MACHINERY',
  'ENTERTAINMENT',
  'WASTE',
] as const;

export type GoodCode = (typeof GOOD_CODES)[number];

export const GoodCodeSchema = z.enum(GOOD_CODES);

// ============================================================
// Market
// ============================================================

export const OrderSideSchema = z.enum(['buy', 'sell']);
export type OrderSide = z.infer<typeof OrderSideSchema>;

export const OrderTypeSchema = z.enum(['limit', 'market']);
export type OrderType = z.infer<typeof OrderTypeSchema>;

export const OrderStatusSchema = z.enum(['open', 'partial', 'filled', 'cancelled']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

// ============================================================
// Tick
// ============================================================

export const TickTypeSchema = z.enum(['hourly', 'six_hour', 'daily']);
export type TickType = z.infer<typeof TickTypeSchema>;

export const TickStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);
export type TickStatus = z.infer<typeof TickStatusSchema>;

// ============================================================
// Ledger — system account IDs (seeded in 007_seed_data.sql)
// ============================================================

export const SYSTEM_ACCOUNTS = {
  JOB_PAYROLL: 1,
  TAX_SINK: 2,
  MARKET_ESCROW: 3,
  BILL_PAYMENT_SINK: 4,
  NPC_VENDOR: 5,
  INITIAL_GRANT: 6,
} as const;
