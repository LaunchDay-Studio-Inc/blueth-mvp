import { withTransaction, query } from '@blueth/db';
import { applyDailyReset, applyHourlyVigorTick } from '@blueth/core';
import type { Buff, SkillSet, SleepState } from '@blueth/core';
import { incrementMetric, logEvent, withTiming } from './observability';

const CATCHUP_HOURS = 48;
const PLAYER_BATCH_SIZE = 100;

type TickType = 'hourly' | 'six_hourly';

interface PlayerTickRow {
  player_id: string;
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
  active_buffs: Buff[];
  meal_penalty_level: number;
  meal_day_count: number;
  last_meal_times: string[];
  last_daily_reset: string | null;
  skills: SkillSet;
}

function floorHour(date: Date): Date {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

function floorSixHours(date: Date): Date {
  const d = floorHour(date);
  const hour = d.getUTCHours();
  d.setUTCHours(hour - (hour % 6));
  return d;
}

async function claimGlobalTick(tickType: TickType, tickTimestamp: Date): Promise<boolean> {
  return withTransaction(async (tx) => {
    const locked = await tx.query(
      `WITH candidate AS (
         SELECT tick_id
         FROM ticks
         WHERE tick_type = $1
           AND tick_timestamp = $2
           AND status = 'pending'
         FOR UPDATE SKIP LOCKED
       )
       UPDATE ticks t
       SET status = 'running', started_at = NOW(), finished_at = NULL
       FROM candidate c
       WHERE t.tick_id = c.tick_id
       RETURNING t.tick_id`,
      [tickType, tickTimestamp.toISOString()]
    );

    if (locked.rowCount && locked.rowCount > 0) {
      return true;
    }

    const inserted = await tx.query(
      `INSERT INTO ticks (tick_type, tick_timestamp, status, started_at)
       VALUES ($1, $2, 'running', NOW())
       ON CONFLICT (tick_type, tick_timestamp) DO NOTHING
       RETURNING tick_id`,
      [tickType, tickTimestamp.toISOString()]
    );

    return Boolean(inserted.rowCount && inserted.rowCount > 0);
  });
}

async function completeTick(tickType: string, tickTimestamp: Date, detail: Record<string, unknown>): Promise<void> {
  await query(
    `UPDATE ticks
     SET status = 'completed', finished_at = NOW(), detail = $3
     WHERE tick_type = $1 AND tick_timestamp = $2`,
    [tickType, tickTimestamp.toISOString(), JSON.stringify(detail)]
  );
}

async function failTick(tickType: string, tickTimestamp: Date, error: string): Promise<void> {
  await query(
    `UPDATE ticks
     SET status = 'failed', finished_at = NOW(), detail = $3
     WHERE tick_type = $1 AND tick_timestamp = $2`,
    [tickType, tickTimestamp.toISOString(), JSON.stringify({ error })]
  );
}

async function processHourlyTick(tickTimestamp: Date): Promise<void> {
  let cursor = '00000000-0000-0000-0000-000000000000';
  while (true) {
    const players = await query<PlayerTickRow>(
      `SELECT p.id AS player_id, p.timezone, ps.*
       FROM players p
       JOIN player_state ps ON ps.player_id = p.id
       WHERE p.id > $1
       ORDER BY p.id
       LIMIT $2`,
      [cursor, PLAYER_BATCH_SIZE]
    );

    if (players.length === 0) break;

    for (const player of players) {
      await withTransaction(async (tx) => {
        const locked = await tx.query<PlayerTickRow>(
          `SELECT p.id AS player_id, p.timezone, ps.*
           FROM players p
           JOIN player_state ps ON ps.player_id = p.id
           WHERE p.id = $1
           FOR UPDATE OF ps`,
          [player.player_id]
        );
        const row = locked.rows[0];
        if (!row) return;

        const result = applyHourlyVigorTick(
          {
            vigor: { pv: row.pv, mv: row.mv, sv: row.sv, cv: row.cv, spv: row.spv },
            caps: {
              pv_cap: row.pv_cap,
              mv_cap: row.mv_cap,
              sv_cap: row.sv_cap,
              cv_cap: row.cv_cap,
              spv_cap: row.spv_cap,
            },
            sleepState: row.sleep_state,
            activeBuffs: row.active_buffs ?? [],
            mealPenaltyLevel: row.meal_penalty_level,
            mealsEatenToday: row.meal_day_count,
            lastMealTimes: row.last_meal_times ?? [],
            lastDailyResetLocalDate: row.last_daily_reset ?? '1970-01-01',
          },
          tickTimestamp,
          row.timezone
        );

        const vigor = result.newState.vigor;
        await tx.query(
          `UPDATE player_state
           SET pv = $2,
               mv = $3,
               sv = $4,
               cv = $5,
               spv = $6,
               active_buffs = $7
           WHERE player_id = $1`,
          [
            row.player_id,
            vigor.pv,
            vigor.mv,
            vigor.sv,
            vigor.cv,
            vigor.spv,
            JSON.stringify(result.newState.activeBuffs),
          ]
        );

        logEvent('hourly_player_tick', {
          player_id: row.player_id,
          tick_type: 'hourly',
          tick_timestamp: tickTimestamp.toISOString(),
        });
      });
    }

    cursor = players[players.length - 1].player_id;
  }

  incrementMetric('ticks.hourly.completed');
}

async function processSixHourlyTick(tickTimestamp: Date): Promise<void> {
  logEvent('six_hourly_tick', {
    tick_type: 'six_hourly',
    tick_timestamp: tickTimestamp.toISOString(),
    message: 'NPC market refresh framework placeholder',
  });
  incrementMetric('ticks.six_hourly.completed');
}

async function processDailyTickBatch(): Promise<number> {
  return withTransaction(async (tx) => {
    const duePlayers = await tx.query<{
      player_id: string;
      timezone: string;
      local_today: string;
      local_midnight_utc: string;
      meal_day_count: number;
      meal_penalty_level: number;
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
      active_buffs: Buff[];
      last_meal_times: string[];
    }>(
      `SELECT p.id AS player_id,
              p.timezone,
              (NOW() AT TIME ZONE p.timezone)::date::text AS local_today,
              (date_trunc('day', NOW() AT TIME ZONE p.timezone) AT TIME ZONE p.timezone) AS local_midnight_utc,
              ps.meal_day_count,
              ps.meal_penalty_level,
              ps.pv,
              ps.mv,
              ps.sv,
              ps.cv,
              ps.spv,
              ps.pv_cap,
              ps.mv_cap,
              ps.sv_cap,
              ps.cv_cap,
              ps.spv_cap,
              ps.sleep_state,
              ps.active_buffs,
              ps.last_meal_times
       FROM players p
       JOIN player_state ps ON ps.player_id = p.id
       WHERE (NOW() AT TIME ZONE p.timezone)::date > COALESCE(ps.last_daily_reset, DATE '1970-01-01')
       ORDER BY p.id
       LIMIT $1
       FOR UPDATE OF ps SKIP LOCKED`,
      [PLAYER_BATCH_SIZE]
    );

    for (const player of duePlayers.rows) {
      const tickType = `daily:${player.player_id}`;
      const tickTimestamp = new Date(player.local_midnight_utc);

      const claimed = await tx.query(
        `INSERT INTO ticks (tick_type, tick_timestamp, status, started_at)
         VALUES ($1, $2, 'running', NOW())
         ON CONFLICT (tick_type, tick_timestamp) DO NOTHING
         RETURNING tick_id`,
        [tickType, tickTimestamp.toISOString()]
      );
      if (!claimed.rowCount) {
        continue;
      }

      const reset = applyDailyReset(
        {
          vigor: {
            pv: player.pv,
            mv: player.mv,
            sv: player.sv,
            cv: player.cv,
            spv: player.spv,
          },
          caps: {
            pv_cap: player.pv_cap,
            mv_cap: player.mv_cap,
            sv_cap: player.sv_cap,
            cv_cap: player.cv_cap,
            spv_cap: player.spv_cap,
          },
          sleepState: player.sleep_state,
          activeBuffs: player.active_buffs ?? [],
          mealPenaltyLevel: player.meal_penalty_level,
          mealsEatenToday: player.meal_day_count,
          lastMealTimes: player.last_meal_times ?? [],
          lastDailyResetLocalDate: player.local_today,
        },
        tickTimestamp
      );

      await tx.query(
        `UPDATE player_state
         SET pv = $2,
             mv = $3,
             sv = $4,
             cv = $5,
             spv = $6,
             meal_penalty_level = $7,
             meal_day_count = 0,
             last_meal_times = '[]'::jsonb,
             last_daily_reset = $8
         WHERE player_id = $1`,
        [
          player.player_id,
          reset.newState.vigor.pv,
          reset.newState.vigor.mv,
          reset.newState.vigor.sv,
          reset.newState.vigor.cv,
          reset.newState.vigor.spv,
          reset.newState.mealPenaltyLevel,
          player.local_today,
        ]
      );

      await tx.query(
        `INSERT INTO daily_summaries (player_id, summary_date, tick_timestamp, summary, rent_cents, utilities_cents)
         VALUES ($1, $2::date, $3, $4, 0, 0)
         ON CONFLICT (player_id, summary_date) DO NOTHING`,
        [player.player_id, player.local_today, tickTimestamp.toISOString(), reset.summary]
      );

      await tx.query(
        `UPDATE ticks
         SET status = 'completed', finished_at = NOW(), detail = $3
         WHERE tick_type = $1 AND tick_timestamp = $2`,
        [
          tickType,
          tickTimestamp.toISOString(),
          JSON.stringify({ player_id: player.player_id, tick_type: 'daily', tick_timestamp: tickTimestamp.toISOString() }),
        ]
      );

      logEvent('daily_player_tick', {
        player_id: player.player_id,
        tick_type: 'daily',
        tick_timestamp: tickTimestamp.toISOString(),
      });
    }

    return duePlayers.rowCount ?? 0;
  });
}

async function processDailyTicks(): Promise<void> {
  while (true) {
    const processed = await processDailyTickBatch();
    if (processed === 0) {
      break;
    }
  }
  incrementMetric('ticks.daily.completed');
}

async function processGlobalTick(tickType: TickType, tickTimestamp: Date): Promise<void> {
  const claimed = await claimGlobalTick(tickType, tickTimestamp);
  if (!claimed) return;

  try {
    if (tickType === 'hourly') {
      await processHourlyTick(tickTimestamp);
    } else {
      await processSixHourlyTick(tickTimestamp);
    }

    await completeTick(tickType, tickTimestamp, {
      tick_type: tickType,
      tick_timestamp: tickTimestamp.toISOString(),
    });
  } catch (error) {
    incrementMetric('ticks.failed');
    await failTick(tickType, tickTimestamp, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function processCatchup(now: Date): Promise<void> {
  const hourlyNow = floorHour(now);
  const start = new Date(hourlyNow.getTime() - CATCHUP_HOURS * 60 * 60 * 1000);

  for (let ts = new Date(start); ts <= hourlyNow; ts = new Date(ts.getTime() + 60 * 60 * 1000)) {
    await processGlobalTick('hourly', ts);
    if (ts.getUTCHours() % 6 === 0) {
      await processGlobalTick('six_hourly', floorSixHours(ts));
    }
  }
}

export async function runTickWorkerIteration(now = new Date()): Promise<void> {
  await withTiming('ticks.iteration', async () => {
    await processCatchup(now);
    await processDailyTicks();
  });
}

export async function startTickWorker(intervalMs = 60_000): Promise<void> {
  while (true) {
    await runTickWorkerIteration();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
