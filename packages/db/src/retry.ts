/**
 * Exponential backoff retry utility for transient DB errors.
 *
 * Retries on known transient error codes / messages:
 *   - ECONNRESET, ECONNREFUSED, ETIMEDOUT (network)
 *   - 57P01 (admin_shutdown), 57P03 (cannot_connect_now)
 *   - 40001 (serialization_failure)
 *
 * Non-transient errors are thrown immediately.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_MAX_RETRIES = 4;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  '57P01',  // admin_shutdown
  '57P03',  // cannot_connect_now
  '40001',  // serialization_failure
]);

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: string }).code;
  if (code && TRANSIENT_CODES.has(code)) return true;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('connection terminated unexpectedly')
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelay = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isTransientError(err) || attempt === maxRetries) {
        throw err;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw lastError;
}

export { isTransientError };
