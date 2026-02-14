import { z } from 'zod';

/**
 * Core game types and schemas
 */

export const VigorDimensionSchema = z.object({
  physical: z.number().min(0).max(100),
  mental: z.number().min(0).max(100),
  social: z.number().min(0).max(100),
  creative: z.number().min(0).max(100),
  spiritual: z.number().min(0).max(100),
});

export type VigorDimension = z.infer<typeof VigorDimensionSchema>;

export const PlayerStateSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  vigor: VigorDimensionSchema,
  balance: z.number().int(), // in cents
  lastTickAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PlayerState = z.infer<typeof PlayerStateSchema>;

export const GoodTypeSchema = z.enum([
  'food',
  'housing',
  'entertainment',
  'tools',
  'luxury',
]);

export type GoodType = z.infer<typeof GoodTypeSchema>;

export const MarketPriceSchema = z.object({
  goodType: GoodTypeSchema,
  price: z.number().int(), // in cents
  supply: z.number().int(),
  demand: z.number().int(),
  updatedAt: z.date(),
});

export type MarketPrice = z.infer<typeof MarketPriceSchema>;
