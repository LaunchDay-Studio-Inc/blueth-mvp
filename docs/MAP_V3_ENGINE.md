# Map V3 Engine -- Layer Order & Pointer-Events Rules

> Companion doc to `MAP_V3_SPEC.md`. This covers the rendering engine implementation.

---

## SVG Layer Stack (bottom to top)

All layers live inside a single `<svg>` with `viewBox="0 0 1200 900"`.
A wrapping `<g id="pan-zoom-root">` applies `transform: translate(tx,ty) scale(s)` for pan/zoom.

| Order | Layer `<g>` id | pointer-events | Contents |
|-------|---------------|----------------|----------|
| 1 | `layer-terrain` | `none` | Land fill, water fill, green patches, industrial haze |
| 2 | `layer-water` | `none` | Animated wave lines, dock/pier decorations |
| 3 | `layer-roads` | `none` | Road paths (highway, primary, secondary, tertiary) |
| 4 | `layer-districts` | `none` | Filled district polygons, gradient overlays, glow effects |
| 5 | `layer-buildings` | `none` | 3D isometric building scenes (clipped inside districts) |
| 6 | `layer-landmarks` | `none` | Per-district landmark SVG icons |
| 7 | `layer-labels` | `none` | District name text labels |
| 8 | `layer-effects` | `none` | Vignette, fog, neon flickers |
| 9 | `layer-hit-targets` | **`all`** | Invisible district polygons + POI circles (the ONLY interactive layer) |
| 10 | `layer-debug` | `none` | Dev-only: visible hit polygons and POI circles in red/green |

## Pointer-Events Rules

```
ALL art layers (1-8):     pointer-events: none
Hit-target layer (9):     pointer-events: all
Debug layer (10):         pointer-events: none (visual only)

Within layer-hit-targets:
  - Each district:  <polygon fill="transparent" pointer-events="all" />
  - Each POI:       <circle r="22" fill="transparent" pointer-events="all" />
```

**Critical rule**: No element outside `layer-hit-targets` may have `pointer-events` set to anything other than `none`. This prevents any art element from stealing clicks.

## Pan/Zoom Engine

### State
```typescript
interface MapViewState {
  x: number;      // translate X
  y: number;      // translate Y
  scale: number;  // zoom level (1.0 = fit-all, 4.0 = max)
}
```

### Input handling
- **Wheel**: `onWheel` on SVG container. `deltaY < 0` zooms in, `> 0` zooms out. Zoom centered on cursor position.
- **Drag**: `onPointerDown` -> `onPointerMove` -> `onPointerUp`. Uses `setPointerCapture` for clean dragging.
- **Pinch**: Track two-finger touch via `onTouchStart/Move/End`. Scale = ratio of current pinch distance to initial distance.
- **Buttons**: +/- buttons call `zoomIn()`/`zoomOut()` centered on viewport center.
- **Reset**: Button resets to `{ x: 0, y: 0, scale: 1 }`.

### Zoom constraints
- Min scale: `1.0` (fit all)
- Max scale: `4.0`
- Smooth transition via CSS `transition: transform 150ms ease-out` on programmatic zoom (buttons), no transition on drag/pinch.

### Pan constraints
- Map cannot be panned entirely off-screen. Clamp `x` and `y` so at least 50% of the map is visible.

## Hit Target Sizing

- District polygons: use the same polygon as the visual district, but `fill="transparent"`.
- POI circles: `r="22"` in SVG units, ensuring >= 44px at 1x zoom on a typical viewport.

## Debug Overlay

Toggle via `?debug=map` query param (dev only; stripped in production).

When active:
- District hit polygons render with `fill="rgba(255,0,0,0.2)"` + `stroke="red"` + `strokeWidth="2"`
- POI hit circles render with `fill="rgba(0,255,0,0.3)"` + `stroke="lime"` + `strokeWidth="2"`
- Layer renders ABOVE the hit-target layer visually but with `pointer-events: none` so it doesn't block clicks

## Component Architecture

```
CityPage
  +-- CityMapV3 (SVG + pan/zoom engine)
  |     +-- <g id="pan-zoom-root" transform="...">
  |     |     +-- TerrainLayer       (pointer-events: none)
  |     |     +-- WaterLayer         (pointer-events: none)
  |     |     +-- RoadsLayer         (pointer-events: none)
  |     |     +-- DistrictsLayer     (pointer-events: none)
  |     |     +-- BuildingsLayer     (pointer-events: none)
  |     |     +-- LandmarksLayer     (pointer-events: none)
  |     |     +-- LabelsLayer        (pointer-events: none)
  |     |     +-- EffectsLayer       (pointer-events: none)
  |     |     +-- HitTargetsLayer    (pointer-events: all)  <-- THE interactive layer
  |     |     +-- DebugOverlay       (pointer-events: none, dev only)
  |     +-- ZoomControls (HTML overlay, absolute positioned)
  +-- DistrictPanel (existing, unchanged)
```
