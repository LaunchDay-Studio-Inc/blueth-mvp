# Accessibility Settings

## Overview

Accessibility preferences are stored in `localStorage` (key: `blueth_a11y_prefs`) and applied via CSS data-attributes on the `<html>` element. No API changes required.

## Settings

| Setting | Type | Default | Data Attribute |
|---|---|---|---|
| Reduce motion | boolean | `false` | `data-reduce-motion="true"` |
| Text size | `100 \| 110 \| 125` | `100` | `style.fontSize` on `<html>` |
| High contrast | boolean | `false` | `data-high-contrast="true"` |
| Enhanced focus outlines | boolean | `false` | `data-focus-enhanced="true"` |

## How It Works

### Hook: `useAccessibility()`

Located at `apps/web/src/hooks/use-accessibility.ts`.

Uses `useLocalStorage('blueth_a11y_prefs', defaults)` for persistence. A `useEffect` applies the corresponding data-attributes to `document.documentElement` whenever preferences change.

Exports:
- `prefs` — current AccessibilityPrefs object
- `setReduceMotion(boolean)` — toggle reduce motion
- `setTextSize(100 | 110 | 125)` — set text scale
- `setHighContrast(boolean)` — toggle high contrast
- `setEnhancedFocus(boolean)` — toggle enhanced focus

### CSS Rules: `globals.css`

```css
html[data-reduce-motion="true"]     → kills all animations
html[data-high-contrast="true"]     → bumps text contrast, doubles border opacity
html[data-focus-enhanced="true"]    → 3px solid focus ring + glow shadow
```

## Settings UI

The Accessibility card is on `/settings`. Controls:
- **Reduce motion**: Switch toggle
- **Text size**: Button group (100% / 110% / 125%)
- **High contrast**: Switch toggle
- **Enhanced focus outlines**: Switch toggle

## localStorage Keys

| Key | Shape |
|---|---|
| `blueth_a11y_prefs` | `{ reduceMotion: boolean, textSize: 100\|110\|125, highContrast: boolean, enhancedFocus: boolean }` |
| `blueth_tutorial_state` | `{ completed: string[], dismissed: boolean }` |

## Viewport

`maximumScale` changed from `1` to `5` in `apps/web/src/app/layout.tsx` to allow pinch-to-zoom (WCAG requirement).

## Component Files

```
apps/web/src/
├── hooks/
│   ├── use-local-storage.ts     — Generic localStorage hook (SSR-safe)
│   ├── use-accessibility.ts     — A11y prefs hook
│   └── use-tutorial.ts          — Tutorial state management
├── components/
│   ├── ui/switch.tsx            — Radix Switch wrapper
│   └── tutorial-checklist.tsx   — Floating checklist widget
└── app/
    ├── globals.css              — Data-attribute CSS rules
    └── (game)/settings/page.tsx — Accessibility card UI
```
