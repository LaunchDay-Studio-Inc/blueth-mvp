import { ACTION_TYPES, createSocialCallInstantDelta, addVigor, validateNoHardLockouts, ValidationError, ActionConflictError } from '@blueth/core';
import { SocialCallPayloadSchema } from '../schemas/action.schemas';
import type { SocialCallPayload } from '../schemas/action.schemas';
import type { ActionHandler } from './registry';
import { extractVigor, extractCaps } from './registry';

export const socialCallHandler: ActionHandler<SocialCallPayload> = {
  type: ACTION_TYPES.SOCIAL_CALL,

  durationSeconds() {
    return 900; // 15 minutes
  },

  validatePayload(raw: unknown): SocialCallPayload {
    const result = SocialCallPayloadSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
    }
    return result.data;
  },

  checkPreconditions(_payload, state) {
    if (state.sleep_state !== 'awake') {
      throw new ActionConflictError('Cannot make social calls while sleeping');
    }
    const vigor = extractVigor(state);
    const { allowed, reason } = validateNoHardLockouts(vigor, 'SOCIAL_CALL');
    if (!allowed) {
      throw new ValidationError(reason!);
    }
  },

  async resolve(ctx) {
    const instantDelta = createSocialCallInstantDelta(); // { sv: 3, mv: 1 }
    const vigor = extractVigor(ctx.playerState);
    const caps = extractCaps(ctx.playerState);
    const { vigor: newVigor, audit } = addVigor(vigor, instantDelta, caps);

    await ctx.tx.query(
      `UPDATE player_state
       SET pv = $2, mv = $3, sv = $4, cv = $5, spv = $6
       WHERE player_id = $1`,
      [ctx.playerId, Math.round(newVigor.pv), Math.round(newVigor.mv), Math.round(newVigor.sv), Math.round(newVigor.cv), Math.round(newVigor.spv)]
    );

    return {
      vigorDelta: instantDelta,
      audit,
    };
  },
};
