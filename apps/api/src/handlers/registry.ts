import type { PoolClient } from 'pg';
import type { SleepState, Buff, VigorDimension, VigorCaps } from '@blueth/core';
import type { SkillSet } from '@blueth/core';
import { ValidationError } from '@blueth/core';

// ── Player state row shape (from DB) ─────────────────────────

export interface PlayerStateRow {
  player_id: string;
  pv: number;
  mv: number;
  sv: number;
  cv: number;
  spv: number;
  pv_cap: number;
  mv_cap: number;
  sv_cap: number;
  cv_cap: number;
  spv_cap: number;
  sleep_state: SleepState;
  housing_tier: number;
  active_buffs: Buff[];
  skills: SkillSet;
  meal_day_count: number;
  meal_penalty_level: number;
  last_meal_times: string[];
  last_daily_reset: string | null;
  updated_at: string;
}

/** Extract VigorDimension from a DB row. */
export function extractVigor(row: PlayerStateRow): VigorDimension {
  return { pv: row.pv, mv: row.mv, sv: row.sv, cv: row.cv, spv: row.spv };
}

/** Extract VigorCaps from a DB row. */
export function extractCaps(row: PlayerStateRow): VigorCaps {
  return {
    pv_cap: row.pv_cap,
    mv_cap: row.mv_cap,
    sv_cap: row.sv_cap,
    cv_cap: row.cv_cap,
    spv_cap: row.spv_cap,
  };
}

// ── Context objects passed to handlers ────────────────────────

export interface SubmitContext<TPayload = unknown> {
  tx: PoolClient;
  playerId: string;
  payload: TPayload;
  playerState: PlayerStateRow;
}

export interface ResolveContext<TPayload = unknown> {
  tx: PoolClient;
  actionId: string;
  playerId: string;
  payload: TPayload;
  playerState: PlayerStateRow;
  playerAccountId: number;
}

// ── ActionHandler interface ──────────────────────────────────

export interface ActionHandler<TPayload = unknown> {
  /** Action type string (matches ACTION_TYPES constant). */
  readonly type: string;

  /** Compute duration in seconds from the validated payload. 0 = instant. */
  durationSeconds(payload: TPayload): number;

  /** Parse and validate the raw payload. Throws ValidationError on failure. */
  validatePayload(raw: unknown): TPayload;

  /**
   * Check preconditions against current player state.
   * Called both outside (fast fail) and inside (locked, authoritative) the transaction.
   * Throws DomainError subclasses on failure.
   */
  checkPreconditions(payload: TPayload, state: PlayerStateRow): void;

  /**
   * Optional: apply immediate side-effects on submit (inside submit transaction).
   * E.g., SLEEP sets sleep_state='sleeping' right away.
   */
  onSubmit?(ctx: SubmitContext<TPayload>): Promise<void>;

  /**
   * Execute the action's effects inside a resolution transaction.
   * Must update player_state, create ledger entries, etc.
   * Returns a result object stored as actions.result JSONB.
   */
  resolve(ctx: ResolveContext<TPayload>): Promise<unknown>;
}

// ── Handler registry ─────────────────────────────────────────

const handlers = new Map<string, ActionHandler>();

export function registerHandler(handler: ActionHandler): void {
  if (handlers.has(handler.type)) {
    throw new Error(`Action handler already registered for type: ${handler.type}`);
  }
  handlers.set(handler.type, handler);
}

export function getHandler(type: string): ActionHandler {
  const handler = handlers.get(type);
  if (!handler) {
    throw new ValidationError(`Unknown action type: ${type}`);
  }
  return handler;
}

export function hasHandler(type: string): boolean {
  return handlers.has(type);
}
