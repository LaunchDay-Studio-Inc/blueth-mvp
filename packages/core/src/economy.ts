import type { GoodType } from './types';

/**
 * Economy system - jobs, goods, market, production, bills, sinks
 *
 * MVP focuses on:
 * - Basic jobs that pay money and cost vigor
 * - Goods with dynamic market pricing
 * - Production chains (stub for now)
 * - Bills and money sinks to prevent infinite accumulation
 */

export interface JobDefinition {
  id: string;
  name: string;
  description: string;
  payPerHour: number; // in cents
  vigorCost: {
    physical?: number;
    mental?: number;
    social?: number;
    creative?: number;
    spiritual?: number;
  };
  cooldownHours: number;
}

export interface GoodDefinition {
  type: GoodType;
  name: string;
  description: string;
  basePrice: number; // in cents
  productionCost: number; // in cents
}

/**
 * Calculate market price based on supply and demand
 * Uses simple supply/demand ratio with floor and ceiling
 */
export function calculateMarketPrice(
  basePrice: number,
  supply: number,
  demand: number
): number {
  if (supply === 0) return basePrice * 2; // scarcity premium
  if (demand === 0) return Math.floor(basePrice * 0.5); // oversupply discount

  const ratio = demand / supply;
  const priceMultiplier = Math.max(0.5, Math.min(2.0, ratio));

  return Math.floor(basePrice * priceMultiplier);
}

/**
 * Calculate job payout with efficiency multiplier
 * Efficiency comes from vigor cascade effect
 */
export function calculateJobPayout(
  jobPayPerHour: number,
  hoursWorked: number,
  efficiency: number
): number {
  const basePay = jobPayPerHour * hoursWorked;
  return Math.floor(basePay * efficiency);
}

/**
 * Stub: Basic goods catalog
 */
export const GOODS_CATALOG: GoodDefinition[] = [
  {
    type: 'food',
    name: 'Food',
    description: 'Basic sustenance',
    basePrice: 500, // $5.00
    productionCost: 200,
  },
  {
    type: 'housing',
    name: 'Housing',
    description: 'Shelter and rest',
    basePrice: 50000, // $500.00 per billing period
    productionCost: 30000,
  },
  {
    type: 'entertainment',
    name: 'Entertainment',
    description: 'Fun and relaxation',
    basePrice: 1000, // $10.00
    productionCost: 400,
  },
  {
    type: 'tools',
    name: 'Tools',
    description: 'Equipment for work',
    basePrice: 5000, // $50.00
    productionCost: 3000,
  },
  {
    type: 'luxury',
    name: 'Luxury Goods',
    description: 'High-end items',
    basePrice: 20000, // $200.00
    productionCost: 12000,
  },
];

/**
 * Stub: Basic jobs catalog
 */
export const JOBS_CATALOG: JobDefinition[] = [
  {
    id: 'factory_worker',
    name: 'Factory Worker',
    description: 'Manual labor in the factory',
    payPerHour: 1500, // $15.00/hr
    vigorCost: { physical: 15, mental: 5 },
    cooldownHours: 0,
  },
  {
    id: 'office_clerk',
    name: 'Office Clerk',
    description: 'Administrative tasks',
    payPerHour: 1800, // $18.00/hr
    vigorCost: { mental: 20, social: 5 },
    cooldownHours: 0,
  },
  {
    id: 'artist',
    name: 'Artist',
    description: 'Create and sell art',
    payPerHour: 2500, // $25.00/hr (variable in reality)
    vigorCost: { creative: 25, mental: 10 },
    cooldownHours: 4,
  },
];
