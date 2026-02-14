// PM2 Ecosystem Config — Blueth City
//
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 reload ecosystem.config.cjs
//   pm2 stop all
//
// Prerequisites:
//   1. pnpm install --frozen-lockfile && pnpm build
//   2. DATABASE_URL set in environment or .env sourced
//   3. Migrations applied: node packages/db/dist/migrate.js

module.exports = {
  apps: [
    {
      name: 'blueth-api',
      script: './apps/api/dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 1000,
      kill_timeout: 10000,
      // Logs go to stdout → journald / log collector
      merge_logs: true,
      out_file: '/dev/null',
      error_file: '/dev/null',
    },
    {
      name: 'blueth-scheduler',
      script: './apps/api/dist/workers/scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      exp_backoff_restart_delay: 1000,
      kill_timeout: 15000,
      merge_logs: true,
      out_file: '/dev/null',
      error_file: '/dev/null',
    },
    {
      name: 'blueth-tick',
      // CRITICAL: Only 1 instance. See README Deployment section.
      script: './apps/api/dist/workers/tick.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      exp_backoff_restart_delay: 1000,
      kill_timeout: 30000,
      merge_logs: true,
      out_file: '/dev/null',
      error_file: '/dev/null',
    },
  ],
};
