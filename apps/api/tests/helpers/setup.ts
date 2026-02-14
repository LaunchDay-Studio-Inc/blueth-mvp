import { pool } from '@blueth/db';

/**
 * Clean all player-generated data between tests.
 * Preserves system seed data (ledger_accounts id <= 6, goods, districts, etc.)
 */
export async function cleanDatabase(): Promise<void> {
  await pool.query(`
    DELETE FROM daily_summaries;
    DELETE FROM ticks;
    DELETE FROM actions;
    DELETE FROM sessions;
    DELETE FROM ledger_entries WHERE from_account > 6 OR to_account > 6;
    DELETE FROM player_wallets;
    DELETE FROM player_state;
    DELETE FROM players;
    DELETE FROM ledger_accounts WHERE id > 6;
  `);
}

/**
 * Shut down the connection pool (call in afterAll).
 */
export async function teardown(): Promise<void> {
  await pool.end();
}
