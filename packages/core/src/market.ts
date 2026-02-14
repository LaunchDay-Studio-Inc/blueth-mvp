/**
 * Market System — Blueth City BCE Market
 *
 * Deep single-player market with order book and NPC counterparties.
 *
 * Price discovery:
 *   P_ref(t) = P_ref(t-1) * (1 + α * (D - S) / max(S, 1))
 *
 * Alpha values (price sensitivity):
 *   Essentials (tighter spreads, less volatile):
 *     RAW_FOOD:        α = 0.05  (most stable, staple good)
 *     FRESH_WATER:     α = 0.05  (utility, steady demand)
 *     PROCESSED_FOOD:  α = 0.06  (slight processing premium)
 *     ENERGY:          α = 0.08  (essential but more variable)
 *
 *   Non-essentials (wider spreads, more volatile):
 *     MATERIALS:             α = 0.10  (industrial base)
 *     ENTERTAINMENT:         α = 0.10  (consumer discretionary)
 *     BUILDING_MATERIALS:    α = 0.11  (construction cycle sensitive)
 *     WASTE:                 α = 0.11  (disposal market, niche)
 *     INDUSTRIAL_MACHINERY:  α = 0.12  (most volatile, high-value)
 *
 * Anti-exploit clamps (C):
 *   - D/S clamped to [1, 100_000] to prevent numeric overflow
 *   - Alpha clamped to [0.01, 0.20] to prevent extreme sensitivity
 *   - Ref price movement limited to ±5 % per tick to prevent infinite loops
 *
 * Circuit breaker:
 *   If |P_ref - last_6h_ref_price| / last_6h_ref_price > 25% => halt 1 hour.
 *   During halt: no market orders, no matching. Limit orders can be placed but queued.
 *   After halt: widened spreads for NPC makers for 1 hour.
 *
 * NPC Vendor:
 *   Uses system account ID 5 (NPC_VENDOR) as a "world" money source/sink.
 *   This is explicitly documented: NPC_VENDOR can create or destroy money.
 *   This preserves ledger integrity (every entry has from/to) while allowing
 *   the NPC to always provide liquidity. The net money created/destroyed by NPC
 *   trading is trackable via the NPC_VENDOR account balance.
 *
 * Market fee: 1% of trade value (rounded down), paid as a separate ledger entry
 *   to TAX_SINK (account ID 2). Fee is a pure money sink.
 *
 * Vigor costs:
 *   - Place/modify orders per session: MV-4
 *   - Session = 5-minute window. Multiple orders in 5 min = 1 charge.
 *   - Day trade session: MV-10, and if 3+ times/day, apply SpV-2 stress.
 *
 * All money values are INTEGER CENTS.
 */

import type { GoodCode } from './types';

// ── Constants ────────────────────────────────────────────────

/** Default market fee rate: 1% */
export const MARKET_FEE_RATE = 0.01;

/** Circuit breaker threshold: 25% price move within 6 hours */
export const CIRCUIT_BREAKER_THRESHOLD = 0.25;

/** Circuit breaker halt duration: 1 hour in milliseconds */
export const CIRCUIT_BREAKER_HALT_MS = 60 * 60 * 1000;

/** Post-halt widened spread duration: 1 hour in milliseconds */
export const POST_HALT_WIDEN_MS = 60 * 60 * 1000;

/** Widened spread multiplier after halt */
export const POST_HALT_SPREAD_MULTIPLIER = 2.0;

/** Market session window: 5 minutes in milliseconds */
export const MARKET_SESSION_WINDOW_MS = 5 * 60 * 1000;

/** Vigor cost for a market order session: MV-4 */
export const MARKET_ORDER_MV_COST = 4;

/** Vigor cost for a day trade session: MV-10 */
export const DAY_TRADE_MV_COST = 10;

/** SpV stress from excessive day trading (3+ per day) */
export const DAY_TRADE_SPV_STRESS = 2;

/** Day trade sessions before SpV stress kicks in */
export const DAY_TRADE_STRESS_THRESHOLD = 3;

/** Top N levels shown in order book */
export const ORDER_BOOK_DEPTH = 20;

/** NPC maker order quantity (units) for essentials */
export const NPC_ESSENTIAL_ORDER_QTY = 100;

/** NPC maker order quantity (units) for non-essentials */
export const NPC_NON_ESSENTIAL_ORDER_QTY = 50;

