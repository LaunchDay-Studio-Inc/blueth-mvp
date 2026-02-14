import { closePool } from '@blueth/db';
import { startSchedulerWorker } from '../services/scheduler-worker';

const intervalMs = parseInt(process.env.SCHEDULER_INTERVAL_MS ?? '5000', 10);

startSchedulerWorker(intervalMs).catch(async (error) => {
  console.error('scheduler worker crashed', error);
  await closePool();
  process.exit(1);
});
