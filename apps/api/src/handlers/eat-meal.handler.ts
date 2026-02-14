import { ACTION_TYPES, createMealBuff, addVigor, ValidationError } from '@blueth/core';
import type { Buff } from '@blueth/core';
import { EatMealPayloadSchema } from '../schemas/action.schemas';
import type { EatMealPayload } from '../schemas/action.schemas';
import type { ActionHandler } from './registry';
import { extractVigor, extractCaps } from './registry';

const MAX_MEALS_PER_DAY = 3;

export const eatMealHandler: ActionHandler<EatMealPayload> = {
  type: ACTION_TYPES.EAT_MEAL,

  durationSeconds() {
    return 0; // instant
  },

  validatePayload(raw: unknown): EatMealPayload {
    const result = EatMealPayloadSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
    }
    return result.data;
  },

  checkPreconditions(_payload, state) {
    if (state.meal_day_count >= MAX_MEALS_PER_DAY) {
      throw new ValidationError(`Maximum ${MAX_MEALS_PER_DAY} meals per day (already eaten ${state.meal_day_count})`);
    }
  },

  async resolve(ctx) {
    const { quality } = ctx.payload;
    const now = new Date().toISOString();

    // Create meal buffs
    const newBuffs = createMealBuff(quality, now);
    const currentBuffs: Buff[] = ctx.playerState.active_buffs ?? [];
    const allBuffs = [...currentBuffs, ...newBuffs];

    // Apply instant deltas from buffs (e.g., FINE_DINING SV +2)
    let vigor = extractVigor(ctx.playerState);
    const caps = extractCaps(ctx.playerState);
    for (const buff of newBuffs) {
      if (buff.instantDeltaByDim) {
        const result = addVigor(vigor, buff.instantDeltaByDim, caps);
        vigor = result.vigor;
      }
    }

    // Update meal tracking
    const mealTimes: string[] = ctx.playerState.last_meal_times ?? [];
    const updatedMealTimes = [...mealTimes, now];

    await ctx.tx.query(
      `UPDATE player_state
       SET pv = $2, mv = $3, sv = $4, cv = $5, spv = $6,
           active_buffs = $7,
           meal_day_count = meal_day_count + 1,
           last_meal_times = $8
       WHERE player_id = $1`,
      [
        ctx.playerId,
        vigor.pv, vigor.mv, vigor.sv, vigor.cv, vigor.spv,
        JSON.stringify(allBuffs),
        JSON.stringify(updatedMealTimes),
      ]
    );

    return {
      quality,
      buffsCreated: newBuffs.length,
      instantDelta: newBuffs.find((b) => b.instantDeltaByDim)?.instantDeltaByDim ?? null,
    };
  },
};
