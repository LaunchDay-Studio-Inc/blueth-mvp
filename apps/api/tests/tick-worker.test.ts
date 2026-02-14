import { queryOne } from '@blueth/db';
import { runTickWorkerIteration } from '../src/services/tick-worker';
import { cleanDatabase, teardown } from './helpers/setup';
import { createTestServer, registerTestPlayer } from './helpers/factories';

describe('tick worker', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await teardown();
  });

  it('is idempotent when rerunning the same tick window', async () => {
    const server = await createTestServer();
    const { playerId } = await registerTestPlayer(server);

    const now = new Date('2026-01-05T12:45:00.000Z');

    await runTickWorkerIteration(now);

    const firstState = await queryOne<{
      pv: number;
      mv: number;
      sv: number;
      cv: number;
      spv: number;
      meal_day_count: number;
      meal_penalty_level: number;
      last_daily_reset: string | null;
    }>('SELECT pv, mv, sv, cv, spv, meal_day_count, meal_penalty_level, last_daily_reset FROM player_state WHERE player_id = $1', [playerId]);

    const firstTickCount = await queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM ticks');

    await runTickWorkerIteration(now);

    const secondState = await queryOne<{
      pv: number;
      mv: number;
      sv: number;
      cv: number;
      spv: number;
      meal_day_count: number;
      meal_penalty_level: number;
      last_daily_reset: string | null;
    }>('SELECT pv, mv, sv, cv, spv, meal_day_count, meal_penalty_level, last_daily_reset FROM player_state WHERE player_id = $1', [playerId]);

    const secondTickCount = await queryOne<{ count: string }>('SELECT COUNT(*)::text AS count FROM ticks');

    expect(secondState).toEqual(firstState);
    expect(secondTickCount?.count).toBe(firstTickCount?.count);

    await server.close();
  });
});
