/**
 * Observability — Structured logging + in-memory metrics for workers.
 *
 * Kept lightweight: JSON lines to stdout, Map-based counters.
 * No external dependencies.
 */

// ── Structured Logger ────────────────────────────────────────

export interface LogContext {
  worker?: string;
  tickType?: string;
  playerId?: string;
  actionId?: string;
  batchSize?: number;
  durationMs?: number;
  error?: string;
  [key: string]: unknown;
}

export interface Logger {
  info(msg: string, ctx?: LogContext): void;
  warn(msg: string, ctx?: LogContext): void;
  error(msg: string, ctx?: LogContext): void;
}

export function createLogger(workerName: string): Logger {
  function log(level: string, msg: string, ctx?: LogContext): void {
    const entry = {
      ts: new Date().toISOString(),
      level,
      worker: workerName,
      msg,
      ...ctx,
    };
    console.log(JSON.stringify(entry));
  }

  return {
    info: (msg, ctx) => log('info', msg, ctx),
    warn: (msg, ctx) => log('warn', msg, ctx),
    error: (msg, ctx) => log('error', msg, ctx),
  };
}

// ── In-Memory Metrics ────────────────────────────────────────

export interface Metrics {
  increment(name: string, amount?: number): void;
  get(name: string): number;
  reset(): void;
  getAll(): Record<string, number>;
}

export function createMetrics(): Metrics {
  const counters = new Map<string, number>();

  return {
    increment(name: string, amount = 1): void {
      counters.set(name, (counters.get(name) ?? 0) + amount);
    },
    get(name: string): number {
      return counters.get(name) ?? 0;
    },
    reset(): void {
      counters.clear();
    },
    getAll(): Record<string, number> {
      const result: Record<string, number> = {};
      for (const [k, v] of counters) {
        result[k] = v;
      }
      return result;
    },
  };
}

// ── Timing Wrapper ───────────────────────────────────────────

export async function withTiming<T>(
  metrics: Metrics,
  metricName: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    metrics.increment(metricName, Date.now() - start);
  }
}
