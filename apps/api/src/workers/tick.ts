/**
 * Tick Worker — Standalone process entry point.
 *
 * Creates and processes game ticks (hourly, six-hourly, daily).
 * Run with: tsx src/workers/tick.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { validateConfig } from '../config';
import { createLogger, createMetrics } from '../services/observability';
import { runTickIteration } from '../services/tick-service';
import { registerAllHandlers } from '../handlers/register-all';
import { closePool, withRetry } from '@blueth/db';

const POLL_INTERVAL_MS = parseInt(process.env.TICK_POLL_MS || '10000', 10);
const logger = createLogger('tick');
const metrics = createMetrics();
let running = true;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  validateConfig();
  registerAllHandlers();
  logger.info('Tick worker started', { pollIntervalMs: POLL_INTERVAL_MS });

  while (running) {
    try {
      const ticksProcessed = await withRetry(() => runTickIteration(metrics));
      if (ticksProcessed > 0) {
        logger.info('Tick iteration complete', { ticksProcessed });
      }
    } catch (err) {
      logger.error('Tick iteration failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    await sleep(POLL_INTERVAL_MS);
  }

  logger.info('Tick worker shutting down');
}

process.on('SIGTERM', () => { running = false; });
process.on('SIGINT', () => { running = false; });

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: String(reason) });
  // Keep alive — do not exit
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — exiting', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});

main()
  .catch((err) => {
    logger.error('Fatal error', { error: String(err) });
    process.exit(1);
  })
  .finally(() => closePool());
