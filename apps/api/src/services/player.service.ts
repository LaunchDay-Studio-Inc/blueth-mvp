import { queryOne, getPlayerBalance } from '@blueth/db';
import { formatBlueth, NotFoundError, computeSoftGates } from '@blueth/core';
import type { VigorDimension, VigorCaps, SleepState, Buff } from '@blueth/core';
import type { SkillSet } from '@blueth/core';
import { DateTime } from 'luxon';

export interface FullPlayerState {
  playerId: string;
  username: string;
  timezone: string;
  vigor: VigorDimension;
  caps: VigorCaps;
  sleepState: SleepState;
  housingTier: number;
  balanceCents: number;
  balanceFormatted: string;
  skills: SkillSet;
  activeBuffs: Buff[];
  mealsEatenToday: number;
  mealPenaltyLevel: number;
  pendingActions: number;
  updatedAt: string;
  /** ISO timestamp of next daily reset (midnight in player timezone). */
  nextDailyReset: string;
  /** Current local time in player timezone (ISO string). */
  localTime: string;
  /** Seconds until daily reset. */
  secondsUntilDailyReset: number;
  /** Soft-gate info for current vigor levels. */
  softGates: {
    mvSlippage: number;
    svServiceMult: number;
    cvFeeMult: number;
    cvSpeedMult: number;
    spvRegenMult: number;
  };
}

interface PlayerStateRow {
  player_id: string;
  username: string;
  timezone: string;
  pv: number;
  mv: number;
  sv: number;
  cv: number;
  spv: number;
  pv_cap: number;
  mv_cap: number;
  sv_cap: number;
  cv_cap: number;
  spv_cap: number;
  sleep_state: SleepState;
  housing_tier: number;
  active_buffs: Buff[];
  skills: SkillSet;
  meal_day_count: number;
  meal_penalty_level: number;
  updated_at: string;
  pending_count: string;
}

export async function getFullPlayerState(playerId: string): Promise<FullPlayerState> {
  const row = await queryOne<PlayerStateRow>(
    `SELECT
       ps.player_id,
       p.username,
       p.timezone,
       ps.pv, ps.mv, ps.sv, ps.cv, ps.spv,
       ps.pv_cap, ps.mv_cap, ps.sv_cap, ps.cv_cap, ps.spv_cap,
       ps.sleep_state,
       ps.housing_tier,
       ps.active_buffs,
       ps.skills,
       ps.meal_day_count,
       ps.meal_penalty_level,
       ps.updated_at,
       (SELECT COUNT(*) FROM actions a
        WHERE a.player_id = ps.player_id
        AND a.status IN ('pending', 'scheduled', 'running')) AS pending_count
     FROM player_state ps
     JOIN players p ON ps.player_id = p.id
     WHERE ps.player_id = $1`,
    [playerId]
  );

  if (!row) {
    throw new NotFoundError('Player state', playerId);
  }

  const balanceCents = await getPlayerBalance(playerId);

  // Compute local time / daily reset timer
  const tz = row.timezone || 'Asia/Dubai';
  const now = DateTime.now().setZone(tz);
  const nextMidnight = now.plus({ days: 1 }).startOf('day');
  const secondsUntilDailyReset = Math.max(0, Math.round(nextMidnight.diff(now, 'seconds').seconds));

  const vigor: VigorDimension = {
    pv: row.pv,
    mv: row.mv,
    sv: row.sv,
    cv: row.cv,
    spv: row.spv,
  };

  const softGates = computeSoftGates(vigor);

  return {
    playerId: row.player_id,
    username: row.username,
    timezone: row.timezone,
    vigor,
    caps: {
      pv_cap: row.pv_cap,
      mv_cap: row.mv_cap,
      sv_cap: row.sv_cap,
      cv_cap: row.cv_cap,
      spv_cap: row.spv_cap,
    },
    sleepState: row.sleep_state,
    housingTier: row.housing_tier,
    balanceCents,
    balanceFormatted: formatBlueth(balanceCents),
    skills: row.skills,
    activeBuffs: row.active_buffs ?? [],
    mealsEatenToday: row.meal_day_count,
    mealPenaltyLevel: row.meal_penalty_level,
    pendingActions: parseInt(row.pending_count, 10),
    updatedAt: row.updated_at,
    nextDailyReset: nextMidnight.toISO()!,
    localTime: now.toISO()!,
    secondsUntilDailyReset,
    softGates,
  };
}
