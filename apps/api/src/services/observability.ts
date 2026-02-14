export type MetricName =
  | 'scheduler.actions.claimed'
  | 'scheduler.actions.completed'
  | 'scheduler.actions.failed'
  | 'ticks.hourly.completed'
  | 'ticks.six_hourly.completed'
  | 'ticks.daily.completed'
  | 'ticks.failed';

const counters = new Map<MetricName, number>();

export function incrementMetric(name: MetricName, delta = 1): void {
  const previous = counters.get(name) ?? 0;
  counters.set(name, previous + delta);
}

export function getMetric(name: MetricName): number {
  return counters.get(name) ?? 0;
}

export function resetMetrics(): void {
  counters.clear();
}

export function withTiming<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  return fn().finally(() => {
    logEvent('metric_timing', { metric: name, duration_ms: Date.now() - start });
  });
}

export function logEvent(event: string, detail: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      event,
      ...detail,
      timestamp: new Date().toISOString(),
    })
  );
}
