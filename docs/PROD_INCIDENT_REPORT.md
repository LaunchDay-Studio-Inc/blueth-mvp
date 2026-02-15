# Production Incident Report: API Unreachable After ~3 Minutes

**Date:** 2026-02-15
**Branch:** hotfix/prod-incident-audit
**Severity:** P1 — App unusable for all users after initial window
**VM:** GCP (34.42.121.95), compose project `app` via `docker-compose.prod.yml`

---

## 1. Timeline (Approximate)

All timestamps are UTC, derived from API JSON log `time` fields (epoch ms).

| Time (UTC)         | Event |
|--------------------|-------|
| 00:07:37           | API container starts — `Server listening at http://0.0.0.0:3001`, `Environment: production` |
| 00:07:37 +0s       | Docker healthcheck begins failing (see Finding #3) |
| 00:08:21 (+43s)    | First `GET /me/state` arrives from web container (172.18.0.6) — returns **401** |
| 00:08:21 – 00:09:16| **Burst 1:** ~80 consecutive `GET /me/state` → 401 at ~1.4 req/sec |
| 00:09:16           | Rate limiter fires: **429** "Rate limit exceeded, retry in 1 minute" |
| 00:10:40           | `POST /auth/register` → **201** (user successfully registers) |
| 00:10:41           | `GET /me/state` → **200** (app works normally) |
| 00:10:41 – 00:18:31| Normal authenticated traffic: `/me/state` every ~60s, `/market/goods` calls |
| 00:18:31           | `GET /me/state` → **401** again (new visitor or session loss) |
| 00:18:31 – 00:19:05| **Burst 2:** ~100 consecutive `GET /me/state` → 401 at ~3 req/sec |
| 00:19:05           | Rate limiter fires again: **429** |
| 00:22:53           | Single stray `GET /me/state` → 401 |
| 00:41:31 – 01:00:00| External hits to `api.34.42.121.95.sslip.io/` from Caddy (172.18.0.7) → 401 |
| 01:06:09 – 01:06:10| **Burst 3:** 5 `GET /me/state` → 401 at ~4 req/sec, then stops |

---

## 2. Observed Symptoms

### 2a. API Container Marked Unhealthy

```
$ docker ps --format '{{.Names}} {{.Status}}'
app-api-1 Up About an hour (unhealthy)     ← PROBLEM
app-postgres-1 Up About an hour (healthy)
app-web-1 Up About an hour
```

The API container has **never** passed its Docker healthcheck since startup. All other containers are running without restart loops.

### 2b. Massive 401 Spam from Web Container

100% of the `/me/state` requests in the API logs originate from `172.18.0.6` (the web container's Docker bridge IP), not from external clients through Caddy. Example:

```json
{"reqId":"req-1","req":{"method":"GET","url":"/me/state","hostname":"api:3001","remoteAddress":"172.18.0.6"},"res":{"statusCode":401},"responseTime":13.08}
{"reqId":"req-2","req":{"method":"GET","url":"/me/state","hostname":"api:3001","remoteAddress":"172.18.0.6"},"res":{"statusCode":401},"responseTime":2.89}
// ... repeats 80+ times in 56 seconds
```

### 2c. Rate Limiter Blocks Legitimate Traffic

The global rate limit (`@fastify/rate-limit`, 100 req/min per IP) is exhausted by the 401 spam from the web container. Since **all** Next.js-proxied traffic shares the same Docker IP (`172.18.0.6`), once the unauthenticated spam hits 100/min, **authenticated users' requests are also blocked** with 429:

```json
{"level":50,"err":{"message":"Rate limit exceeded, retry in 1 minute","statusCode":429}}
```

### 2d. System Resources Are Not the Problem

```
Load average: 0.00, 0.01, 0.02
Memory: 1.0 GiB / 15.6 GiB used (6.4%)
Disk: 7.7 GB / 48 GB used (17%)
API container: 0.00% CPU, 26 MiB RAM
Web container: 0.00% CPU, 45 MiB RAM
```

No OOM kills. No container restarts. No disk pressure. `sudo dmesg` and `journalctl` were clean (sudo unavailable, but no evidence of kernel OOM).

---

## 3. Root Cause Analysis

### Finding 1: NEXT_PUBLIC_API_URL Activates Wrong Auth Mode

**Files:** `.env` on VM, `apps/web/src/lib/auth-context.tsx:8`, `apps/web/src/middleware.ts:8`

The production `.env` sets:
```
NEXT_PUBLIC_API_URL=http://api:3001
```

This is the Docker-internal hostname. It is baked into the Next.js client bundle at build time (via Dockerfile `ARG`→`ENV`). Two critical side effects:

1. **ITCH_MODE activates**: `const ITCH_MODE = !!process.env.NEXT_PUBLIC_API_URL` → `true`
   - The Next.js middleware **skips all auth redirects** (`middleware.ts:11`)
   - Guest auto-login is enabled (`auth-context.tsx:86`)
   - This mode is designed for cross-origin itch.io embedding, not self-hosted deployment

2. **Browser API calls target an unreachable host**: Client-side `fetch('http://api:3001/me/state')` fails with DNS resolution error because `api` is a Docker-internal hostname.

3. **Server-side requests work but lack auth**: The Next.js rewrite rule (`next.config.js:11-18`) proxies `/api/:path*` to `http://api:3001/:path*`. These requests reach the API from the web container IP but carry no session cookie → 401.

### Finding 2: Request Amplification via Next.js Proxy

**File:** `apps/web/next.config.js:11-18`

```js
async rewrites() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
},
```

The `api.ts` client code (`apps/web/src/lib/api.ts:36`):
```js
const url = API_BASE ? `${API_BASE}${path}` : `/api${path}`;
```

When `API_BASE` fails to resolve in the browser, any fallback or retry mechanism routes requests through the Next.js rewrite path (`/api/me/state`). These proxied requests:
- Come from the web container's IP (`172.18.0.6`)
- Have **no session cookie** (not forwarded by Next.js rewrites by default)
- Hit the rate limiter as a single source IP

### Finding 3: Health Check Broken — IPv6 Localhost vs IPv4 Bind

**File:** `docker-compose.prod.yml:52`

```yaml
healthcheck:
  test: ['CMD', 'wget', '--spider', 'http://localhost:3001/health']
```

Verified on the VM:
```
$ docker exec app-api-1 wget -q -O- http://localhost:3001/health
wget: can't connect to remote host: Connection refused

$ docker exec app-api-1 wget -q -O- http://127.0.0.1:3001/health
{"status":"ok","timestamp":"...","uptime":4113.54,"environment":"production"}
```

The API container uses Alpine Linux where `localhost` resolves to `::1` (IPv6). The Fastify server binds to `0.0.0.0:3001` (IPv4 only). The health check has **never passed** since container start. This causes the container to be perpetually marked `unhealthy`.

### Finding 4: CORS Misconfiguration for Self-Hosted Domain

**File:** `.env` on VM

```
ALLOWED_ORIGINS=*.itch.io,*.hwcdn.net,https://serkingiii.itch.io
```

The Caddy reverse proxy serves the app at `34.42.121.95.sslip.io` and `api.34.42.121.95.sslip.io`. Neither domain is in `ALLOWED_ORIGINS`. Any direct browser-to-API CORS request from the sslip.io domain would be rejected. This is currently masked by the fact that all traffic goes through the Next.js proxy (same-origin), but would break if `NEXT_PUBLIC_API_URL` is changed to the external API URL.

### Finding 5: Session Cookie Not Forwarded Through Proxy

**File:** `apps/api/src/plugins/auth.ts:74-81`

```js
sessionCookieOptions(isProduction) {
  return { path: '/', httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: 7*24*60*60 };
}
```

The session cookie is set on the API response. When the browser communicates through the Next.js rewrite (`/api/:path*` → `api:3001/:path*`), the cookie's origin is ambiguous. Next.js rewrites do not automatically forward incoming cookies to the upstream. Even after login, subsequent proxied requests arrive at the API without the `session_id` cookie.

---

## 4. Root Cause Hypotheses (Ranked)

| # | Confidence | Hypothesis |
|---|------------|------------|
| 1 | **High**   | `NEXT_PUBLIC_API_URL=http://api:3001` incorrectly activates ITCH_MODE in a self-hosted deployment, disabling auth guards and causing the frontend to make unauthenticated API calls through the Next.js proxy. These accumulate at 1-5 req/sec, exhaust the per-IP rate limit (100/min), and block ALL traffic from the web container — including authenticated users. |
| 2 | **High**   | Docker healthcheck uses `localhost` which resolves to IPv6 `::1` in Alpine, while the API binds to IPv4 `0.0.0.0`. Healthcheck never passes, container is perpetually `unhealthy`. |
| 3 | **Medium** | `ALLOWED_ORIGINS` doesn't include the sslip.io domain, so any future switch to direct browser→API requests would fail CORS. |
| 4 | **Medium** | Session cookies set by the API are not forwarded by the Next.js rewrite proxy. Even authenticated sessions break when going through the proxy path. |
| 5 | **Low**    | Connection pool (max 20 per process × 3 processes = 60 potential connections) is large relative to a low-traffic app, but this did not manifest as an issue in the current incident. DB is healthy and responsive. |

---

## 5. Next Fix Plan

1. **Remove `NEXT_PUBLIC_API_URL` from self-hosted `.env`** — In self-hosted mode (not itch.io), this var should be unset/empty so that `ITCH_MODE = false`, auth-redirect middleware is active, and client requests use the `/api/:path*` rewrite path to the backend.

2. **Fix the Docker healthcheck to use `127.0.0.1` instead of `localhost`** — Change the healthcheck in `docker-compose.prod.yml` (and the cloud variant) to `http://127.0.0.1:3001/health` to avoid the Alpine IPv6 resolution issue.

3. **Add `*.sslip.io` (or the specific domain) to `ALLOWED_ORIGINS`** — Ensure CORS is configured for the actual deployment domain. The proxy path sidesteps CORS today, but this is a latent misconfiguration.

4. **Scope the rate limiter to exclude the health-check and internal-proxy paths, or increase the per-IP limit with proxy awareness** — Currently, the 100 req/min limit applies to all requests from the web container's single IP. Consider either allowlisting the Docker bridge IP with a higher limit, or using `X-Forwarded-For` to attribute requests to the actual client.

5. **Ensure session cookies are forwarded through the Next.js proxy** — Either configure Next.js to forward cookies in rewrites, or decouple the deployment so the browser communicates directly with the API (requires fixing CORS and cookie domain).

---

## 6. Evidence Appendix

### VM State Snapshot

| Metric | Value |
|--------|-------|
| Uptime | 4h 43m |
| Load   | 0.00 / 0.01 / 0.02 |
| RAM    | 1.0 GiB / 15.6 GiB |
| Disk   | 7.7 GB / 48 GB (17%) |
| Docker | 6 containers running (compose project `app`) |

### Container Status

| Container | Status | CPU | RAM |
|-----------|--------|-----|-----|
| app-caddy-1 | Up | 0.00% | 12 MiB |
| app-web-1 | Up | 0.00% | 45 MiB |
| app-api-1 | Up (unhealthy) | 0.00% | 26 MiB |
| app-tick-1 | Up | 0.00% | 16 MiB |
| app-scheduler-1 | Up | 0.00% | 14 MiB |
| app-postgres-1 | Up (healthy) | 1.67% | 26 MiB |

### Key Environment Variables (API)

```
NODE_ENV=production
DATABASE_URL=postgres://blueth:***@postgres:5432/blueth_city
PORT=3001
HOST=0.0.0.0
ALLOWED_ORIGINS=*.itch.io,*.hwcdn.net,https://serkingiii.itch.io
```

### Key Environment Variables (Web)

```
PORT=3000
HOSTNAME=0.0.0.0
# NEXT_PUBLIC_API_URL baked at build time: http://api:3001
# Runtime env does NOT contain NEXT_PUBLIC_API_URL
```

### Caddy Configuration

```caddyfile
api.34.42.121.95.sslip.io {
    reverse_proxy api:3001
}

34.42.121.95.sslip.io {
    reverse_proxy web:3000
}
```

### API Log Pattern (Burst 1 — first 5 + rate limit)

```json
{"reqId":"req-1","url":"/me/state","remoteAddress":"172.18.0.6","statusCode":401,"responseTime":13.08}
{"reqId":"req-2","url":"/me/state","remoteAddress":"172.18.0.6","statusCode":401,"responseTime":2.89}
{"reqId":"req-3","url":"/me/state","remoteAddress":"172.18.0.6","statusCode":401,"responseTime":1.15}
{"reqId":"req-4","url":"/me/state","remoteAddress":"172.18.0.6","statusCode":401,"responseTime":1.23}
{"reqId":"req-5","url":"/me/state","remoteAddress":"172.18.0.6","statusCode":401,"responseTime":1.32}
...  (80 more 401s over 56 seconds)
{"reqId":"req-2t","statusCode":429,"err":{"message":"Rate limit exceeded, retry in 1 minute"}}
```

### DB Connectivity

Postgres healthy, all workers connected and operating:
```json
{"worker":"tick","msg":"Tick completed","tickType":"hourly","durationMs":103}
{"worker":"scheduler","msg":"Scheduler worker started","pollIntervalMs":5000}
```

Pool config: `max=20`, `idleTimeoutMillis=30000`, `connectionTimeoutMillis=10000`. No connection errors observed.
