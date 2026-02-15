# Mobile Ship Checklist — v1

Target: Android Chrome, 360 × 800 viewport (Galaxy S-series baseline).

## Viewport & Layout

- [x] `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">` set in `layout.tsx`
- [x] `overflow-x: hidden` on `<body>` to prevent horizontal scroll from slightly-oversized elements
- [x] `overscroll-behavior: none` on `<html>` to suppress pull-to-refresh / rubber-band
- [x] `-webkit-tap-highlight-color: transparent` to suppress blue flash on Android Chrome

## Responsive Shell

- [x] Desktop sidebar hidden below `lg:` breakpoint
- [x] Mobile hamburger drawer with backdrop overlay
- [x] Bottom nav bar (5 items) with `env(safe-area-inset-bottom)` padding
- [x] Sticky header with compact layout at mobile widths

## Vigor Display

- [x] Desktop: full mini vigor bars (`hidden md:flex`) with tooltips
- [x] Mobile: compact colored-dot + value chips (`flex md:hidden`) visible in header

## Tap Targets

- [x] All nav links: `min-h-[44px] min-w-[44px]` (bottom nav, sidebar, hamburger)
- [x] Hamburger button: `min-h-[44px] min-w-[44px]`
- [x] Logout button: `min-h-[44px] min-w-[44px]`
- [x] ActionCard "Go" button: `min-h-[44px] min-w-[44px]` added

## Dialogs & Modals

- [x] `DialogContent` capped at `max-h-[85vh] overflow-y-auto` so long dialogs scroll on short screens

## City Map

- [x] SVG labels bumped from `text-[10px]` to `text-[12px]` for readability at 360px
- [x] `touchAction: 'pan-y'` on map container to allow vertical scroll without blocking taps

## PWA

- [x] `manifest.json` with standalone display, portrait orientation, theme color
- [x] PNG raster icons: 192×192, 512×512, maskable 512×512
- [x] SVG icons retained as fallback for modern browsers
- [x] `apple-touch-icon` points to PNG (iOS ignores SVG)
- [x] Service worker caches static assets (no offline gameplay)
- [x] Cache versioned to `blueth-v2` with PNG icons in precache
- [x] `docs/MOBILE_PWA.md` with "Add to Home Screen" instructions

## E2E Tests

- [x] `e2e/mobile-smoke.spec.ts` — 4 Playwright tests at 360 × 800:
  1. Login page: form visible, no horizontal overflow
  2. Register page: form visible, no horizontal overflow
  3. City map page: no horizontal overflow
  4. Tap target size check on buttons

## Manual QA Checklist (pre-deploy)

- [ ] Open on Android Chrome 360 × 800 — verify no horizontal scroll on any page
- [ ] Tap all bottom nav items — verify 44px hit area feels comfortable
- [ ] Open hamburger menu — verify all 11 nav items accessible
- [ ] Verify vigor chips visible in header between hamburger and money display
- [ ] Open a dialog (e.g., market order confirm) — verify it scrolls if content is long
- [ ] Tap city map districts — verify labels readable
- [ ] "Add to Home Screen" — verify app icon is PNG, standalone mode works
- [ ] Check all food page Go buttons — verify comfortable tap target
