import { z } from 'zod';
import { MealQualitySchema } from '@blueth/core';

/**
 * Envelope schema for POST /actions body.
 */
export const SubmitActionSchema = z.object({
  type: z.string().min(1, 'Action type is required'),
  payload: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().min(1).max(255, 'Idempotency key must be 1-255 chars'),
});

export type SubmitActionInput = z.infer<typeof SubmitActionSchema>;

// ── Per-handler payload schemas ──────────────────────────────

export const SleepPayloadSchema = z.object({
  hours: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8)]),
});
export type SleepPayload = z.infer<typeof SleepPayloadSchema>;

export const EatMealPayloadSchema = z.object({
  quality: MealQualitySchema,
  district: z.string().optional(),
});
export type EatMealPayload = z.infer<typeof EatMealPayloadSchema>;

export const LeisurePayloadSchema = z.object({});
export type LeisurePayload = z.infer<typeof LeisurePayloadSchema>;

export const SocialCallPayloadSchema = z.object({});
export type SocialCallPayload = z.infer<typeof SocialCallPayloadSchema>;

export const WorkShiftPayloadSchema = z.object({
  jobFamily: z.enum(['physical', 'admin', 'service', 'management']),
  duration: z.enum(['short', 'full']),
});
export type WorkShiftPayload = z.infer<typeof WorkShiftPayloadSchema>;

export const GigJobPayloadSchema = z.object({
  gigId: z.enum(['courier_run', 'data_entry_burst', 'cafe_rush', 'quick_inventory']),
});
export type GigJobPayload = z.infer<typeof GigJobPayloadSchema>;
