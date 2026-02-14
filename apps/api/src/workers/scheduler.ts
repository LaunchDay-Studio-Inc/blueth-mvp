/**
 * Scheduler Worker — Standalone process entry point.
 *
 * Polls for due scheduled actions and resolves them.
 * Run with: tsx src/workers/scheduler.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { validateConfig } from '../config';
import { createLogger, createMetrics } from '../services/observability';
import { runSchedulerIteration } from '../services/scheduler-service';
import { registerAllHandlers } from '../handlers/register-all';
import { closePool, withRetry } from '@blueth/db';

const POLL_INTERVAL_MS = parseInt(process.env.SCHEDULER_POLL_MS || '5000', 10);
const logger = createLogger('scheduler');
const metrics = createMetrics();
let running = true;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  validateConfig();
  registerAllHandlers();
  logger.info('Scheduler worker started', { pollIntervalMs: POLL_INTERVAL_MS });

  while (running) {
    try {
      const result = await withRetry(() => runSchedulerIteration(metrics));
      if (result.claimed > 0) {
        logger.info('Scheduler iteration complete', {
          claimed: result.claimed,
          resolved: result.resolved,
          failed: result.failed,
        });
      }
    } catch (err) {
      logger.error('Scheduler iteration failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    await sleep(POLL_INTERVAL_MS);
  }

  logger.info('Scheduler worker shutting down');
}

process.on('SIGTERM', () => { running = false; });
process.on('SIGINT', () => { running = false; });

main()
  .catch((err) => {
    logger.error('Fatal error', { error: String(err) });
    process.exit(1);
  })
  .finally(() => closePool());
