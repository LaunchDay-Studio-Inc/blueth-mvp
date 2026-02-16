# Map V3 — Terrain Layer Spec

Describes the terrain, water, and road enhancements added in `map/v3-terrain-v1`.

## ViewBox

`0 0 1200 900` — same as V3 engine.

## Geography Rules

| Feature | Placement |
|---------|-----------|
| Ocean | East edge (x ≥ 850), deep gradient fading west |
| Coastline | Curved path from (850,0) to (850,900) with natural wobble |
| Beach/sand | Thin strip hugging the coastline, gradient from transparent to sand |
| Canal | Runs from Harbor (860,490) southwest to Outskirts (420,640) |
| Parks | Elliptical green areas near University, Suburbs N/S, and Outskirts |
| Industrial haze | Hatched ellipse over Industrial district (790,550) |

## Terrain Layer (Layer 1)

1. **Base land** — `radialGradient` dark blue-grey (`hsl(222 47% 7%)`).
2. **Noise texture** — `feTurbulence` fractalNoise (baseFrequency 0.9, 4 octaves, seed 42) blended via `feBlend mode="overlay"` at 4% alpha. Adds grit without performance cost.
3. **Grid underlay** — 30×30 px `<pattern>` with faint cyan lines at 6% opacity.
4. **Ocean** — `linearGradient` from deep (`#083344`) to shallow (`#0E7490`), clipped to a curved coastal path. Wave pattern overlay at 60%.
5. **Beach strip** — Narrow path along coast with sand-colored gradient (`#D4A574`), 6–12% opacity.
6. **Coastline shadow** — `feGaussianBlur(6)` + `feFlood(#000, 0.25)` composited under the coast edge for depth.
7. **Canal** — 6px stroke `#0E7490` at 10% opacity, plus a faint 1px dashed cyan highlight for shimmer.
8. **Parks** — `radialGradient` green ellipses:
   - University campus (295,370) 75×55
   - Suburbs N (385,220) 65×45 + satellite patches
   - Suburbs S (355,635) 60×45
   - Outskirts fields (180,440) 45×90 + patches
   All at 3–12% opacity for subtle integration.
9. **Industrial zone** — Hatched pattern (`rotate(45)` lines at 6% opacity) + smog ellipse at 3%.

## Water Layer (Layer 2)

1. **Wave lines** — 7 animated `<path>` elements at y positions 120–740. Each has unique width (0.4–0.6), opacity (0.06–0.12), dash pattern, and animation duration (4–6s). Uses `stroke-dashoffset` animation.
2. **Shoreline foam** — Dashed white line along coast edge, animated.
3. **Marina piers** — 3 piers with finger piers extending south. Main pier at y=230, secondary at y=270, third at y=300. `#64748B` at 12–20% opacity.
4. **Harbor docks** — Heavy cargo pier at y=390 (40px wide) with crane track line. Secondary pier at y=430. Breakwater curve at y=460.
5. **Canal detail** — Faint animated dashed line following the canal path.

## Road Network (Layer 3)

### Hierarchy

| Type | Width | Opacity | Style |
|------|-------|---------|-------|
| Highway | 5px | 0.18 | Double-line with dashed yellow center |
| Primary | 2.5px | 0.14 | Solid |
| Secondary | 1.8px | 0.10 | Solid |
| Tertiary | 1.2px | 0.08 | Dashed (6 4) |

### Road Count: 30

- **1 highway** — Ring road encircling the city
- **7 primary** — Main Ave, University Blvd, Marina Dr, Tech Corridor, Harbor Freight, CBD South
- **7 secondary** — Waterfront Rd, suburb arterials (N/S), outskirts links (N/S), industrial-south, entertainment-CBD
- **15 tertiary** — Local streets: Old Town lane, entertainment strip, CBD grid (4 streets in H/V grid), suburb curves (4), tech campus loop, university quad, marina promenade, outskirts trail

### Road Labels

6 road name labels rendered at zoom ≥ 1.4×:
- Ring Road, Main Ave, University Blvd, Marina Dr, Freight Rd, Waterfront Rd

Styled as 7px monospace, rotated to follow road angle.

## SVG Filters & Patterns

| ID | Type | Purpose |
|----|------|---------|
| `v3-terrain-noise` | filter | feTurbulence noise overlay on land |
| `v3-coast-shadow` | filter | Drop shadow along coastline |
| `v3-sea-deep` | linearGradient | Ocean depth gradient |
| `v3-beach` | linearGradient | Sand-colored beach strip |
| `v3-park-grad` | radialGradient | Green park areas |
| `v3-hatch` | pattern | 45° line hatching for industrial zone |
| `v3-wave-pat` | pattern | Repeating wave curves for ocean |
| `v3-canal` | linearGradient | Canal water color |
| `v3-grid` | pattern | Faint city grid underlay |

## Clickability

All terrain, water, and road elements live in layers 1–3 with `pointer-events: none`. Hit targets remain in Layer 9 (`pointer-events: all`). No clickability regression.

## Debug

Existing debug overlay (Layer 10) still works — shows district polygons in red, POI circles in green, center dots in yellow. Toggle via dev button or `?debug` query param.
