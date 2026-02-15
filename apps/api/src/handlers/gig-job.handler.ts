import {
  ACTION_TYPES,
  calculatePerformance,
  calculateGigPay,
  getGigVigorCost,
  applyGigSkillXP,
  subVigor,
  GIGS_CATALOG,
  GIG_DURATION_SECONDS,
  gigPayMultiplier,
  LEDGER_ENTRY_TYPES,
  SYSTEM_ACCOUNTS,
  ValidationError,
  ActionConflictError,
} from '@blueth/core';
import type { JobFamily, SkillSet } from '@blueth/core';
import { transferCents } from '@blueth/db';
import { GigJobPayloadSchema } from '../schemas/action.schemas';
import type { GigJobPayload } from '../schemas/action.schemas';
import type { ActionHandler } from './registry';
import { extractVigor, extractCaps } from './registry';

/** Map from job family to primary skill name. */
const FAMILY_PRIMARY_SKILL: Record<JobFamily, keyof SkillSet> = {
  physical: 'labor',
  admin: 'admin',
  service: 'service',
  management: 'management',
};

export const gigJobHandler: ActionHandler<GigJobPayload> = {
  type: ACTION_TYPES.GIG_JOB,

  durationSeconds() {
    return GIG_DURATION_SECONDS;
  },

  validatePayload(raw: unknown): GigJobPayload {
    const result = GigJobPayloadSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
    }
    const gig = GIGS_CATALOG.find((g) => g.id === result.data.gigId);
    if (!gig) {
      throw new ValidationError(`Unknown gig: ${result.data.gigId}`);
    }
    return result.data;
  },

  checkPreconditions(_payload, state) {
    if (state.sleep_state !== 'awake') {
      throw new ActionConflictError('Cannot do a gig while sleeping');
    }
  },

  async resolve(ctx) {
    const gig = GIGS_CATALOG.find((g) => g.id === ctx.payload.gigId)!;
    const family = gig.family;

    const vigor = extractVigor(ctx.playerState);
    const caps = extractCaps(ctx.playerState);
    const skills: SkillSet = ctx.playerState.skills;

    // 1. Vigor cost
    const vigorCost = getGigVigorCost(family);
    const { vigor: postCostVigor } = subVigor(vigor, vigorCost, caps);

    // 2. Performance + Pay (calculated on pre-cost vigor)
    const primarySkill = FAMILY_PRIMARY_SKILL[family];
    const currentSkill = skills[primarySkill];
    const performance = calculatePerformance(family, currentSkill, vigor);

    // 3. Count today's completed gigs (for diminishing returns)
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const countResult = await ctx.tx.query(
      `SELECT COUNT(*)::int AS cnt FROM actions
       WHERE player_id = $1
         AND type = 'GIG_JOB'
         AND status = 'completed'
         AND finished_at >= $2`,
      [ctx.playerId, todayMidnight.toISOString()]
    );
    const gigsCompletedToday: number = countResult.rows[0]?.cnt ?? 0;

    const payCents = calculateGigPay(gig.baseWageDaily, performance, gigsCompletedToday);
    const payMultiplier = gigPayMultiplier(gigsCompletedToday);

    // 4. Skill XP
    const xpResult = applyGigSkillXP(family, currentSkill);
    const updatedSkills = { ...skills, [xpResult.skill]: xpResult.newValue };

    // 5. Ledger entry (pay from JOB_PAYROLL to player)
    await transferCents(
      ctx.tx,
      SYSTEM_ACCOUNTS.JOB_PAYROLL,
      ctx.playerAccountId,
      payCents,
      LEDGER_ENTRY_TYPES.JOB_PAY,
      ctx.actionId,
      `${gig.label} gig pay (×${payMultiplier.toFixed(2)})`
    );

    // 6. Update player state: new vigor + updated skills
    await ctx.tx.query(
      `UPDATE player_state
       SET pv = $2, mv = $3, sv = $4, cv = $5, spv = $6,
           skills = $7
       WHERE player_id = $1`,
      [
        ctx.playerId,
        Math.round(postCostVigor.pv), Math.round(postCostVigor.mv), Math.round(postCostVigor.sv), Math.round(postCostVigor.cv), Math.round(postCostVigor.spv),
        JSON.stringify(updatedSkills),
      ]
    );

    return {
      gigId: gig.id,
      jobFamily: family,
      performance,
      payCents,
      payMultiplier,
      vigorCost,
      skillGained: xpResult,
      vigorAfter: postCostVigor,
    };
  },
};
