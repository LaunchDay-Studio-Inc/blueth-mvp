import { ValidationError, InsufficientFundsError } from './errors';

/**
 * Money model — all money is INTEGER CENTS. 1 BCE = 100 cents.
 *
 * MoneyCents is a branded type alias (runtime is just number).
 * Every function enforces integers and never returns fractional values.
 */

export type MoneyCents = number;

/**
 * Assert that a value is a valid integer-cent amount.
 * Throws ValidationError if not.
 */
export function assertCents(value: number, label = 'amount'): asserts value is MoneyCents {
  if (!Number.isFinite(value)) {
    throw new ValidationError(`${label} must be a finite number, got ${value}`);
  }
  if (!Number.isInteger(value)) {
    throw new ValidationError(`${label} must be an integer (cents), got ${value}`);
  }
}

/**
 * Assert that a MoneyCents value is non-negative.
 */
export function assertNonNegativeCents(
  value: number,
  label = 'amount'
): asserts value is MoneyCents {
  assertCents(value, label);
  if (value < 0) {
    throw new ValidationError(`${label} must be non-negative, got ${value}`);
  }
}

/**
 * Add two MoneyCents values. Both must be integers.
 * Returns integer cents.
 */
export function addMoney(a: MoneyCents, b: MoneyCents): MoneyCents {
  assertCents(a, 'addMoney.a');
  assertCents(b, 'addMoney.b');
  return a + b;
}

/**
 * Subtract b from a. Both must be integers.
 * Returns integer cents (may be negative — use clampNonNegative or
 * assertSufficientFunds if you need non-negative).
 */
export function subMoney(a: MoneyCents, b: MoneyCents): MoneyCents {
  assertCents(a, 'subMoney.a');
  assertCents(b, 'subMoney.b');
  return a - b;
}

/**
 * Clamp a MoneyCents value to >= 0.
 * Use this for "best-effort" flows where negative is silently floored.
 */
export function clampNonNegative(value: MoneyCents): MoneyCents {
  assertCents(value, 'clampNonNegative');
  return Math.max(0, value);
}

/**
 * Assert that `available` >= `required`.
 * Throws InsufficientFundsError if not.
 */
export function assertSufficientFunds(required: MoneyCents, available: MoneyCents): void {
  assertNonNegativeCents(required, 'required');
  assertCents(available, 'available');
  if (available < required) {
    throw new InsufficientFundsError(required, available);
  }
}

/**
 * Format integer cents as a Blueth currency string.
 *
 * Examples:
 *   formatBlueth(12345) -> "₿123.45"
 *   formatBlueth(100)   -> "₿1.00"
 *   formatBlueth(7)     -> "₿0.07"
 *   formatBlueth(0)     -> "₿0.00"
 *   formatBlueth(-500)  -> "-₿5.00"
 */
export function formatBlueth(cents: MoneyCents): string {
  assertCents(cents, 'formatBlueth');
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const formatted = `₿${whole}.${frac.toString().padStart(2, '0')}`;
  return negative ? `-${formatted}` : formatted;
}

/**
 * Parse a Blueth currency string or plain number string into integer cents.
 * Accepts:
 *   "₿123.45" -> 12345
 *   "123.45"  -> 12345
 *   "100"     -> 10000
 *   "0.07"    -> 7
 *
 * Throws ValidationError on unparseable input.
 */
export function parseBlueth(input: string): MoneyCents {
  const cleaned = input.trim().replace(/^-?₿/, '');
  const negative = input.trim().startsWith('-');

  const parts = cleaned.split('.');
  if (parts.length > 2) {
    throw new ValidationError(`Cannot parse money: "${input}"`);
  }

  const wholePart = parts[0];
  const fracPart = parts[1] ?? '';

  if (!/^\d+$/.test(wholePart) || (fracPart && !/^\d{1,2}$/.test(fracPart))) {
    throw new ValidationError(`Cannot parse money: "${input}"`);
  }

  const whole = parseInt(wholePart, 10);
  const frac = fracPart ? parseInt(fracPart.padEnd(2, '0'), 10) : 0;
  const cents = whole * 100 + frac;

  return negative ? -cents : cents;
}
