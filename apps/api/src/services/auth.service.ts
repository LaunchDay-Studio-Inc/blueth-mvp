import bcrypt from 'bcryptjs';
import { withTransaction, queryOne, transferCents } from '@blueth/db';
import { SYSTEM_ACCOUNTS, ValidationError, DomainError } from '@blueth/core';
import type { PoolClient } from 'pg';

const BCRYPT_ROUNDS = 12;
const SESSION_DURATION_DAYS = 7;

export interface AuthResult {
  sessionId: string;
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

/**
 * Register a new player with full bootstrap:
 * 1. Create player row (username + bcrypt hash)
 * 2. Create player_state (vigor 100, housing_tier 1, default skills)
 * 3. Create ledger account + wallet
 * 4. Initial grant ₿500 (50000 cents) from INITIAL_GRANT system account
 * 5. Create session
 */
export async function register(username: string, password: string): Promise<AuthResult> {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  return withTransaction(async (tx) => {
    // Check if username already exists
    const existingPlayer = await txQueryOne<{ id: string }>(
      tx,
      'SELECT id FROM players WHERE username = $1',
      [username]
    );
    if (existingPlayer) {
      throw new ValidationError(`Username "${username}" is already taken`);
    }

    // 1. Create player
    const player = await txQueryOne<{ id: string }>(
      tx,
      'INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id',
      [username, hash]
    );
    if (!player) throw new Error('Failed to create player');

    // 2. Create player_state with housing_tier=1 (Cheap Room for enjoyable day-1 loop)
    await tx.query(
      'INSERT INTO player_state (player_id, housing_tier) VALUES ($1, 1)',
      [player.id]
    );

    // 3. Create ledger account + wallet
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

    // 4. Initial grant: ₿500 (50000 cents)
    await transferCents(
      tx,
      SYSTEM_ACCOUNTS.INITIAL_GRANT, // 6
      accountId,
      50000,
      'initial_grant',
      null,
      'New player starting grant: ₿500.00'
    );

    // 5. Create session
    const session = await txQueryOne<{ id: string }>(
      tx,
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
  });
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