// ── Anti-exploit clamps (C) ─────────────────────────────────

/** Demand/Supply floor and ceiling to prevent numeric runaway. */
export const DS_FLOOR = 1;
export const DS_CEILING = 100_000;

/** Alpha clamp range — prevents extreme price sensitivity. */
export const ALPHA_MIN = 0.01;
export const ALPHA_MAX = 0.20;

/** Max ref-price movement per tick: ±5 %. Prevents infinite price loops. */
export const REF_PRICE_MAX_MOVE_PCT = 0.05;

/** Max orders per player per minute (rate limit). */
export const ORDER_RATE_LIMIT_PER_MIN = 10;

// ── Alpha values per good ─────────────────────────────────────

export const MARKET_ALPHA: Record<GoodCode, number> = {
  RAW_FOOD: 0.05,
  PROCESSED_FOOD: 0.06,
  FRESH_WATER: 0.05,
  ENERGY: 0.08,
  MATERIALS: 0.10,
  BUILDING_MATERIALS: 0.11,
  INDUSTRIAL_MACHINERY: 0.12,
  ENTERTAINMENT: 0.10,
  WASTE: 0.11,
};

// ── Spread values per good (basis points) ─────────────────────

export const MARKET_SPREAD_BPS: Record<GoodCode, number> = {
  RAW_FOOD: 100,           // 1%
  PROCESSED_FOOD: 120,     // 1.2%
  FRESH_WATER: 100,        // 1%
  ENERGY: 150,             // 1.5%
  MATERIALS: 200,          // 2%
  BUILDING_MATERIALS: 250, // 2.5%
  INDUSTRIAL_MACHINERY: 300, // 3%
  ENTERTAINMENT: 200,      // 2%
  WASTE: 250,              // 2.5%
};

// ── Clamping helpers ─────────────────────────────────────────

/** Clamp demand/supply to safe range. */
export function clampDS(value: number): number {
  return Math.max(DS_FLOOR, Math.min(DS_CEILING, value));
}

/** Clamp alpha to safe range. */
export function clampAlpha(alpha: number): number {
  return Math.max(ALPHA_MIN, Math.min(ALPHA_MAX, alpha));
}

/**
 * Clamp ref-price movement to ±REF_PRICE_MAX_MOVE_PCT per tick.
 * @param prevCents - previous ref price
 * @param newCents - proposed new ref price
 * @returns clamped price in integer cents
 */
export function clampRefPriceMovement(prevCents: number, newCents: number): number {
  const maxMove = Math.max(1, Math.round(prevCents * REF_PRICE_MAX_MOVE_PCT));
  const floor = prevCents - maxMove;
  const ceiling = prevCents + maxMove;
  return Math.max(1, Math.min(ceiling, Math.max(floor, newCents)));
}

// ── Price Discovery ──────────────────────────────────────────

/**
 * Calculate new reference price using supply/demand dynamics.
 *
 * P_ref(t) = P_ref(t-1) * (1 + α_clamped * (D_clamped - S_clamped) / max(S_clamped, 1))
 *
 * Movement per tick is clamped to ±5 % to prevent infinite loops.
 * Result is further clamped to [floor(0.1 * prevPrice), ceil(10 * prevPrice)]
 * to prevent runaway prices while allowing significant movement over time.
 *
 * @returns integer cents, minimum 1
 */
export function calculateRefPrice(
  prevRefPriceCents: number,
  alpha: number,
  demand: number,
  supply: number,
): number {
  // Anti-exploit: clamp inputs
  const clampedAlpha = clampAlpha(alpha);
  const clampedDemand = clampDS(demand);
  const clampedSupply = clampDS(supply);

  const denominator = Math.max(clampedSupply, 1);
  const adjustment = 1 + clampedAlpha * (clampedDemand - clampedSupply) / denominator;
  const raw = prevRefPriceCents * adjustment;

  // Clamp to 10x range around prev price, minimum 1 cent
  const floor = Math.max(1, Math.floor(prevRefPriceCents * 0.1));
  const ceiling = Math.ceil(prevRefPriceCents * 10);
  const rangeClamped = Math.max(floor, Math.min(ceiling, Math.round(raw)));

  // Anti-exploit: limit per-tick movement to ±5 %
  return clampRefPriceMovement(prevRefPriceCents, rangeClamped);
}

