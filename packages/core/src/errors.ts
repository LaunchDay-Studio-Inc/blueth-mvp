/**
 * Domain error taxonomy for Blueth City.
 *
 * All domain functions throw a typed DomainError subclass on failure.
 * The API layer catches these and maps to appropriate HTTP status codes.
 *
 * Error code convention: SCREAMING_SNAKE matching the class name,
 * e.g. InsufficientFundsError -> 'INSUFFICIENT_FUNDS'.
 */

export class DomainError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** Input validation failed (bad types, out of range, malformed). */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
  }
}

/** Player/account does not have enough BCE cents for the operation. */
export class InsufficientFundsError extends DomainError {
  public readonly required: number;
  public readonly available: number;

  constructor(required: number, available: number) {
    super(
      'INSUFFICIENT_FUNDS',
      `Insufficient funds: need ${required} cents, have ${available} cents`,
      400
    );
    this.required = required;
    this.available = available;
  }
}

/** Inventory does not have enough of a good for the operation. */
export class InsufficientInventoryError extends DomainError {
  public readonly goodCode: string;
  public readonly required: number;
  public readonly available: number;

  constructor(goodCode: string, required: number, available: number) {
    super(
      'INSUFFICIENT_INVENTORY',
      `Insufficient ${goodCode}: need ${required}, have ${available}`,
      400
    );
    this.goodCode = goodCode;
    this.required = required;
    this.available = available;
  }
}

/** Player has too many actions in queue (rate limit / anti-spam). */
export class QueueLimitError extends DomainError {
  constructor(limit: number) {
    super('QUEUE_LIMIT', `Action queue full: maximum ${limit} pending actions`, 429);
  }
}

/** Action conflicts with a currently running or scheduled action. */
export class ActionConflictError extends DomainError {
  constructor(message = 'Action conflicts with an existing action') {
    super('ACTION_CONFLICT', message, 409);
  }
}

/** Market is halted (circuit breaker) for a specific good. */
export class MarketHaltedError extends DomainError {
  public readonly goodCode: string;
  public readonly haltedUntil: Date;

  constructor(goodCode: string, haltedUntil: Date) {
    super(
      'MARKET_HALTED',
      `Market halted for ${goodCode} until ${haltedUntil.toISOString()}`,
      503
    );
    this.goodCode = goodCode;
    this.haltedUntil = haltedUntil;
  }
}

/** Player's vigor is too low to perform the action. */
export class InsufficientVigorError extends DomainError {
  public readonly dimension: string;
  public readonly required: number;
  public readonly available: number;

  constructor(dimension: string, required: number, available: number) {
    super(
      'INSUFFICIENT_VIGOR',
      `Insufficient ${dimension} vigor: need ${required}, have ${available}`,
      400
    );
    this.dimension = dimension;
    this.required = required;
    this.available = available;
  }
}

/** Attempted action on something that doesn't exist. */
export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} not found: ${id}`, 404);
  }
}

/** Idempotency key collision — action already executed. */
export class IdempotencyConflictError extends DomainError {
  constructor(key: string) {
    super('IDEMPOTENCY_CONFLICT', `Action already executed with key: ${key}`, 409);
  }
}
