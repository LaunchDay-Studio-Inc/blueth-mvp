# Production Stability Fix

**Branch:** `hotfix/prod-stability`
**Date:** 2026-02-15
**Prerequisite:** `docs/PROD_INCIDENT_REPORT.md` (root cause analysis)

## Summary

Fixes 5 categories of production issues identified in the incident report: startup logging, health/readiness endpoints, crash-proofing, DB timeouts, and Docker/compose reliability.

## Changes

### A) Startup Logging & Version Tracking

- **`apps/api/src/version.ts`** (new): Shared module exporting `APP_VERSION` (from package.json) and `GIT_COMMIT` (from env var, injected at Docker build time).
- **`apps/api/src/index.ts`**: After `server.listen()`, logs a structured startup message with version, commit, nodeEnv, host, port, and masked DB URL.
- **`apps/api/src/config.ts`**: Exported `maskDatabaseUrl` so index.ts can use it.

### B) Health & Readiness Endpoints

- **`apps/api/src/routes/health.ts`**: `GET /health` (liveness) now includes `version` and `commit` fields.
- **`apps/api/src/index.ts`**: Added top-level `GET /ready` (readiness) that runs `SELECT 1` — returns 200 or 503.
- **`apps/api/src/plugins/auth.ts`**: Added `/ready` to `PUBLIC_PREFIXES` so it skips auth.

### C) Crash-Proofing

All three process entry points now handle:
- `unhandledRejection` — logs error, keeps process alive
- `uncaughtException` — logs error, exits with code 1

**Files:** `apps/api/src/index.ts`, `apps/api/src/workers/tick.ts`, `apps/api/src/workers/scheduler.ts`

### D) DB Pooling & Timeouts

- **`packages/db/src/index.ts`**: Added `statement_timeout: 30000` (30s) to the Pool constructor. Prevents runaway queries from holding connections indefinitely.

### E) Docker / Compose Reliability

#### Healthcheck Fix (IPv6 bug)
- Changed `localhost` → `127.0.0.1` in all `wget` healthcheck commands.
- Alpine's `localhost` resolves to `::1` (IPv6), but Node binds `0.0.0.0` (IPv4 only).
- **Files:** `docker-compose.prod.yml`, `deploy/docker-compose.cloud.yml`

#### NEXT_PUBLIC_API_URL / ITCH_MODE Fix
- **`apps/web/Dockerfile`**: Default `NEXT_PUBLIC_API_URL` changed from `http://localhost:3001` to empty string. Added `API_INTERNAL_URL=http://api:3001` (server-side only).
- **`apps/web/next.config.js`**: Rewrites now prefer `API_INTERNAL_URL` over `NEXT_PUBLIC_API_URL`.
- **`docker-compose.prod.yml`**: Web build args set `NEXT_PUBLIC_API_URL: ''` and `API_INTERNAL_URL: http://api:3001`.
- This prevents ITCH_MODE from activating in self-hosted deployments.

#### Log Rotation
- All services now have `json-file` logging with `max-size: 10m`, `max-file: 3`.

#### GIT_COMMIT Build Arg
- Both Dockerfiles accept `GIT_COMMIT` as a build arg, set as env var in the runner stage.
- All compose services pass `GIT_COMMIT` to build and runtime env.

#### Web Healthcheck
- Added healthcheck for the `web` service: `wget http://127.0.0.1:3000/`.

#### Caddy Service
- Added Caddy reverse proxy service to `docker-compose.prod.yml` (matches cloud compose).
- Created root `Caddyfile` with env-var-based domain routing.

### F) .env.example Updates

- **Root `.env.example`**: Updated `NEXT_PUBLIC_API_URL` guidance (leave empty for self-hosted), added `GIT_COMMIT`, `API_DOMAIN`, `WEB_DOMAIN`.
- **`deploy/.env.example`**: Added `WEB_DOMAIN`, `GIT_COMMIT`, updated `ALLOWED_ORIGINS` to include `*.sslip.io`.

## Files Modified (11)

| File | Change |
|------|--------|
| `apps/api/src/index.ts` | Startup logging, `/ready` route, crash handlers |
| `apps/api/src/routes/health.ts` | Version + commit in liveness response |
| `apps/api/src/plugins/auth.ts` | `/ready` in PUBLIC_PREFIXES |
| `apps/api/src/config.ts` | Export `maskDatabaseUrl` |
| `apps/api/src/workers/tick.ts` | Crash handlers |
| `apps/api/src/workers/scheduler.ts` | Crash handlers |
| `packages/db/src/index.ts` | `statement_timeout: 30000` |
| `apps/web/next.config.js` | `API_INTERNAL_URL` for rewrites |
| `apps/web/Dockerfile` | Empty `NEXT_PUBLIC_API_URL`, `API_INTERNAL_URL`, `GIT_COMMIT` |
| `apps/api/Dockerfile` | `GIT_COMMIT` ARG/ENV |
| `docker-compose.prod.yml` | Healthcheck fix, log rotation, env, Caddy |
| `deploy/docker-compose.cloud.yml` | Healthcheck fix, log rotation, GIT_COMMIT |
| `.env.example` | Updated guidance, new vars |
| `deploy/.env.example` | WEB_DOMAIN, GIT_COMMIT |

## Files Created (4)

| File | Purpose |
|------|---------|
| `apps/api/src/version.ts` | Shared version/commit constants |
| `apps/api/tests/health.test.ts` | Health endpoint tests (8 tests) |
| `Caddyfile` | Root Caddyfile for self-hosted Caddy |
| `docs/PROD_STABILITY_FIX.md` | This file |

## Deployment

```bash
# On VM:
cd /opt/blueth
git pull origin hotfix/prod-stability

# Set GIT_COMMIT in .env
export GIT_COMMIT=$(git rev-parse --short HEAD)

# Rebuild and deploy
docker compose -f docker-compose.prod.yml build --build-arg GIT_COMMIT=$GIT_COMMIT
docker compose -f docker-compose.prod.yml up -d

# Verify
curl -sf http://127.0.0.1:3001/health | python3 -m json.tool
curl -sf http://127.0.0.1:3001/ready | python3 -m json.tool
docker ps  # all containers should show "healthy"
```

## Soak Test

```bash
for i in $(seq 1 20); do
  echo "=== Minute $i ==="
  curl -sf http://127.0.0.1:3001/health | python3 -m json.tool
  curl -sf http://127.0.0.1:3001/ready | python3 -m json.tool
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | head -7
  sleep 60
done
```

## Test Results

Health endpoint tests (8/8 passing):
- `GET /health` — returns 200 with version/commit fields
- `GET /health` — returns 200 even when DB is unreachable (pure liveness)
- `GET /health` — does not require authentication
- `GET /health/db` — returns 200 when DB reachable / 503 when not
- `GET /ready` — returns 200 when DB reachable / 503 when not
- `GET /ready` — does not require authentication

TypeScript compilation: clean (0 errors).
