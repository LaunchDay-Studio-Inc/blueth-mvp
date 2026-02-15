/**
 * Canonical action types for MVP.
 *
 * Every player action submitted through the API must map to one of these.
 * MODULE_STUB_ACTION is a catch-all for future modules (politics, crime, etc.)
 * that have interfaces defined but zero gameplay impact in MVP.
 */

export const ACTION_TYPES = {
  // ── Personal ──
  SLEEP: 'SLEEP',
  EAT_MEAL: 'EAT_MEAL',
  LEISURE: 'LEISURE',
  SOCIAL_CALL: 'SOCIAL_CALL',

  // ── Employment ──
  WORK_SHIFT: 'WORK_SHIFT',
  GIG_JOB: 'GIG_JOB',

  // ── Market ──
  MARKET_PLACE_ORDER: 'MARKET_PLACE_ORDER',
  MARKET_CANCEL_ORDER: 'MARKET_CANCEL_ORDER',
  MARKET_DAY_TRADE_SESSION: 'MARKET_DAY_TRADE_SESSION',

  // ── Business ──
  BUSINESS_REGISTER: 'BUSINESS_REGISTER',
  BUSINESS_RENT_LOCATION: 'BUSINESS_RENT_LOCATION',
  BUSINESS_BUY_MACHINERY: 'BUSINESS_BUY_MACHINERY',
  BUSINESS_HIRE_SESSION: 'BUSINESS_HIRE_SESSION',
  BUSINESS_PLAN_PRODUCTION: 'BUSINESS_PLAN_PRODUCTION',
  BUSINESS_START_PRODUCTION: 'BUSINESS_START_PRODUCTION',
  BUSINESS_SELL_OUTPUTS: 'BUSINESS_SELL_OUTPUTS',

  // ── Stub for future modules ──
  MODULE_STUB_ACTION: 'MODULE_STUB_ACTION',
} as const;

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

/** Set of all valid action type strings, for runtime validation. */
export const VALID_ACTION_TYPES = new Set<string>(Object.values(ACTION_TYPES));

/** Check if a string is a valid ActionType. */
export function isValidActionType(value: string): value is ActionType {
  return VALID_ACTION_TYPES.has(value);
}
