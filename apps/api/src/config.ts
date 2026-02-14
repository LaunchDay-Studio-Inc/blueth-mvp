/**
 * Config sanity check — fails fast if required env vars are missing.
 * Prints a safe summary (no secrets) at startup.
 */

interface ConfigIssue {
  level: 'error' | 'warn';
  message: string;
}

function maskDatabaseUrl(url: string): string {
  try {
    return url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
  } catch {
    return '(invalid URL)';
  }
}

export function validateConfig(): void {
  const issues: ConfigIssue[] = [];
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  // Required
  if (!process.env.DATABASE_URL) {
    issues.push({ level: 'error', message: 'DATABASE_URL is not set.' });
  }

  // Recommended in production
  if (isProd && !process.env.ALLOWED_ORIGINS) {
    issues.push({ level: 'warn', message: 'ALLOWED_ORIGINS is not set. CORS will reject all cross-origin requests in production.' });
  }

  // Print summary
  const dbUrl = process.env.DATABASE_URL || '(not set)';
  console.log('\n=== Blueth City — Config Summary ===');
  console.log(`  NODE_ENV:       ${nodeEnv}`);
  console.log(`  PORT:           ${process.env.PORT || '3001'}`);
  console.log(`  HOST:           ${process.env.HOST || '0.0.0.0'}`);
  console.log(`  DATABASE_URL:   ${maskDatabaseUrl(dbUrl)}`);
  console.log(`  ALLOWED_ORIGINS: ${process.env.ALLOWED_ORIGINS || '(not set)'}`);
  console.log(`  LOG_LEVEL:      ${process.env.LOG_LEVEL || '(default)'}`);
  console.log('');

  // Report issues
  for (const issue of issues) {
    if (issue.level === 'error') {
      console.error(`[CONFIG ERROR] ${issue.message}`);
    } else {
      console.warn(`[CONFIG WARN]  ${issue.message}`);
    }
  }

  const errors = issues.filter((i) => i.level === 'error');
  if (errors.length > 0) {
    console.error(`\nAborting: ${errors.length} config error(s). Fix the above and restart.\n`);
    process.exit(1);
  }

  if (issues.length > 0) {
    console.log('');
  }
}
