#!/usr/bin/env bash
# build-itch.sh — Generate an itch.io-ready ZIP from the Next.js frontend.
#
# Usage:
#   pnpm build:itch
#   # or directly:
#   bash scripts/build-itch.sh
#
# Prerequisites:
#   - pnpm install
#   - packages/core built (pnpm run --filter './packages/*' build)
#   - NEXT_PUBLIC_API_URL must be set (the hosted Fastify API base URL)
#
# Output:
#   dist-itch/game.zip  — static HTML/JS/CSS ready for itch.io upload

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"
OUT_DIR="$WEB_DIR/out"
DIST_DIR="$ROOT_DIR/dist-itch"
CONFIG_ORIG="$WEB_DIR/next.config.js"
CONFIG_BACKUP="$WEB_DIR/next.config.js.bak"

echo "=== Blueth City — itch.io build ==="

# Ensure NEXT_PUBLIC_API_URL is set
if [ -z "${NEXT_PUBLIC_API_URL:-}" ]; then
  echo "WARNING: NEXT_PUBLIC_API_URL is not set."
  echo "  The build will use '' (empty) as the API base, meaning relative /api paths."
  echo "  For itch.io, set this to your hosted API URL, e.g.:"
  echo "    NEXT_PUBLIC_API_URL=https://api.example.com pnpm build:itch"
  echo ""
fi

# 1. Build shared packages
echo "--- Building shared packages ---"
cd "$ROOT_DIR"
pnpm run --filter './packages/*' build

# 2. Swap in the static export config
echo "--- Configuring static export ---"
cp "$CONFIG_ORIG" "$CONFIG_BACKUP"
cat > "$CONFIG_ORIG" << 'ITCH_CONFIG'
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
  transpilePackages: ['@blueth/core'],
};

module.exports = nextConfig;
ITCH_CONFIG

# 3. Build
echo "--- Building Next.js static export ---"
cleanup() {
  echo "--- Restoring original next.config.js ---"
  if [ -f "$CONFIG_BACKUP" ]; then
    mv "$CONFIG_BACKUP" "$CONFIG_ORIG"
  fi
}
trap cleanup EXIT

cd "$WEB_DIR"
pnpm build

# 4. Verify output
if [ ! -f "$OUT_DIR/index.html" ]; then
  echo "ERROR: $OUT_DIR/index.html not found. Static export may have failed."
  exit 1
fi

FILE_COUNT=$(find "$OUT_DIR" -type f | wc -l)
echo "--- File count: $FILE_COUNT ---"
if [ "$FILE_COUNT" -gt 1000 ]; then
  echo "WARNING: File count ($FILE_COUNT) exceeds 1000. Consider pruning."
fi

# 5. Package as ZIP
echo "--- Creating ZIP ---"
mkdir -p "$DIST_DIR"
cd "$OUT_DIR"
zip -r "$DIST_DIR/game.zip" . -x '*.map'

ZIP_SIZE=$(du -sh "$DIST_DIR/game.zip" | cut -f1)
echo ""
echo "=== Build complete ==="
echo "  Output: dist-itch/game.zip ($ZIP_SIZE)"
echo "  Files:  $FILE_COUNT"
echo ""
echo "Upload dist-itch/game.zip to itch.io as an HTML game."
