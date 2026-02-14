/**
 * Market Day Trade Session Handler
 *
 * Action type: MARKET_DAY_TRADE_SESSION
 * Duration: 0 (instant)
 * Vigor cost: MV-10
 * Stress: If repeated 3+ times/day, apply SpV-2 stress
 *
 * A day trade session represents an intense burst of market activity.
 */

import {
  ACTION_TYPES,
  ValidationError,
  subVigor,
  addVigor,
  DAY_TRADE_MV_COST,
  DAY_TRADE_SPV_STRESS,
  DAY_TRADE_STRESS_THRESHOLD,
} from '@blueth/core';
import { z } from 'zod';
import type { ActionHandler } from './registry';
import { extractVigor, extractCaps } from './registry';
import { txQueryOne } from '../services/action-engine';

const DayTradePayloadSchema = z.object({});

type DayTradePayload = z.infer<typeof DayTradePayloadSchema>;

export const marketDayTradeHandler: ActionHandler<DayTradePayload> = {
  type: ACTION_TYPES.MARKET_DAY_TRADE_SESSION,

  durationSeconds() {
    return 0; // instant
  },

  validatePayload(raw: unknown): DayTradePayload {
    const result = DayTradePayloadSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
    }
    return result.data;
  },

  checkPreconditions(_payload, state) {
    if (state.mv < DAY_TRADE_MV_COST) {
      throw new ValidationError(
        `Insufficient mental vigor: need MV ${DAY_TRADE_MV_COST}, have ${state.mv}`
      );
    }
  },

  async resolve(ctx) {
    const { tx, playerId, playerState } = ctx;
    const vigor = extractVigor(playerState);
    const caps = extractCaps(playerState);

    // Apply MV-10 cost
    const vigorCost = { mv: DAY_TRADE_MV_COST };
    let { vigor: newVigor } = subVigor(vigor, vigorCost, caps);

    // Track day trade count
    const existing = await txQueryOne<{ count: string }>(
      tx,
      `INSERT INTO day_trade_sessions (player_id, session_date, count)
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (player_id, session_date)
       DO UPDATE SET count = day_trade_sessions.count + 1
       RETURNING count`,
      [playerId]
    );

    const dayTradeCount = parseInt(existing?.count ?? '1', 10);
    let stressApplied = false;

    // Apply SpV-2 stress if 3+ per day
    if (dayTradeCount >= DAY_TRADE_STRESS_THRESHOLD) {
      const stressDelta = { spv: -DAY_TRADE_SPV_STRESS };
      const result = addVigor(newVigor, stressDelta, caps);
      newVigor = result.vigor;
      stressApplied = true;
    }

    // Update player state
    await tx.query(
      `UPDATE player_state SET mv = $2, spv = $3 WHERE player_id = $1`,
      [playerId, newVigor.mv, newVigor.spv]
    );

    return {
      mvCost: DAY_TRADE_MV_COST,
      dayTradeCount,
      stressApplied,
      spvStress: stressApplied ? DAY_TRADE_SPV_STRESS : 0,
      vigorAfter: newVigor,
    };
  },
};
