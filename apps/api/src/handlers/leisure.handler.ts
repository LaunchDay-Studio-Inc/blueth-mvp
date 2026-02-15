import { ACTION_TYPES, createLeisureBuff, addVigor, validateNoHardLockouts, ValidationError, ActionConflictError } from '@blueth/core';
import type { Buff } from '@blueth/core';
import { LeisurePayloadSchema } from '../schemas/action.schemas';
import type { LeisurePayload } from '../schemas/action.schemas';
import type { ActionHandler } from './registry';
import { extractVigor, extractCaps } from './registry';

export const leisureHandler: ActionHandler<LeisurePayload> = {
  type: ACTION_TYPES.LEISURE,

  durationSeconds() {
    return 3600; // 1 hour
  },

  validatePayload(raw: unknown): LeisurePayload {
    const result = LeisurePayloadSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
    }
    return result.data;
  },

  checkPreconditions(_payload, state) {
    if (state.sleep_state !== 'awake') {
      throw new ActionConflictError('Cannot do leisure while sleeping');
    }
    const vigor = extractVigor(state);
    const { allowed, reason } = validateNoHardLockouts(vigor, 'LEISURE');
    if (!allowed) {
      throw new ValidationError(reason!);
    }
  },

  async resolve(ctx) {
    const now = new Date().toISOString();
    const { buff, instantDelta } = createLeisureBuff(now);

    // Apply instant vigor delta (MV +4, SpV +2)
    const vigor = extractVigor(ctx.playerState);
    const caps = extractCaps(ctx.playerState);
    const { vigor: newVigor, audit } = addVigor(vigor, instantDelta, caps);

    // Add buff to active buffs
    const currentBuffs: Buff[] = ctx.playerState.active_buffs ?? [];
    const allBuffs = [...currentBuffs, buff];

    await ctx.tx.query(
      `UPDATE player_state
       SET pv = $2, mv = $3, sv = $4, cv = $5, spv = $6,
           active_buffs = $7
       WHERE player_id = $1`,
      [
        ctx.playerId,
        Math.round(newVigor.pv), Math.round(newVigor.mv), Math.round(newVigor.sv), Math.round(newVigor.cv), Math.round(newVigor.spv),
        JSON.stringify(allBuffs),
      ]
    );

    return {
      instantDelta,
      buffCreated: true,
      vigorAudit: audit,
    };
  },
};
