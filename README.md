# Blueth City - MVP

**Clickable Map RPG Simulator**

A browser-based game focusing on Vigor management (5 dimensions) and Economy systems (jobs, goods, market dynamics). Built with a secure, failure-resistant architecture using PostgreSQL, Fastify, and Next.js.

## Architecture

This is a **pnpm monorepo** with:

- `apps/api` - Fastify backend with Zod validation, rate limiting, secure auth
- `apps/web` - Next.js frontend (App Router) with Tailwind CSS
- `packages/core` - Pure TypeScript domain logic (vigor, economy formulas) with unit tests
- `packages/db` - PostgreSQL migrations and typed query helpers

## MVP Systems

### ✅ Implemented (Core Focus)
1. **Vigor System**: 5 dimensions (Physical, Mental, Social, Creative, Spiritual) with hourly regeneration, action depletion, and cascade effects
2. **Economy System**: Jobs, goods catalog, dynamic market pricing, production costs, bills and money sinks

### 🔲 Stub Modules (Future)
- Politics & Governance
- Crime & Law Enforcement
- Health & Education
- Property & Housing

All stub systems have interfaces and placeholder routes but **ZERO gameplay impact** in MVP.

## Time Model

- **1 real hour = 1 game hour**
- Hourly tick (vigor regen, market updates)
- 6-hour tick (bills, production)
- Daily tick at local midnight (resets, maintenance)

## Prerequisites

- **Node.js** 20+ (use `nvm` with `.nvmrc`)
- **pnpm** 8+
- **Docker** and **Docker Compose** (for local PostgreSQL)

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Up Environment Variables

Copy the example files and update as needed:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/db/.env.example packages/db/.env
```

For local development, the defaults should work out of the box.

### 3. Start PostgreSQL

```bash
docker-compose up -d postgres
```

Wait for PostgreSQL to be healthy (check with `docker-compose ps`).

### 4. Run Database Migrations

```bash
pnpm db:migrate
```

This creates all tables, indexes, and seeds initial market data.

### 5. Start Development Servers

```bash
# Start both API and Web in parallel
pnpm dev

# Or start individually:
pnpm dev:api   # API on http://localhost:3001
pnpm dev:web   # Web on http://localhost:3000
```

Visit **http://localhost:3000** to see the landing page with API health status.

## Development Commands

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm test:core
```

### Type Checking

```bash
pnpm typecheck
```

### Linting & Formatting

```bash
# Lint all packages
pnpm lint

# Format code
pnpm format

# Check formatting
pnpm format:check
```

### Building

```bash
pnpm build
```

## Database Management

### Run Migrations

```bash
pnpm db:migrate
```

### Create New Migration

```bash
pnpm --filter @blueth/db migrate:create <migration_name>
```

This creates a timestamped SQL file in `packages/db/migrations/`.

### Database Schema

Migrations are in `packages/db/migrations/` and run in filename-sort order.

| Migration | Tables |
|---|---|
| `001_core.sql` | `players`, `player_state`, `actions`, `ticks` |
| `002_ledger.sql` | `ledger_accounts`, `player_wallets`, `ledger_entries` |
| `003_economy.sql` | `goods`, `inventories` |
| `004_market.sql` | `npc_market_state`, `market_orders`, `market_trades` |
| `005_businesses.sql` | `businesses`, `business_workers`, `recipes`, `recipe_inputs`, `recipe_outputs`, `production_jobs` |
| `006_world.sql` | `districts`, `locations` |
| `007_seed_data.sql` | Seed goods (9), recipes (2), districts (12), system ledger accounts (6), NPC market prices |
| `008_indexes.sql` | All performance indexes |

### Schema Invariants

**Money is integer cents.** 1 BCE = 100 cents. All money columns are `INT` or `BIGINT`. No `NUMERIC`, no `FLOAT`, no `REAL`. This eliminates floating-point rounding errors, makes equality comparisons safe, and matches how real payment systems work. Formatting to "₿12.34" is a display concern only.

**Double-entry ledger.** Every money movement creates a row in `ledger_entries` with `from_account` and `to_account`. The `amount_cents` column is always positive; direction is encoded by from/to. A CHECK constraint prevents self-transfers. System accounts (owner_type='system') act as sources (payroll) and sinks (taxes, bills). The global invariant `SUM(all credits) = SUM(all debits)` holds by construction.

