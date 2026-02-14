import { queryOne, query } from '@blueth/db';
import { submitAction } from '../src/services/action-engine';
import { runSchedulerIteration } from '../src/services/scheduler-worker';
import { cleanDatabase, teardown } from './helpers/setup';
import { createTestServer, registerTestPlayer } from './helpers/factories';

describe('scheduler worker', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await teardown();
  });

  it('executes scheduled action exactly once under concurrency', async () => {
    const server = await createTestServer();
    const { playerId } = await registerTestPlayer(server);

    const action = await submitAction({
      playerId,
      type: 'LEISURE',
      payload: {},
      idempotencyKey: `sched-${Date.now()}`,
    });

    await query(
      `UPDATE actions
       SET scheduled_for = NOW() - INTERVAL '2 hours'
       WHERE action_id = $1`,
      [action.actionId]
    );

    await Promise.all([runSchedulerIteration({ batchSize: 10 }), runSchedulerIteration({ batchSize: 10 })]);

    const actionRow = await queryOne<{ status: string }>(
      'SELECT status FROM actions WHERE action_id = $1',
      [action.actionId]
    );
    const buffCount = await queryOne<{ count: string }>(
      `SELECT jsonb_array_length(active_buffs) AS count
       FROM player_state
       WHERE player_id = $1`,
      [playerId]
    );

    expect(actionRow?.status).toBe('completed');
    expect(parseInt(buffCount?.count ?? '0', 10)).toBe(1);

    await server.close();
  });
});
