# UI Art Direction — Blueth City

## Vision

Blueth City should feel like a **city life sim**, not a SaaS dashboard.
Every screen should reinforce the idea that the player is navigating a
living, breathing city at night.

---

## Color Palette

| Token | HSL | Usage |
|---|---|---|
| `--background` | `222 47% 6%` | Deep navy-black base |
| `--foreground` | `210 20% 90%` | Soft off-white text |
| `--primary` (neon) | `192 91% 52%` | Teal/cyan accent — buttons, links, glows |
| `--card` | `222 44% 8%` | Elevated surface |
| `--muted` | `220 25% 12%` | Recessed surface |
| `--destructive` | `0 72% 50%` | Red for errors, low-vigor warnings |

### Accent Colors
- **Neon teal** (`hsl(192 91% 52%)`) is the hero accent.
- Window glow colors: warm yellow `hsl(50 80% 70%)`, neon cyan `hsl(192 80% 60%)`,
  amber `hsl(38 90% 60%)`.
- Vigor bars keep their existing green/yellow/red semantics.

---

## Typography

- **Font**: Inter (via `next/font/google`)
- **Headings**: `font-black`, `tracking-tight`, uppercase for major titles
- **Labels**: `text-xs`, `uppercase`, `tracking-wider` or `tracking-[0.15em]`
- **Body**: `text-sm`, `leading-relaxed`
- **Monospace accents**: `font-mono` for username, price modifiers, stats

---

## Surfaces & Depth

1. **Base layer**: `game-gradient` — subtle vertical gradient from deep navy to slightly lighter.
2. **Cards**: `bg-card/80 backdrop-blur-md` — semi-transparent with blur.
3. **Borders**: `border-border/30` to `border-border/50` — never fully opaque.
4. **Noise texture**: Applied to `body` via inline SVG `feTurbulence` at `opacity: 0.03`.

---

## Neon Glow System

Three levels:
1. **`neon-text`**: Text color + `text-shadow` glow.
2. **`neon-border`**: Border color + `box-shadow` glow.
3. **`neon-glow-strong`**: Double-layer box-shadow for primary CTAs.

Usage: Primary action buttons get `neon-glow-strong`. Active sidebar items
and selected map districts get `neon-border`. The "BLUETH CITY" title uses
`neon-text` with `animate-flicker`.

---

## Login / Register Scene

- Fullscreen with `skyline-gradient` background.
- SVG city skyline composited at the bottom with `opacity-60`.
- Skyline is purely procedural SVG — buildings, windows with colored glow,
  antenna lights with `animate-pulse-neon`.
- Form card floats over skyline with backdrop blur.
- Flavor copy sets the tone: immersive, short, no corporate jargon.
- Guest entry button visible on login for frictionless onboarding.

---

## City Map (Board)

- Dark background with subtle SVG grid overlay (`pattern` element).
- Districts rendered at reduced opacity (`0.55`) with brightened hover/select states.
- Active districts get:
  - A secondary glow polygon behind them (blurred, `opacity: 0.3`).
  - Neon-cyan stroke.
  - `brightness(1.3)` CSS filter.
  - Text shadow glow on the label.
- 200ms transitions on all interactive properties.
- Entire map wrapped in `neon-border` rounded container.

---

## District Dossier Panel

- Header: "District Dossier" micro-label + district name + price badge.
- Top neon accent line via gradient `from-transparent via-primary/60 to-transparent`.
- **Vibe text**: One-line evocative quote per district in italics.
- Points of interest: `MapPin` icons with hover highlight.
- Quick action buttons: "Find Work", "Grab Food", "Housing" — link to game pages.
- Footer: monospace price modifier readout.

---

## HUD (Game Shell)

- Top bar: `bg-card/70 backdrop-blur-md`, neon "BLUETH CITY" brand.
- Separators: thin `bg-border/40` dividers instead of Radix Separator component.
- Sidebar: `bg-card/30` with `neon-border` on active item.
- Mobile overlay: `bg-black/60 backdrop-blur-sm` scrim.
- Bottom nav: `bg-card/80 backdrop-blur-md`, active item gets `text-shadow` glow.
- Low-vigor dots get red `box-shadow` glow when critical.

---

## Animations

| Class | Effect | Duration | Use |
|---|---|---|---|
| `animate-float` | Gentle vertical bob | 3s infinite | Decorative elements |
| `animate-pulse-neon` | Opacity pulse | 2s infinite | Antenna lights, indicators |
| `animate-flicker` | Neon sign flicker | 4s infinite | Main title |
| `animate-slide-up` | Fade + slide from below | 0.5s once | Cards, panels on mount |
| `animate-fade-in` | Simple fade | 0.4s once | Delayed decorative text |

All animations use `ease-in-out` or `ease-out`. No spring physics
or heavy JS animation libraries — CSS only for performance.

---

## Assets Policy

- **No external images** — all visuals are procedural SVG or CSS.
- Skyline is a React component rendering inline `<svg>`.
- Grid patterns use SVG `<pattern>` elements.
- Noise uses SVG `<feTurbulence>` filter.
- Icons come from `lucide-react` (MIT licensed).
