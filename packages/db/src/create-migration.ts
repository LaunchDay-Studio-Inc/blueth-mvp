import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: pnpm migrate:create <migration_name>');
  process.exit(1);
}

const migrationName = args.join('_').toLowerCase().replace(/[^a-z0-9_]/g, '_');
const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
const fileName = `${timestamp}_${migrationName}.sql`;

const migrationsDir = path.join(__dirname, '../migrations');
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

const filePath = path.join(migrationsDir, fileName);
const template = `-- Migration: ${migrationName}
-- Created: ${new Date().toISOString()}

-- Add your SQL here

`;

fs.writeFileSync(filePath, template);
console.log(`✓ Created migration: ${fileName}`);