/**
 * Check if a circuit breaker should trigger.
 *
 * @returns true if price moved > 25% from the 6-hour reference
 */
export function shouldTriggerCircuitBreaker(
  currentRefPriceCents: number,
  last6hRefPriceCents: number,
): boolean {
  if (last6hRefPriceCents <= 0) return false;
  const pctChange = Math.abs(currentRefPriceCents - last6hRefPriceCents) / last6hRefPriceCents;
  return pctChange > CIRCUIT_BREAKER_THRESHOLD;
}

/**
 * Check if market is currently halted.
 */
export function isMarketHalted(haltedUntil: Date | null, now: Date): boolean {
  if (!haltedUntil) return false;
  return now < haltedUntil;
}

// ── Fee Calculation ──────────────────────────────────────────

/**
 * Calculate market fee in integer cents.
 * Fee = floor(price * qty * MARKET_FEE_RATE)
 * Minimum fee: 1 cent (if trade value > 0)
 */
export function calculateMarketFee(priceCents: number, qty: number): number {
  const tradeTotalCents = priceCents * qty;
  const fee = Math.floor(tradeTotalCents * MARKET_FEE_RATE);
  return tradeTotalCents > 0 ? Math.max(1, fee) : 0;
}

/**
 * Calculate total cost for a buyer: price * qty + fee
 */
export function calculateBuyerTotalCost(priceCents: number, qty: number): number {
  return Math.floor(priceCents * qty) + calculateMarketFee(priceCents, qty);
}

// ── NPC Maker Orders ─────────────────────────────────────────

/**
 * Calculate NPC bid and ask prices from reference price and spread.
 *
 * @param refPriceCents - current reference price
 * @param spreadBps - spread in basis points (e.g., 200 = 2%)
 * @param widenedSpread - if true, doubles the spread (post-halt)
 * @returns { bidCents, askCents } both integer cents
 */
export function calculateNpcPrices(
  refPriceCents: number,
  spreadBps: number,
  widenedSpread: boolean = false,
): { bidCents: number; askCents: number } {
  const effectiveSpread = widenedSpread ? spreadBps * POST_HALT_SPREAD_MULTIPLIER : spreadBps;
  const halfSpreadFraction = effectiveSpread / 10000 / 2;

  const bidCents = Math.max(1, Math.floor(refPriceCents * (1 - halfSpreadFraction)));
  const askCents = Math.max(bidCents + 1, Math.ceil(refPriceCents * (1 + halfSpreadFraction)));

  return { bidCents, askCents };
}

/**
 * Compute NPC demand/supply based on affordability index and economic health.
 * D and S values are clamped to [DS_FLOOR, DS_CEILING] to prevent numeric overflow.
 *
 * For essentials:
 *   - Base demand is higher (people need them)
 *   - Demand inversely related to price (affordability)
 *   - Supply adjusts slowly
 *
 * For non-essentials:
 *   - Demand is more elastic (luxury goods)
 *   - Supply and demand both track economic health
 *
 * @param isEssential - whether the good is essential
 * @param refPriceCents - current reference price
 * @param basePriceCents - initial/base price for the good
 * @param currentDemand - current demand level
 * @param currentSupply - current supply level
 * @returns { newDemand, newSupply }
 */
export function computeNpcDemandSupply(
  isEssential: boolean,
  refPriceCents: number,
  basePriceCents: number,
  currentDemand: number,
  currentSupply: number,
): { newDemand: number; newSupply: number } {
  const affordabilityIndex = basePriceCents / Math.max(refPriceCents, 1);

  if (isEssential) {
    const demandAdjust = 0.02 * (affordabilityIndex - 1);
    const supplyAdjust = 0.01 * (currentDemand / Math.max(currentSupply, 1) - 1);

    return {
      newDemand: clampDS(Math.max(100, currentDemand * (1 + demandAdjust))),
      newSupply: clampDS(Math.max(100, currentSupply * (1 + supplyAdjust))),
    };
  } else {
    const demandAdjust = 0.05 * (affordabilityIndex - 1);
    const supplyAdjust = 0.03 * (refPriceCents / Math.max(basePriceCents, 1) - 1);

    return {
      newDemand: clampDS(Math.max(10, currentDemand * (1 + demandAdjust))),
      newSupply: clampDS(Math.max(10, currentSupply * (1 + supplyAdjust))),
    };
  }
}
