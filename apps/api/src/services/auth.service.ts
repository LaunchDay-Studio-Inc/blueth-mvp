import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { withTransaction, queryOne, transferCents } from '@blueth/db';
import { SYSTEM_ACCOUNTS, ValidationError, DomainError } from '@blueth/core';
import type { PoolClient } from 'pg';

const BCRYPT_ROUNDS = 12;
const SESSION_DURATION_DAYS = 7;
const GUEST_TOKEN_DURATION_DAYS = 30;

export interface AuthResult {
  sessionId: string;
  playerId: string;
  username: string;
}

export interface GuestAuthResult {
  token: string;
  playerId: string;
  username: string;
}

/**
 * Helper: query one row on a transaction client.
 */
async function txQueryOne<T>(tx: PoolClient, text: string, params: unknown[]): Promise<T | null> {
  const { rows } = await tx.query(text, params);
  return (rows[0] as T) ?? null;
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Shared player bootstrap: create player, state, ledger, wallet, initial grant.
 * Returns player id.
 */
async function bootstrapPlayer(tx: PoolClient, username: string, passwordHash: string): Promise<string> {
  const player = await txQueryOne<{ id: string }>(
    tx,
    'INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id',
    [username, passwordHash]
  );
  if (!player) throw new Error('Failed to create player');

  await tx.query(
    'INSERT INTO player_state (player_id, housing_tier) VALUES ($1, 1)',
    [player.id]
  );

  const account = await txQueryOne<{ id: string }>(
    tx,
    `INSERT INTO ledger_accounts (owner_type, owner_id, currency)
     VALUES ('player', $1, 'BCE') RETURNING id`,
    [player.id]
  );
  if (!account) throw new Error('Failed to create ledger account');
  const accountId = parseInt(account.id, 10);

  await tx.query(
    'INSERT INTO player_wallets (player_id, account_id) VALUES ($1, $2)',
    [player.id, accountId]
  );

  await transferCents(
    tx,
    SYSTEM_ACCOUNTS.INITIAL_GRANT,
    accountId,
    50000,
    'initial_grant',
    null,
    'New player starting grant: ₿500.00'
  );

  return player.id;
}

/**
 * Register a new player with full bootstrap + cookie session.
 */
export async function register(username: string, password: string): Promise<AuthResult> {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  return withTransaction(async (tx) => {
    const existingPlayer = await txQueryOne<{ id: string }>(
      tx,
      'SELECT id FROM players WHERE username = $1',
      [username]
    );
    if (existingPlayer) {
      throw new ValidationError(`Username "${username}" is already taken`);
    }

    const playerId = await bootstrapPlayer(tx, username, hash);

    const session = await txQueryOne<{ id: string }>(
      tx,
      `INSERT INTO sessions (player_id, expires_at)
       VALUES ($1, NOW() + INTERVAL '${SESSION_DURATION_DAYS} days')
       RETURNING id`,
      [playerId]
    );
    if (!session) throw new Error('Failed to create session');

    return {
      sessionId: session.id,
      playerId,
      username,
    };
  });
}

/**
 * Register a guest player with a Bearer token (no password required).
 * Used for itch.io / cross-origin play.
 */
export async function guestRegister(): Promise<GuestAuthResult> {
  const randomHex = crypto.randomBytes(12).toString('hex');
  const username = `guest_${randomHex}`;
  const placeholderHash = await bcrypt.hash(crypto.randomUUID(), BCRYPT_ROUNDS);
  const rawToken = crypto.randomUUID();
  const tokenHash = hashToken(rawToken);

  try {
    return await withTransaction(async (tx) => {
      const playerId = await bootstrapPlayer(tx, username, placeholderHash);

      await tx.query(
        `INSERT INTO guest_tokens (player_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '${GUEST_TOKEN_DURATION_DAYS} days')`,
        [playerId, tokenHash]
      );

      return {
        token: rawToken,
        playerId,
        username,
      };
    });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      throw new ValidationError('Guest registration conflict — please retry');
    }
    throw err;
  }
}

/**
 * Login with username/password. Returns a new session.
 */
export async function login(username: string, password: string): Promise<AuthResult> {
  const player = await queryOne<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM players WHERE username = $1',
    [username]
  );

  if (!player) {
    throw new DomainError('UNAUTHORIZED', 'Invalid username or password', 401);
  }

  const valid = await bcrypt.compare(password, player.password_hash);
  if (!valid) {
    throw new DomainError('UNAUTHORIZED', 'Invalid username or password', 401);
  }

  // Create new session
  const session = await queryOne<{ id: string }>(
    `INSERT INTO sessions (player_id, expires_at)
     VALUES ($1, NOW() + INTERVAL '${SESSION_DURATION_DAYS} days')
     RETURNING id`,
    [player.id]
  );
  if (!session) throw new Error('Failed to create session');

  return {
    sessionId: session.id,
    playerId: player.id,
    username,
  };
}

/**
 * Logout by deleting the session.
 */
export async function logout(sessionId: string): Promise<void> {
  await queryOne('DELETE FROM sessions WHERE id = $1', [sessionId]);
}
