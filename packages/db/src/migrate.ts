import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://blueth:blueth_dev_password@localhost:5432/blueth_city',
});

interface Migration {
  id: number;
  name: string;
  appliedAt: Date;
}

async function createMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(): Promise<Migration[]> {
  const result = await pool.query<Migration>(
    'SELECT id, name, applied_at as "appliedAt" FROM migrations ORDER BY id'
  );
  return result.rows;
}

async function applyMigration(name: string, sql: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO migrations (name) VALUES ($1)', [name]);
    await client.query('COMMIT');
    console.log(`✓ Applied migration: ${name}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations(): Promise<void> {
  try {
    await createMigrationsTable();

    const migrationsDir = path.join(__dirname, '../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found');
      return;
    }

    const appliedMigrations = await getAppliedMigrations();
    const appliedNames = new Set(appliedMigrations.map(m => m.name));

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let appliedCount = 0;
    for (const file of migrationFiles) {
      if (!appliedNames.has(file)) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        await applyMigration(file, sql);
        appliedCount++;
      }
    }

    if (appliedCount === 0) {
      console.log('✓ All migrations up to date');
    } else {
      console.log(`✓ Applied ${appliedCount} migration(s)`);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
