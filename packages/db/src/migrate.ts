import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://blueth:blueth_dev_password@localhost:5432/blueth_city';

const pool = new Pool({ connectionString: DATABASE_URL });

interface MigrationRow {
  id: number;
  name: string;
  applied_at: Date;
}

async function createMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL       PRIMARY KEY,
      name        VARCHAR(255) NOT NULL UNIQUE,
      checksum    TEXT,
      applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<MigrationRow>(
    'SELECT name FROM _migrations ORDER BY id'
  );
  return new Set(result.rows.map((r) => r.name));
}

function computeChecksum(sql: string): string {
  // Simple DJB2 hash as hex — no crypto dependency needed for dev tooling
  let hash = 5381;
  for (let i = 0; i < sql.length; i++) {
    hash = ((hash << 5) + hash + sql.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(16);
}

async function applyMigration(name: string, sql: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO _migrations (name, checksum) VALUES ($1, $2)',
      [name, computeChecksum(sql)]
    );
    await client.query('COMMIT');
    console.log(`  [OK] ${name}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`  [FAIL] ${name}`);
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations(): Promise<void> {
  console.log(`\nBlueth City — Database Migrations`);
  console.log(`Database: ${DATABASE_URL.replace(/\/\/.*@/, '//***@')}\n`);

  try {
    await createMigrationsTable();

    const migrationsDir = path.join(__dirname, '../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found. Nothing to do.');
      return;
    }

    const applied = await getAppliedMigrations();
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log(`All ${files.length} migration(s) already applied. Up to date.`);
      return;
    }

    console.log(`${applied.size} applied, ${pending.length} pending:\n`);

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await applyMigration(file, sql);
    }

    console.log(`\nDone. Applied ${pending.length} migration(s).`);
  } catch (error) {
    console.error('\nMigration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Also export for programmatic use
export { runMigrations };

// Run when executed directly
if (require.main === module) {
  runMigrations();
}
