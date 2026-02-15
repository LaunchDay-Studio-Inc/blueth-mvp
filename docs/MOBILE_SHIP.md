# Blueth City — Mobile Ship Guide v1

Target device: **Android Chrome**, 360 x 800+ viewport (Galaxy S20 baseline).
Branch: `mobile/ready-v1`

---

## 1. Architecture Summary

### Responsive Shell (`game-shell.tsx`)

| Breakpoint | Layout |
|------------|--------|
| `lg` (1024 px+) | Fixed 208 px left sidebar with all 11 nav items |
| Below `lg` | Bottom tab bar (5 primary items + "More" overflow) + hamburger drawer in header |

- **Bottom nav** shows: City Map, Vigor, Wallet, Bills, Jobs, **More**
- **"More" button** opens the same slide-out drawer as the header hamburger, giving access to Food, Leisure, Market, Business, Summary, Settings
- All tap targets are 44 px minimum (Apple/Android guideline)

### PWA (`manifest.json`, `sw.js`, `layout.tsx`)

- `display: standalone`, `orientation: portrait`
- Dark theme colors: `#0d1117` (background and status bar)
- Service worker (`blueth-v3`): cache-first for statics, network-only for API
- **Not offline-capable** — network required for gameplay

---

## 2. Testing on a Physical Android Phone

### Prerequisites

- App deployed to an HTTPS endpoint (production VM, or local dev via `ngrok http 3000`)
- Android phone with Chrome 90+

### Steps

1. Open Chrome on Android
2. Navigate to the app URL
3. Verify:
   - [ ] Login/register pages load without horizontal overflow
   - [ ] Login form fields and submit button are comfortably tappable
   - [ ] After login, bottom nav shows 5 items + "More"
   - [ ] Tapping "More" opens the drawer with remaining 6 items
   - [ ] All drawer items navigate correctly and drawer closes on selection
   - [ ] City map SVG is full-width, labels are readable, districts are tappable
   - [ ] Vigor status dots visible in the header
   - [ ] Money display visible in the header
   - [ ] No horizontal scroll on any page
   - [ ] Header hamburger also opens the same drawer

### Install as PWA

1. In Chrome, tap the three-dot menu → **"Install app"** (or "Add to Home Screen")
2. Verify:
   - [ ] App icon appears on home screen (PNG icon, not blank)
   - [ ] Launching opens in standalone mode (no browser chrome)
   - [ ] Status bar color is dark (`#0d1117`), not blue or white
   - [ ] Splash screen background is dark, not white

---

## 3. Testing with Chrome DevTools

1. Open Chrome → DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select **Pixel 5** (393 x 851) or custom 360 x 800
4. Walk through all checks from Section 2

### Lighthouse PWA Audit

1. DevTools → **Lighthouse** → check "Progressive Web App"
2. Run audit
3. All installability checks should pass

### Service Worker Verification

1. DevTools → **Application** → Service Workers
   - [ ] `sw.js` registered and active
2. DevTools → **Application** → Cache Storage
   - [ ] `blueth-v3` cache exists with manifest and icon entries

---

## 4. Automated Tests (Playwright)

```bash
# Run all e2e tests (desktop chromium + mobile-chrome)
pnpm exec playwright test

# Run only mobile smoke tests
pnpm exec playwright test e2e/mobile-smoke.spec.ts

# Run mobile-chrome project only
pnpm exec playwright test --project=mobile-chrome
```

### Test Matrix

| Test | Viewport | Asserts |
|------|----------|---------|
| Login page layout | 360 x 800 | Form visible, no overflow |
| Register page layout | 360 x 800 | Form visible, no overflow |
| City map layout | 360 x 800 | No overflow |
| Tap targets >= 44 px | 360 x 800 | Buttons meet minimum |
| Manifest correctness | N/A | Dark colors, standalone, maskable icon |
| Theme-color meta | 360 x 800 | `#0d1117` |
| 320 px no-overflow | 320 x 568 | Login page fits iPhone SE |
| Viewport meta | 360 x 800 | `maximum-scale=1`, `width=device-width` |

All tests run on both `chromium` (desktop) and `mobile-chrome` (Pixel 5) projects.

---

## 5. Known Limitations

- **No offline play.** The service worker caches assets for speed only.
- **iOS Safari not validated.** This release targets Android Chrome specifically.
- **Landscape mode.** Manifest is set to `portrait`. Landscape is not blocked but not optimized.
