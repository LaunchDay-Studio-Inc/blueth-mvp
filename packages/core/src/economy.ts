import type { VigorDimension } from './types';

/**
 * Economy system — jobs, goods, market pricing, production.
 *
 * All money values are INTEGER CENTS (1 BCE = 100 cents).
 * Functions that return money always use Math.floor() to stay in integers.
 */

export interface JobDefinition {
  id: string;
  name: string;
  description: string;
  payPerHour: number; // cents
  vigorCost: Partial<VigorDimension>;
  cooldownHours: number;
}

/**
 * Calculate NPC market price from supply/demand ratio.
 * Clamps multiplier to [0.5, 2.0] range around base price.
 * Returns integer cents.
 */
export function calculateMarketPrice(
  basePrice: number,
  supply: number,
  demand: number
): number {
  if (supply === 0) return basePrice * 2;
  if (demand === 0) return Math.floor(basePrice * 0.5);

  const ratio = demand / supply;
  const multiplier = Math.max(0.5, Math.min(2.0, ratio));
  return Math.floor(basePrice * multiplier);
}

/**
 * Calculate job payout with efficiency multiplier (from vigor cascade).
 * Returns integer cents.
 */
export function calculateJobPayout(
  jobPayPerHour: number,
  hoursWorked: number,
  efficiency: number
): number {
  return Math.floor(jobPayPerHour * hoursWorked * efficiency);
}

/**
 * Basic jobs catalog — matches DB items created at runtime.
 * vigor costs use the pv/mv/sv/cv/spv schema keys.
 */
export const JOBS_CATALOG: JobDefinition[] = [
  {
    id: 'factory_worker',
    name: 'Factory Worker',
    description: 'Manual labor in the factory',
    payPerHour: 1500,
    vigorCost: { pv: 15, mv: 5 },
    cooldownHours: 0,
  },
  {
    id: 'office_clerk',
    name: 'Office Clerk',
    description: 'Administrative tasks',
    payPerHour: 1800,
    vigorCost: { mv: 20, sv: 5 },
    cooldownHours: 0,
  },
  {
    id: 'artist',
    name: 'Artist',
    description: 'Create and sell art',
    payPerHour: 2500,
    vigorCost: { cv: 25, mv: 10 },
    cooldownHours: 4,
  },
];
