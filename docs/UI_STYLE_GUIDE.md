# UI Style Guide — Glass Design System

## CSS Custom Properties (Tokens)

All tokens live in `apps/web/src/app/globals.css` under `:root`.

| Token | HSL Value | Purpose |
|-------|-----------|---------|
| `--glass-bg` | `222 44% 10%` | Default glass surface background |
| `--glass-bg-elevated` | `222 40% 12%` | Raised panels / modals |
| `--glass-bg-inset` | `222 50% 6%` | Recessed / inset areas |
| `--glass-border` | `210 20% 90%` | Glass border (used at low opacity) |
| `--glow-warm` | `38 90% 55%` | Amber accent glow |
| `--glow-cool` | `192 91% 52%` | Cyan accent glow (matches `--primary`) |
| `--glow-neutral` | `220 20% 60%` | Subtle neutral glow |
| `--vignette` | `222 47% 3%` | Edge-darkening gradient base |
| `--text-primary` | `210 20% 92%` | High-emphasis text |
| `--text-secondary` | `215 16% 65%` | Medium-emphasis text |
| `--text-tertiary` | `215 12% 45%` | Low-emphasis / disabled text |

## Utility Classes

| Class | Effect |
|-------|--------|
| `.glass-surface` | 60% bg, 12px blur, 8% border |
| `.glass-elevated` | 70% bg, 16px blur, 12% border, drop shadow |
| `.glass-inset` | 50% bg, 8px blur, 5% border |
| `.glass-glow-cool` | Subtle cyan box-shadow |
| `.glass-glow-warm` | Subtle amber box-shadow |
| `.vignette-bg` | Radial edge-darkening gradient |

Use these on any `div` / container for instant glass treatment.

## Components

### `<GlassPanel>`

Glass container with CVA variants.

```tsx
import { GlassPanel } from '@/components/ui/glass-panel';

<GlassPanel variant="surface" padding="md">
  Content here
</GlassPanel>
```

**Variants:** `surface` (default), `elevated`, `inset`
**Padding:** `none`, `sm`, `md` (default), `lg`

### `<GlassButton>`

Transparent button with hover glow, loading state, and active scale.

```tsx
import { GlassButton } from '@/components/ui/glass-button';

<GlassButton variant="primary" size="md">Click</GlassButton>
<GlassButton loading>Submitting...</GlassButton>
<GlassButton variant="ghost" size="icon"><Icon /></GlassButton>
```

**Variants:** `primary` (default), `ghost`, `outline`
**Sizes:** `sm`, `md` (default), `lg`, `icon`
**Props:** `loading` (shows spinner + `aria-busy`), `asChild` (Radix Slot)

### `<NeonChip>`

Small pill for buffs, costs, and status indicators.

```tsx
import { NeonChip } from '@/components/ui/neon-chip';

<NeonChip variant="buff">+10 PV</NeonChip>
<NeonChip variant="cost">-$5.00</NeonChip>
<NeonChip variant="info">Active</NeonChip>
<NeonChip variant="warning">Low</NeonChip>
```

**Variants:** `buff` (green), `cost` (red), `info` (cyan, default), `warning` (amber)

### `<HUDStatPill>`

Clickable stat display for the top HUD bar.

```tsx
import { HUDStatPill } from '@/components/ui/hud-stat-pill';
import { Wallet } from 'lucide-react';

<HUDStatPill label="Balance" value="$42.00" icon={Wallet} />
<HUDStatPill label="Day" value={7} icon={Clock} active />
<HUDStatPill label="Queue" value={3} icon={Timer} onClick={openQueue} />
```

**Props:** `label`, `value`, `icon` (LucideIcon), `active?`, `onClick?`, `className?`

## Accessibility

- All glass components respect `prefers-reduced-motion: reduce` — animations and transitions are disabled.
- `GlassButton` sets `aria-busy="true"` when loading and hides children behind a spinner with `sr-only` "Loading" text.
- Touch targets: all interactive elements maintain 44px minimum (enforced by e2e tests).
- Contrast: glass surfaces use low-opacity backgrounds against the dark gradient, keeping text at WCAG AA contrast.

## Performance Notes

- `backdrop-filter: blur()` can be expensive on low-end devices. The glass utility classes use modest blur values (8–16px) to minimize GPU load.
- The `vignette-bg` class uses a CSS gradient (no extra image assets).
- No new npm dependencies were added — everything uses existing Tailwind, CVA, and Radix primitives.
