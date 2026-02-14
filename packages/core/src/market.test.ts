import {
  calculateRefPrice,
  shouldTriggerCircuitBreaker,
  isMarketHalted,
  calculateMarketFee,
  calculateBuyerTotalCost,
  calculateNpcPrices,
  computeNpcDemandSupply,
  MARKET_FEE_RATE,
  CIRCUIT_BREAKER_THRESHOLD,
  MARKET_ALPHA,
} from './market';

// ── calculateRefPrice ────────────────────────────────────────

describe('calculateRefPrice', () => {
  it('returns same price when supply equals demand', () => {
    const result = calculateRefPrice(200, 0.05, 1000, 1000);
    expect(result).toBe(200);
  });

  it('increases price when demand exceeds supply', () => {
    const result = calculateRefPrice(200, 0.05, 1200, 1000);
    expect(result).toBeGreaterThan(200);
  });

  it('decreases price when supply exceeds demand', () => {
    const result = calculateRefPrice(200, 0.05, 800, 1000);
    expect(result).toBeLessThan(200);
  });

  it('scales adjustment by alpha', () => {
    const lowAlpha = calculateRefPrice(200, 0.05, 1500, 1000);
    const highAlpha = calculateRefPrice(200, 0.12, 1500, 1000);
    // Higher alpha should move price more
    expect(highAlpha - 200).toBeGreaterThan(lowAlpha - 200);
  });

  it('returns at least 1 cent', () => {
    const result = calculateRefPrice(1, 0.12, 0, 10000);
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('clamps to 10x above previous price', () => {
    const result = calculateRefPrice(100, 0.12, 1000000, 1);
    expect(result).toBeLessThanOrEqual(1000);
  });

  it('clamps to 0.1x below previous price', () => {
    const result = calculateRefPrice(100, 0.12, 1, 1000000);
    expect(result).toBeGreaterThanOrEqual(10);
  });

  it('handles zero supply correctly (uses max(supply, 1))', () => {
    const result = calculateRefPrice(200, 0.05, 100, 0);
    expect(result).toBeGreaterThan(200);
  });
});

// ── shouldTriggerCircuitBreaker ──────────────────────────────

describe('shouldTriggerCircuitBreaker', () => {
  it('returns false for small price changes', () => {
    expect(shouldTriggerCircuitBreaker(220, 200)).toBe(false);
  });

  it('returns true for >25% increase', () => {
    expect(shouldTriggerCircuitBreaker(260, 200)).toBe(true);
  });

  it('returns true for >25% decrease', () => {
    expect(shouldTriggerCircuitBreaker(140, 200)).toBe(true);
  });

  it('returns false at exactly 25%', () => {
    // 25% of 200 = 50 => 250 is exactly at threshold (not over)
    expect(shouldTriggerCircuitBreaker(250, 200)).toBe(false);
  });

  it('returns true at 25.1%', () => {
    // >25% triggers
    expect(shouldTriggerCircuitBreaker(251, 200)).toBe(true);
  });

  it('handles zero base price', () => {
    expect(shouldTriggerCircuitBreaker(100, 0)).toBe(false);
  });
});

// ── isMarketHalted ───────────────────────────────────────────

describe('isMarketHalted', () => {
  it('returns false when haltedUntil is null', () => {
    expect(isMarketHalted(null, new Date())).toBe(false);
  });

  it('returns true when now is before haltedUntil', () => {
    const future = new Date(Date.now() + 3600000);
    expect(isMarketHalted(future, new Date())).toBe(true);
  });

  it('returns false when now is after haltedUntil', () => {
    const past = new Date(Date.now() - 1000);
    expect(isMarketHalted(past, new Date())).toBe(false);
  });
});

// ── calculateMarketFee ───────────────────────────────────────

describe('calculateMarketFee', () => {
  it('calculates 1% fee', () => {
    expect(calculateMarketFee(200, 10)).toBe(20); // 200 * 10 * 0.01 = 20
  });

  it('floors the fee to integer', () => {
    expect(calculateMarketFee(200, 3)).toBe(6); // 200 * 3 * 0.01 = 6
  });

  it('returns minimum 1 cent for small trades', () => {
    expect(calculateMarketFee(10, 1)).toBe(1); // 10 * 1 * 0.01 = 0.1 => min 1
  });

  it('returns 0 for zero trade value', () => {
    expect(calculateMarketFee(0, 10)).toBe(0);
  });
});

// ── calculateBuyerTotalCost ──────────────────────────────────

describe('calculateBuyerTotalCost', () => {
  it('includes price, quantity, and fee', () => {
    // 200 * 10 = 2000 + fee 20 = 2020
    expect(calculateBuyerTotalCost(200, 10)).toBe(2020);
  });
});

// ── calculateNpcPrices ───────────────────────────────────────

describe('calculateNpcPrices', () => {
  it('creates bid below and ask above ref price', () => {
    const { bidCents, askCents } = calculateNpcPrices(200, 200); // 2% spread
    expect(bidCents).toBeLessThan(200);
    expect(askCents).toBeGreaterThan(200);
  });

  it('widens spread when widenedSpread is true', () => {
    const normal = calculateNpcPrices(200, 200, false);
    const widened = calculateNpcPrices(200, 200, true);

    const normalSpread = normal.askCents - normal.bidCents;
    const widenedSpread = widened.askCents - widened.bidCents;

    expect(widenedSpread).toBeGreaterThan(normalSpread);
  });

  it('ensures ask > bid', () => {
    const { bidCents, askCents } = calculateNpcPrices(1, 100);
    expect(askCents).toBeGreaterThan(bidCents);
  });

  it('bid is at least 1 cent', () => {
    const { bidCents } = calculateNpcPrices(1, 100);
    expect(bidCents).toBeGreaterThanOrEqual(1);
  });
});

// ── computeNpcDemandSupply ──────────────────────────────────

describe('computeNpcDemandSupply', () => {
  it('essential demand is stable when price equals base', () => {
    const { newDemand, newSupply } = computeNpcDemandSupply(
      true, 200, 200, 1000, 1000
    );
    // At equilibrium, changes should be near zero
    expect(newDemand).toBeCloseTo(1000, 0);
    expect(newSupply).toBeCloseTo(1000, 0);
  });

  it('essential demand increases when price falls below base', () => {
    const { newDemand } = computeNpcDemandSupply(
      true, 100, 200, 1000, 1000
    );
    expect(newDemand).toBeGreaterThan(1000);
  });

  it('essential demand decreases when price rises above base', () => {
    const { newDemand } = computeNpcDemandSupply(
      true, 400, 200, 1000, 1000
    );
    expect(newDemand).toBeLessThan(1000);
  });

  it('non-essential demand is more elastic', () => {
    const essential = computeNpcDemandSupply(true, 100, 200, 1000, 1000);
    const nonEssential = computeNpcDemandSupply(false, 100, 200, 1000, 1000);

    // Non-essential demand should respond more strongly
    const essentialDelta = Math.abs(essential.newDemand - 1000);
    const nonEssentialDelta = Math.abs(nonEssential.newDemand - 1000);
    expect(nonEssentialDelta).toBeGreaterThan(essentialDelta);
  });

  it('demand never goes below minimum (essentials: 100, non: 10)', () => {
    const essential = computeNpcDemandSupply(true, 100000, 200, 100, 100);
    expect(essential.newDemand).toBeGreaterThanOrEqual(100);

    const nonEssential = computeNpcDemandSupply(false, 100000, 200, 10, 10);
    expect(nonEssential.newDemand).toBeGreaterThanOrEqual(10);
  });
});

// ── Alpha values per good ────────────────────────────────────

describe('MARKET_ALPHA values', () => {
  it('essentials have alpha 0.05-0.08', () => {
    expect(MARKET_ALPHA.RAW_FOOD).toBeGreaterThanOrEqual(0.05);
    expect(MARKET_ALPHA.RAW_FOOD).toBeLessThanOrEqual(0.08);
    expect(MARKET_ALPHA.PROCESSED_FOOD).toBeGreaterThanOrEqual(0.05);
    expect(MARKET_ALPHA.PROCESSED_FOOD).toBeLessThanOrEqual(0.08);
    expect(MARKET_ALPHA.FRESH_WATER).toBeGreaterThanOrEqual(0.05);
    expect(MARKET_ALPHA.FRESH_WATER).toBeLessThanOrEqual(0.08);
    expect(MARKET_ALPHA.ENERGY).toBeGreaterThanOrEqual(0.05);
    expect(MARKET_ALPHA.ENERGY).toBeLessThanOrEqual(0.08);
  });

  it('non-essentials have alpha 0.10-0.12', () => {
    expect(MARKET_ALPHA.MATERIALS).toBeGreaterThanOrEqual(0.10);
    expect(MARKET_ALPHA.MATERIALS).toBeLessThanOrEqual(0.12);
    expect(MARKET_ALPHA.BUILDING_MATERIALS).toBeGreaterThanOrEqual(0.10);
    expect(MARKET_ALPHA.BUILDING_MATERIALS).toBeLessThanOrEqual(0.12);
    expect(MARKET_ALPHA.INDUSTRIAL_MACHINERY).toBeGreaterThanOrEqual(0.10);
    expect(MARKET_ALPHA.INDUSTRIAL_MACHINERY).toBeLessThanOrEqual(0.12);
    expect(MARKET_ALPHA.ENTERTAINMENT).toBeGreaterThanOrEqual(0.10);
    expect(MARKET_ALPHA.ENTERTAINMENT).toBeLessThanOrEqual(0.12);
    expect(MARKET_ALPHA.WASTE).toBeGreaterThanOrEqual(0.10);
    expect(MARKET_ALPHA.WASTE).toBeLessThanOrEqual(0.12);
  });
});
