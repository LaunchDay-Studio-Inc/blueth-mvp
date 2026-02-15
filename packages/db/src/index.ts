import { Pool, PoolClient, QueryResultRow } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://blueth:blueth_dev_password@localhost:5432/blueth_city';

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
});

/**
 * Execute a query, returning all rows typed as T.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

/**
 * Execute a query, returning the first row or null.
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await pool.query<T>(text, params);
  return result.rows[0] ?? null;
}

/**
 * Execute a statement that returns no rows (INSERT/UPDATE/DELETE).
 * Returns the number of affected rows.
 */
export async function execute(text: string, params?: unknown[]): Promise<number> {
  const result = await pool.query(text, params);
  return result.rowCount ?? 0;
}

/**
 * Run a callback inside a database transaction.
 * Automatically rolls back on error.
 *
 * Usage:
 *   const result = await withTransaction(async (tx) => {
 *     await tx.query('INSERT INTO ...');
 *     await tx.query('UPDATE ...');
 *     return someValue;
 *   });
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Calculate the balance for a ledger account.
 * Balance = SUM(credits received) - SUM(debits sent).
 * Returns integer cents.
 */
export async function getAccountBalance(accountId: number): Promise<number> {
  const row = await queryOne<{ balance: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN to_account = $1 THEN amount_cents ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN from_account = $1 THEN amount_cents ELSE 0 END), 0)
       AS balance
     FROM ledger_entries
     WHERE from_account = $1 OR to_account = $1`,
    [accountId]
  );
  return parseInt(row?.balance ?? '0', 10);
}

/**
 * Get a player's BCE balance via their wallet.
 * Returns integer cents.
 */
export async function getPlayerBalance(playerId: string): Promise<number> {
  const wallet = await queryOne<{ account_id: number }>(
    'SELECT account_id FROM player_wallets WHERE player_id = $1',
    [playerId]
  );
  if (!wallet) return 0;
  return getAccountBalance(wallet.account_id);
}

/**
 * Transfer money between two ledger accounts within a transaction.
 * Caller must provide the PoolClient from withTransaction().
 *
 * INVARIANT: amount_cents must be a positive integer.
 * INVARIANT: from_account !== to_account (enforced by DB CHECK).
 */
export async function transferCents(
  tx: PoolClient,
  fromAccount: number,
  toAccount: number,
  amountCents: number,
  entryType: string,
  actionId: string | null,
  memo?: string
): Promise<void> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error(`transferCents: amount must be a positive integer, got ${amountCents}`);
  }
  if (fromAccount === toAccount) {
    throw new Error('transferCents: from_account and to_account must differ');
  }

  await tx.query(
    `INSERT INTO ledger_entries (action_id, from_account, to_account, amount_cents, entry_type, memo)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actionId, fromAccount, toAccount, amountCents, entryType, memo ?? null]
  );
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export { withRetry, isTransientError } from './retry';
export type { RetryOptions } from './retry';
