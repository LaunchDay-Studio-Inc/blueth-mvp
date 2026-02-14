# Blueth City — Mobile PWA Guide

## Overview

Blueth City is a Progressive Web App (PWA) that can be installed on Android
devices directly from Chrome. Once installed, it launches in standalone mode
(no browser chrome) and caches static assets for faster loads.

**Important:** This is NOT an offline game. The PWA caches JS/CSS/images for
speed, but gameplay requires an active network connection to the API server.

---

## What the PWA Provides

- **Add to Home Screen** — App icon on the Android launcher
- **Standalone mode** — Full-screen experience without browser UI
- **Static asset caching** — Faster repeat loads via service worker
- **Theme color** — Blue status bar (#3b82f6) for branded feel

---

## Testing on Android Chrome

### 1. Serve the App

The app must be served over HTTPS (or localhost) for PWA features to work.

**Option A — Production deployment:**
```
https://api.yourdomain.com  →  API server
https://yourdomain.com      →  Web app (or itch.io iframe)
```

**Option B — Local development with ngrok:**
```bash
# Terminal 1: Start the dev server
cd apps/web && pnpm dev

# Terminal 2: Expose via ngrok (provides HTTPS)
ngrok http 3000
```

### 2. Open on Android

1. Open Chrome on your Android device
2. Navigate to the app URL
3. Chrome should show an **"Add to Home Screen"** banner after a few seconds
4. If no banner appears, tap the three-dot menu → **"Install app"** or **"Add to Home screen"**

### 3. Verify Installation

After installing:

- [ ] App icon appears on the home screen with the blue "B" icon
- [ ] Tapping the icon launches in standalone mode (no URL bar)
- [ ] Status bar is blue (#3b82f6)
- [ ] Navigation works normally (city map, sidebar, bottom nav)
- [ ] All tap targets are at least 44x44px
- [ ] City map districts are tappable

### 4. Verify Responsive Layout (360x800)

Using Chrome DevTools on desktop:

1. Open Chrome → DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select **Pixel 5** (393x851) or set custom **360x800**
4. Verify:
   - [ ] Top header bar fits on screen
   - [ ] Bottom navigation bar shows 5 icons
   - [ ] City map is full-width and tappable
   - [ ] District panel appears below the map (not beside)
   - [ ] All text is readable without zooming
   - [ ] No horizontal scrolling occurs
   - [ ] Hamburger menu opens and closes correctly
   - [ ] Settings page is accessible from hamburger menu

### 5. Service Worker Verification

In Chrome DevTools → Application tab:

1. **Service Workers** section:
   - [ ] `sw.js` is registered and active
   - [ ] Status shows "activated and running"

2. **Cache Storage** section:
   - [ ] `blueth-v1` cache exists
   - [ ] Contains `manifest.json` and icon files

3. **Manifest** section:
   - [ ] Name: "Blueth City"
   - [ ] Display: "standalone"
   - [ ] Icons are listed

---

## Lighthouse PWA Audit

Run Lighthouse in Chrome DevTools → Lighthouse tab:

1. Check "Progressive Web App" category
2. Run audit
3. Expected results:
   - [x] Web app manifest meets installability requirements
   - [x] Registers a service worker
   - [x] Has a `<meta name="theme-color">`
   - [x] Content is sized correctly for the viewport
   - [x] Has a `<meta name="viewport">` with `width` or `initial-scale`

---

## Updating the Service Worker

When deploying new code, update the `CACHE_NAME` in `public/sw.js`:

```js
// Change 'blueth-v1' to 'blueth-v2' to bust the cache
const CACHE_NAME = 'blueth-v2';
```

The `activate` event handler automatically deletes old caches.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| No install prompt | Not served over HTTPS | Use HTTPS or localhost |
| SW not registering | Mixed content or HTTP | Ensure all resources are HTTPS |
| Old content after deploy | Stale SW cache | Bump `CACHE_NAME` version |
| App doesn't go standalone | manifest.json not found | Check `/manifest.json` is accessible |
| Icons not showing | Path mismatch | Verify `/icons/icon-192.svg` loads in browser |
