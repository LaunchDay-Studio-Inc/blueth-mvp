import { ACTION_TYPES, applyVigorRegen, ActionConflictError, ValidationError } from '@blueth/core';
import { SleepPayloadSchema } from '../schemas/action.schemas';
import type { SleepPayload } from '../schemas/action.schemas';
import type { ActionHandler } from './registry';
import { extractVigor, extractCaps } from './registry';

export const sleepHandler: ActionHandler<SleepPayload> = {
  type: ACTION_TYPES.SLEEP,

  durationSeconds(payload) {
    return payload.hours * 3600;
  },

  validatePayload(raw: unknown): SleepPayload {
    const result = SleepPayloadSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
    }
    return result.data;
  },

  checkPreconditions(_payload, state) {
    if (state.sleep_state !== 'awake') {
      throw new ActionConflictError('Cannot sleep: already sleeping or exhausted');
    }
  },

  async onSubmit(ctx) {
    // Immediately mark player as sleeping when action is submitted
    await ctx.tx.query(
      `UPDATE player_state SET sleep_state = 'sleeping' WHERE player_id = $1`,
      [ctx.playerId]
    );
  },

  async resolve(ctx) {
    const vigor = extractVigor(ctx.playerState);
    const caps = extractCaps(ctx.playerState);

    // Apply vigor regen for the sleep duration
    const { vigor: newVigor, audit } = applyVigorRegen(vigor, ctx.payload.hours, caps);

    // Wake up: set sleep_state back to 'awake' and update vigor
    await ctx.tx.query(
      `UPDATE player_state
       SET pv = $2, mv = $3, sv = $4, cv = $5, spv = $6,
           sleep_state = 'awake'
       WHERE player_id = $1`,
      [ctx.playerId, newVigor.pv, newVigor.mv, newVigor.sv, newVigor.cv, newVigor.spv]
    );

    return {
      hoursSlept: ctx.payload.hours,
      vigorGained: audit,
      vigorAfter: newVigor,
    };
  },
};
