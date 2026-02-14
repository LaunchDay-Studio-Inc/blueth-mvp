import { closePool } from '@blueth/db';
import { startTickWorker } from '../services/tick-worker';

const intervalMs = parseInt(process.env.TICK_INTERVAL_MS ?? '60000', 10);

startTickWorker(intervalMs).catch(async (error) => {
  console.error('tick worker crashed', error);
  await closePool();
  process.exit(1);
});
