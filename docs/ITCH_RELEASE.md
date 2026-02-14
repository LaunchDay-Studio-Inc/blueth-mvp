# Blueth City — itch.io Release Guide

## Overview

The itch.io build produces a static HTML/JS/CSS ZIP that can be hosted on itch.io
(or any static file host). The game frontend connects to a separately-hosted
Fastify API server.

## Prerequisites

1. **Node.js >= 20** and **pnpm >= 8**
2. **API server deployed** — The Fastify backend + PostgreSQL + workers must be
   running at a publicly accessible URL (e.g., `https://api.bluethcity.com`).
3. Dependencies installed: `pnpm install`

## Build

```bash
# Set the API URL to your deployed backend
NEXT_PUBLIC_API_URL=https://api.bluethcity.com pnpm build:itch
```

Output: `dist-itch/game.zip`

The ZIP contains an `index.html` at the root, ready for itch.io upload.

## Upload to itch.io

1. Go to your itch.io dashboard → Create new project (or edit existing)
2. Set **Kind of project** to **HTML**
3. Upload `dist-itch/game.zip`
4. Check **This file will be played in the browser**
5. Set viewport dimensions (recommended: 1024 x 768)
6. Enable **SharedArrayBuffer support** if prompted (not required but harmless)
7. Save & view page

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_API_URL` | Build time | Base URL of the Fastify API (e.g., `https://api.bluethcity.com`). Baked into the static JS at build time. |
| `ALLOWED_ORIGINS` | API server | Comma-separated origins allowed by CORS. Supports wildcards: `*.itch.io,*.hwcdn.net,https://yourgame.itch.io` |
| `NODE_ENV` | API server | Set to `production` for secure cookies, strict CORS, and rate limiting. |

## Authentication

The itch.io build uses **guest auth** with Bearer tokens:

- On first visit, the frontend auto-creates a guest account via `POST /auth/guest`
- The API returns a Bearer token stored in `localStorage`
- All subsequent API calls include `Authorization: Bearer <token>`
- No cookies are used (avoids third-party cookie restrictions in iframes)

### Token Rotation

Players can rotate their token from the **Settings** page. The old token is
invalidated immediately.

## API Server Setup

The API server must be configured for cross-origin access:

```bash
# .env on the API server
ALLOWED_ORIGINS=*.itch.io,*.hwcdn.net
NODE_ENV=production
```

The CORS plugin supports wildcard patterns (`*.itch.io` matches any subdomain)
and always allows the `Authorization` header.

## Mobile Support

The frontend is responsive with 44px minimum touch targets. It works in:

- Desktop browsers
- Mobile browsers (Android Chrome, Safari)
- itch.io iframe (desktop + mobile)
- Android WebView

## File Structure

```
dist-itch/
└── game.zip          # Upload this to itch.io
    ├── index.html    # Entry point
    ├── city.html     # Game pages
    ├── settings.html
    ├── _next/        # JS/CSS bundles
    └── ...
```
