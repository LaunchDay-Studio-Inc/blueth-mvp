import {
  ACTION_TYPES,
  calculatePerformance,
  calculateShiftPay,
  getShiftVigorCost,
  applyShiftSkillXP,
  subVigor,
  JOBS_CATALOG,
  SHIFT_HOURS,
  LEDGER_ENTRY_TYPES,
  SYSTEM_ACCOUNTS,
  ValidationError,
  ActionConflictError,
} from '@blueth/core';
import type { JobFamily, ShiftDuration, SkillSet } from '@blueth/core';
import { transferCents } from '@blueth/db';
import { WorkShiftPayloadSchema } from '../schemas/action.schemas';
import type { WorkShiftPayload } from '../schemas/action.schemas';
import type { ActionHandler } from './registry';
import { extractVigor, extractCaps } from './registry';

/** Map from job family to primary skill name (used for performance lookup). */
const FAMILY_PRIMARY_SKILL: Record<JobFamily, keyof SkillSet> = {
  physical: 'labor',
  admin: 'admin',
  service: 'service',
  management: 'management',
};

export const workShiftHandler: ActionHandler<WorkShiftPayload> = {
  type: ACTION_TYPES.WORK_SHIFT,

  durationSeconds(payload) {
    return SHIFT_HOURS[payload.duration as ShiftDuration] * 3600;
  },

  validatePayload(raw: unknown): WorkShiftPayload {
    const result = WorkShiftPayloadSchema.safeParse(raw);
    if (!result.success) {
      throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
    }
    // Verify job family exists in catalog
    const job = JOBS_CATALOG.find((j) => j.family === result.data.jobFamily);
    if (!job) {
      throw new ValidationError(`Unknown job family: ${result.data.jobFamily}`);
    }
    return result.data;
  },

  checkPreconditions(_payload, state) {
    if (state.sleep_state !== 'awake') {
      throw new ActionConflictError('Cannot work while sleeping');
    }
  },

  async resolve(ctx) {
    const { jobFamily, duration } = ctx.payload;
    const family = jobFamily as JobFamily;
    const shiftDuration = duration as ShiftDuration;

    const vigor = extractVigor(ctx.playerState);
    const caps = extractCaps(ctx.playerState);
    const skills: SkillSet = ctx.playerState.skills;

    // 1. Vigor cost
    const vigorCost = getShiftVigorCost(family, shiftDuration);
    const { vigor: postCostVigor } = subVigor(vigor, vigorCost, caps);

    // 2. Performance + Pay (calculated on pre-cost vigor)
    const primarySkill = FAMILY_PRIMARY_SKILL[family];
    const currentSkill = skills[primarySkill];
    const performance = calculatePerformance(family, currentSkill, vigor);
    const job = JOBS_CATALOG.find((j) => j.family === family)!;
    const payCents = calculateShiftPay(job.baseWageDaily, performance, shiftDuration);

    // 3. Skill XP
    const xpResult = applyShiftSkillXP(family, currentSkill, shiftDuration);
    const updatedSkills = { ...skills, [xpResult.skill]: xpResult.newValue };

    // 4. Ledger entry (pay from JOB_PAYROLL to player)
    await transferCents(
      ctx.tx,
      SYSTEM_ACCOUNTS.JOB_PAYROLL,
      ctx.playerAccountId,
      payCents,
      LEDGER_ENTRY_TYPES.JOB_PAY,
      ctx.actionId,
      `${family} ${shiftDuration} shift pay`
    );

    // 5. Update player state: new vigor + updated skills
    await ctx.tx.query(
      `UPDATE player_state
       SET pv = $2, mv = $3, sv = $4, cv = $5, spv = $6,
           skills = $7
       WHERE player_id = $1`,
      [
        ctx.playerId,
        postCostVigor.pv, postCostVigor.mv, postCostVigor.sv, postCostVigor.cv, postCostVigor.spv,
        JSON.stringify(updatedSkills),
      ]
    );

    return {
      jobFamily: family,
      shiftDuration,
      performance,
      payCents,
      vigorCost,
      skillGained: xpResult,
      vigorAfter: postCostVigor,
    };
  },
};
