import { readFileSync } from 'fs';
import { join } from 'path';

let version = '0.0.0';
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
  version = pkg.version || '0.0.0';
} catch {
  // Running from a bundled context or package.json not found; leave default
}

export const APP_VERSION = version;
export const GIT_COMMIT = process.env.GIT_COMMIT || 'unknown';