**Player wallets.** Each player has exactly one `player_wallets` row mapping `player_id` to a `ledger_accounts.id`. Balance is derived: `SUM(credits to account) - SUM(debits from account)`. There is no denormalized balance column — the ledger is the source of truth.

**Exactly-once actions.** The `actions` table has `UNIQUE(player_id, idempotency_key)`. The API generates the idempotency key client-side (or deterministically from action parameters). Insert-or-return-existing in a single transaction guarantees exactly-once execution.

**Tick idempotency.** The `ticks` table has `UNIQUE(tick_type, tick_timestamp)`. The scheduler attempts an INSERT; conflict means the tick was already claimed. Status transitions (`pending` -> `running` -> `completed`/`failed`) prevent double-processing.

**Inventory quantities use NUMERIC(18,6).** Unlike money, physical goods can be fractional (recipes output 5.0 units, decay removes 0.1 units). This is explicitly *not* money — it's a physical quantity.

**All timestamps are TIMESTAMPTZ.** The `players.timezone` column (default `'Asia/Dubai'`) is used by application code to compute local midnight for daily ticks. The database stores everything in UTC.

## Project Structure

```
blueth-mvp/
├── apps/
│   ├── api/              # Fastify backend
│   │   ├── src/
│   │   │   ├── index.ts       # Server setup
│   │   │   └── routes/        # API routes
│   │   └── Dockerfile.dev
│   └── web/              # Next.js frontend
│       ├── src/app/           # App Router pages
│       └── Dockerfile.dev
├── packages/
│   ├── core/             # Domain logic
│   │   └── src/
│   │       ├── vigor.ts       # Vigor system formulas
│   │       ├── economy.ts     # Economy calculations
│   │       └── *.test.ts      # Unit tests
│   └── db/               # Database layer
│       ├── migrations/        # SQL migrations
│       └── src/
│           ├── index.ts       # Query helpers
│           └── migrate.ts     # Migration runner
├── docker-compose.yml    # Local services
├── pnpm-workspace.yaml   # Workspace config
└── package.json          # Root scripts
```

## API Endpoints

### Health Checks

- `GET /health` - Basic health check
- `GET /health/db` - Database connectivity check
- `GET /health/ready` - Readiness probe (all systems)

### Future Endpoints (To Be Implemented)

- `POST /auth/register` - Create account
- `POST /auth/login` - Authenticate
- `GET /player/state` - Get current vigor & balance
- `POST /actions/work` - Perform job (costs vigor, earns money)
- `GET /market/prices` - Current market prices
- `POST /market/buy` - Purchase goods

## Security Features

✅ Helmet (security headers)
✅ CORS with configurable origins
✅ Rate limiting (100 req/min default)
✅ Server-side validation with Zod
✅ PostgreSQL parameterized queries (no SQL injection)
✅ Money handling in integer cents (no floating point errors)
✅ Transaction-based actions with idempotency keys
✅ Password hashing (to be implemented with bcrypt)

## Failure Resistance

- **Bankruptcy recovery**: Players can always take low-paying jobs
- **Burnout recovery**: Vigor regenerates hourly, minimum 50% efficiency even at 0 vigor
- **Exactly-once actions**: Idempotency keys prevent double-execution on retry
- **Graceful degradation**: Low vigor reduces efficiency but never blocks all actions

## Next Steps (Post-Scaffolding)

1. Implement authentication (JWT or session-based)
2. Create player registration and login endpoints
3. Build action execution system (work jobs, buy goods)
4. Implement tick workers (hourly/daily)
5. Add player dashboard UI with vigor bars and balance
6. Create interactive city map
7. Add market UI with dynamic pricing display

## Troubleshooting

### Database Connection Errors

```bash
# Check if PostgreSQL is running
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Port Already in Use

If ports 3000, 3001, or 5432 are taken:

1. Update `.env` files with different ports
2. Update `docker-compose.yml` port mappings
3. Restart services

### TypeScript Errors

```bash
# Clean build artifacts
pnpm clean

# Reinstall dependencies
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

## Contributing

This is an MVP. Keep changes focused on the two core systems (Vigor & Economy). All other features should remain stubs.

## License

Private project - All rights reserved.