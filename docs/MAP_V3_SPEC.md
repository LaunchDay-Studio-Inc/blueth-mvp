# Map V3 Spec -- Code-Generated City Map

> Status: Draft
> Branch: `map/v3-spec`
> Scope: Frontend only (`apps/web`). No backend changes.

---

## 1. Current State (V2)

| Aspect | V2 Implementation |
|---|---|
| Renderer | Inline SVG, single `<svg>` element |
| Layout | 12 hardcoded hexagonal polygons (`points` strings) |
| Terrain | Decorative ellipses for green areas + a water path on the east coast |
| Buildings | 3D isometric helpers (`isoBox`, `pointedBox`, `domeBox`) clipped inside polygons |
| Roads | 16 dashed curved `<path>` lines between polygon centers |
| Interaction | Hover highlight + click selects district; no pan/zoom |
| Panel | `DistrictPanel` slides up with vibe text, POIs, quick actions |
| Mobile | No pinch-zoom; polygons are small on phone screens |
| Accessibility | None (no keyboard nav, no screen reader support) |
| File | `city-map.tsx` -- ~820 lines, monolithic |

### What works well
- Pure SVG, no external assets -- fully self-contained
- Glassmorphism + glow effects convey cyberpunk tone
- District scenes give each zone visual identity
- Click interaction is functional after the recent pointer-events fix

### What needs improvement
- Polygons feel abstract, not like a real city map
- No pan/zoom makes mobile unusable
- No water coastline geography -- Marina/Harbor are landlocked hexagons
- Road network is decorative, not geographic
- No POI markers on the map itself
- No accessibility path

---

## 2. Map V3 Goals

1. The map should look and feel like a **top-down illustrated city map** -- think a stylized transit/tourist map meets cyberpunk game UI.
2. All visuals are **code-generated SVG primitives**. Zero external images, zero icon fonts.
3. Geography must be **coherent** -- water where it belongs, roads connecting meaningfully, districts in sensible locations.
4. Must support **pan + zoom** (mouse drag / scroll, touch pinch).
5. Must work on **mobile** (360px+) with large enough hit targets.
6. Must have an **accessibility fallback** list view.

---

## 3. Map Layout -- Geography

### 3.1 Coordinate system

- SVG `viewBox`: `0 0 1200 900` (landscape 4:3)
- All coordinates in this spec are approximate centers; actual polygon boundaries are implementation detail.
- Origin (0,0) is top-left. X increases rightward, Y increases downward.

### 3.2 Physical geography

```
                    N
                    |
          +---------+----------+
          |                    |         ~~~~~~~~~~~~
          |     OUTSKIRTS      |       ~~  OPEN SEA  ~~
          |  (sparse, rural)   |      ~~              ~~
          +----===RING RD===---+     ~                  ~
          |         |          |    ~                    ~
  +-------+    SUBURBS_N      +---~----+                ~
  |       | (residential)     | MARINA ~                ~
  |  UNI  +--------+----------+ (docks,~                ~
  |       |  OLD   | CBD      | yachts)~                ~
  |       |  TOWN  | (towers) +--------~----+           ~
  +-------+--------+----------+ HARBOR  ~   |           ~
          | MARKET | ENTERT.  | (cargo, ~   |           ~
          |   SQ   |          | cranes) ~   |           ~
          +--------+-------+--+---------~---+           ~
          |     SUBURBS_S  |  INDUSTRIAL~               ~
          |  (residential) |   (edge)   ~               ~
          +----===RING RD==+-----------~                ~
          |                           ~                 ~
          |      OUTSKIRTS           ~                  ~
          |   (wind turbines)       ~~                  ~~
          +-----------------------+  ~~~~~~~~~~~~~~~~~~~~
```

### 3.3 District placement rationale

| District | Position | Why |
|---|---|---|
| **CBD** | Center-east | Central hub; main roads radiate from here |
| **Old Town** | Center, west of CBD | Historic core adjacent to modern CBD |
| **Marina** | East coast, north of Harbor | Coastline access, upscale waterfront |
| **Harbor** | East coast, south of Marina | Freight port, coastline access, near Industrial |
| **Tech Park** | North of CBD, slightly west | Campus-like, near University, connected to CBD by main road |
| **Industrial** | Southeast corner, coast-adjacent | Downwind (east), near Harbor freight, edge location |
| **Suburbs N** | North, inside ring road | Residential, arterial road to CBD |
| **Suburbs S** | South, inside ring road | Residential, arterial road to CBD |
| **University** | Northwest | Near transit, far from Industrial, adjacent to Old Town/Suburbs N |
| **Market Square** | Center-south, between Old Town and Entertainment | Near CBD/Old Town, pedestrian area |
| **Entertainment** | South of CBD, east of Market Sq | Neon vibe, nightlife strip, near CBD energy |
| **Outskirts** | Outside ring road (north + south fragments) | Sparse, rural, wind turbines, affordable |

### 3.4 Water

- The **east edge** of the map is coastline running roughly N-S.
- Marina and Harbor both have polygons whose eastern edges sit on the waterline.
- Open sea fills the east portion beyond the coast. Rendered with subtle animated wave lines.
- A small **river/canal** runs from the Harbor area southwest, skirting the Industrial zone (optional detail).

### 3.5 Road network

| Road | Type | Connects |
|---|---|---|
| Ring Road | Highway (thick, double-line) | Loops around all inner districts; Outskirts is outside it |
| Main Avenue | Primary (medium, solid) | CBD north-south through Market Sq |
| Harbor Freight Rd | Primary | Harbor -- Industrial -- Ring Road south |
| University Blvd | Primary | University -- Old Town -- CBD |
| Marina Drive | Primary | Marina -- CBD |
| Tech Corridor | Primary | Tech Park -- CBD |
| Waterfront Rd | Secondary (thin, solid) | Marina -- Harbor along coastline |
| Suburb N Arterial | Secondary | Suburbs N -- CBD |
| Suburb S Arterial | Secondary | Suburbs S -- Market Sq |
| Old Town Lane | Tertiary (thin, dashed) | Old Town internal streets |
| Entertainment Strip | Tertiary | Entertainment -- Market Sq |

Road rendering: roads are `<path>` elements with rounded joins. Highways get a dark fill + lighter center line. Primary roads get a single mid-weight stroke. Tertiary roads are dashed or dotted.

---

## 4. Rendering Layers

Layers render bottom-to-top in a single `<svg>`. Each layer is a `<g>` element with a descriptive `id`.

| # | Layer | id | Contents | Interactive |
|---|---|---|---|---|
| 1 | **Terrain** | `layer-terrain` | Base land fill (dark), water fill (deep blue/cyan), green patches for parks/suburbs, industrial grunge texture (hatching) | No |
| 2 | **Water detail** | `layer-water` | Animated wave lines (`<path>` with CSS `stroke-dashoffset` animation), dock/pier lines for Marina + Harbor | No |
| 3 | **Roads** | `layer-roads` | All road `<path>` elements per 3.5 table; ring road as a closed loop | No |
| 4 | **Districts** | `layer-districts` | One `<g>` per district containing: filled polygon, gradient overlay, subtle inner shadow. This is the primary clickable layer. | **Yes** |
| 5 | **Buildings** | `layer-buildings` | Simplified top-down building footprints (rectangles with fill variation). Dense in CBD, sparse in Outskirts. Gives urban texture. | No |
| 6 | **Landmarks** | `layer-landmarks` | Larger SVG illustrations for signature structures (e.g., clock tower in Old Town, lighthouse at Marina, cranes at Harbor, smokestacks at Industrial, stadium at Entertainment). One per district, positioned at a fixed offset from district center. | No (decorative) |
| 7 | **POIs** | `layer-pois` | Small marker icons at specific `[x, y]` positions within districts. Each POI is a clickable circle + mini-icon. | **Yes** |
| 8 | **Labels** | `layer-labels` | District name labels (text with halo/outline for readability). POI name labels (smaller, shown on hover or zoom). | No |
| 9 | **Effects** | `layer-effects` | Fog/atmosphere, glow on selected district, neon signs in Entertainment, water shimmer. Animated via CSS. | No |
| 10 | **UI overlay** | `layer-ui` | Zoom controls (+/- buttons), minimap thumbnail (optional), compass rose | **Yes** |

### Layer rendering notes

- **Terrain** uses simple filled `<rect>` / `<polygon>` shapes. Land is `#1a1a2e`-ish (dark navy). Water is `#0a2a4a` with slight gradient toward the coast.
- **Buildings layer** uses a procedural approach: for each district, scatter N small rectangles (rotated slightly for realism) within the polygon bounds. N varies by density: CBD=many small, Outskirts=few scattered.
- **Landmarks** are the successors to V2's `renderDistrictScene()`. They become standalone SVG groups positioned at map coordinates rather than clipped inside polygons.
- **Effects** layer uses `mix-blend-mode` and low-opacity animated elements. Kept minimal for performance.

---

## 5. Interaction Model

### 5.1 Pan and zoom

| Input | Action |
|---|---|
| Mouse wheel | Zoom in/out (centered on cursor) |
| Click + drag (on empty space) | Pan the map |
| Touch pinch | Zoom in/out (centered between fingers) |
| Touch drag (one finger) | Pan the map |
| `+` / `-` buttons | Zoom in/out (centered on viewport) |
| Double-click / double-tap | Zoom in one step (centered on point) |
| Home / reset button | Reset to default view (fit all districts) |

**Zoom range**: 1x (entire map visible) to 4x.

**Implementation approach**: Apply a CSS `transform: translate(tx, ty) scale(s)` on the inner `<g>` that wraps layers 1-9. The outer `<svg>` clips to viewport. Use `onPointerDown/Move/Up` for pan, `onWheel` for zoom. Store `{x, y, scale}` in React state (or ref for performance).

No third-party pan/zoom library required -- the math is simple (`translate` + `scale`). If performance is an issue, consider `d3-zoom` later.

### 5.2 District selection

| Input | Action |
|---|---|
| Click/tap a district polygon | Select that district; open dossier panel |
| Click/tap the same district again | Deselect (close panel) |
| Click/tap a different district | Switch selection |
| Click/tap empty space | Deselect |
| Keyboard: Tab + Enter | Cycle through districts + select (a11y) |

**Visual feedback on selection**:
- Selected district polygon gets a bright border glow (animated pulse).
- Other districts dim slightly (reduce opacity to ~0.6).
- Camera smoothly pans to center the selected district if it's near the edge.

**Visual feedback on hover**:
- Hovered district gets a lighter fill and a subtle border highlight.
- District name label becomes bold / brighter.
- Cursor changes to `pointer`.

### 5.3 POI interaction

| Input | Action |
|---|---|
| Click/tap a POI marker | Show POI tooltip (name + actions) |
| Hover a POI marker | Show POI name label |

POI markers are only visible at zoom >= 2x to reduce clutter at overview zoom. At 1x zoom, only district-level landmarks are visible.

### 5.4 Dossier panel (unchanged behavior, new data)

The existing `DistrictPanel` continues to slide in from the right (desktop) or bottom (mobile) when a district is selected. V3 changes:
- POI list becomes interactive (click a POI in the panel to highlight it on the map).
- Add a small inline minimap showing the selected district highlighted.
- Keep existing quick actions (Find Work, Grab Food, Housing).

---

## 6. Mobile Behavior

| Breakpoint | Behavior |
|---|---|
| >= 1024px (desktop) | Map takes ~65% width, dossier panel 35% right sidebar |
| 768-1023px (tablet) | Map full width, dossier panel slides up from bottom (half-sheet) |
| < 768px (phone) | Map full width, dossier panel is full-screen bottom sheet with drag handle |

### Mobile-specific requirements

- **Minimum hit target**: 44x44px equivalent at current zoom level for district polygons and POI markers.
- **Pinch zoom**: Handled via touch events (see 5.1).
- **Zoom level on load**: Auto-fit so all districts are visible with slight padding.
- **Prevent page scroll**: The map container captures touch events to prevent accidental page scrolling while interacting with the map.
- **Performance**: Reduce building-layer density on mobile. Skip animated effects if `prefers-reduced-motion` is set.

---

## 7. Accessibility Fallback

A **list view** toggle is provided as an alternative to the visual map.

### List view behavior

- A toggle button ("Map view" / "List view") sits above the map area.
- List view renders a vertical scrollable list of all 12 districts.
- Each district row shows: icon (inline SVG), name, terrain tag, price modifier badge, and POI count.
- Clicking/tapping a row selects that district and opens the dossier panel (same panel used by map view).
- List is keyboard-navigable (arrow keys, Enter to select).
- Screen reader: each row is a `<button>` with `aria-label="Select [District Name] district"`.

### Map view a11y

- District polygons have `role="button"` and `aria-label`.
- `tabIndex={0}` on each district group so Tab key cycles through them.
- `onKeyDown` handler: Enter/Space to select.
- Active district announced via `aria-live` region.

---

## 8. Data Model

### 8.1 `DistrictGeo` (extends existing `DistrictMeta`)

```typescript
interface DistrictGeo extends DistrictMeta {
  /** Polygon vertices as [x, y][] -- replaces the `points` string */
  polygon: [number, number][];

  /** Center point [x, y] for label and landmark placement */
  center: [number, number];

  /** Neighboring district codes (for road rendering, pathfinding) */
  neighbors: string[];

  /** Landmark definition */
  landmark: {
    name: string;
    offset: [number, number]; // relative to center
    renderer: string;         // key into LANDMARK_RENDERERS
  };
}
```

### 8.2 `POI`

```typescript
interface POI {
  id: string;              // e.g. 'cbd-stock-exchange'
  name: string;            // 'Stock Exchange'
  districtCode: string;    // 'CBD'
  position: [number, number]; // [x, y] in map coordinates
  icon: string;            // key into POI_ICONS
  actions: string[];       // e.g. ['trade', 'invest']
}
```

### 8.3 `Road`

```typescript
interface Road {
  id: string;
  type: 'highway' | 'primary' | 'secondary' | 'tertiary';
  /** SVG path data (d attribute), or array of [x,y] waypoints */
  path: string;
  connects: [string, string]; // district codes
}
```

### 8.4 `MapViewState`

```typescript
interface MapViewState {
  /** Current pan offset */
  translate: [number, number];
  /** Current zoom level (1.0 = fit-all, 4.0 = max) */
  zoom: number;
  /** Currently selected district code, or null */
  selectedDistrict: string | null;
  /** Currently hovered district code, or null */
  hoveredDistrict: string | null;
  /** Currently selected POI id, or null */
  selectedPOI: string | null;
  /** 'map' | 'list' */
  viewMode: 'map' | 'list';
}
```

### 8.5 Data file organization

| File | Contents |
|---|---|
| `lib/map/districts.ts` | `DistrictGeo[]` array with polygon coords, centers, neighbors, landmarks |
| `lib/map/pois.ts` | `POI[]` array |
| `lib/map/roads.ts` | `Road[]` array |
| `lib/map/renderers.ts` | SVG renderer functions for landmarks, POI icons, building scatter |
| `lib/map/types.ts` | All TypeScript interfaces (`DistrictGeo`, `POI`, `Road`, `MapViewState`) |

The existing `lib/districts.ts` and its `DistrictMeta` interface remain unchanged. `DistrictGeo` extends it, keeping backward compatibility with any code that uses `DistrictMeta` (economy, jobs, etc.).

---

## 9. Component Architecture

```
CityPage
  +-- MapViewToggle          (map/list switch button)
  +-- CityMapV3              (main SVG map)
  |     +-- TerrainLayer
  |     +-- WaterLayer
  |     +-- RoadsLayer
  |     +-- DistrictsLayer   (clickable polygons)
  |     +-- BuildingsLayer   (procedural building scatter)
  |     +-- LandmarksLayer   (signature icons per district)
  |     +-- POIsLayer        (clickable POI markers)
  |     +-- LabelsLayer      (district + POI text)
  |     +-- EffectsLayer     (glow, fog, neon)
  |     +-- UIOverlay        (zoom controls, compass)
  +-- DistrictListView       (a11y fallback list)
  +-- DistrictPanel          (dossier sidebar/sheet)
```

Each layer is a separate React component receiving map data as props. The pan/zoom transform is managed in `CityMapV3` and passed down as context or prop.

---

## 10. Visual Style Guide

| Element | Style |
|---|---|
| **Color palette** | Dark background (`#0d1117`), cyan accents (`#00e5ff`), warm amber for landmarks (`#ffb347`), neon magenta for Entertainment (`#ff2d95`), muted green for parks (`#2d5a3d`) |
| **District fills** | Semi-transparent gradients per terrain type. Urban = blue-gray. Water = deep teal. Green = forest green. Industrial = brown-gray. Rural = dark olive. |
| **Borders** | 1px stroke, same hue as fill but lighter. Selected = 2px + glow. |
| **Text** | `font-family: monospace`. District labels: 12-14px, uppercase, letter-spacing 1px, white with dark halo. POI labels: 10px, mixed case. |
| **Roads** | Highway: 4px dark gray + 2px lighter center. Primary: 2px gray. Tertiary: 1px dashed. |
| **Water** | Dark teal base. Animated horizontal wave lines (sine-wave paths with `stroke-dashoffset` animation, period ~4s). |
| **Buildings** | Tiny filled rectangles (2-6px), slightly rotated, color = district fill but darker. CBD has tall narrow ones (implying skyscrapers from above). Suburbs have wider spaced ones. |
| **Landmarks** | ~30x30px SVG groups. Clean line-art style. Matches V2 icon aesthetic but larger. |
| **Glow effects** | Gaussian blur radius 8-12px, opacity 0.4, matching district accent color. |
| **Animations** | Water waves (CSS `stroke-dashoffset`), district glow pulse on select (CSS `opacity` keyframes), neon flicker in Entertainment (CSS `opacity` random keyframes). All respect `prefers-reduced-motion`. |

---

## 11. Definition of Done

Map V3 is complete when **all** of the following are true:

### Must-have (MVP)

- [ ] All 12 districts render as filled polygons in geographically coherent positions per section 3.
- [ ] Marina and Harbor polygons touch the eastern water coastline.
- [ ] CBD is central; Industrial is on the edge near Harbor.
- [ ] Water body renders on the east side with at least static wave detail.
- [ ] Road network renders with at least ring road + primary roads.
- [ ] Each district has a landmark SVG icon rendered on the map.
- [ ] Click/tap a district selects it and opens the existing `DistrictPanel`.
- [ ] Pan (drag) and zoom (scroll/pinch) work on desktop and mobile.
- [ ] Zoom range: 1x to 4x.
- [ ] Zoom controls (+/-/reset) are visible on-screen.
- [ ] Mobile: pinch-zoom works; district polygons are tappable at default zoom.
- [ ] Accessibility list view exists and can select districts.
- [ ] District polygons have `role="button"`, `aria-label`, and keyboard focus support.
- [ ] No external images, icon fonts, or runtime asset downloads used.
- [ ] `city-map.tsx` monolith is replaced by the component architecture in section 9.
- [ ] Existing `DistrictMeta` interface and `DISTRICTS` array remain backward-compatible.
- [ ] Page loads in under 2s on a mid-range phone (no heavy computation in render path).
- [ ] All animated effects respect `prefers-reduced-motion: reduce`.

### Should-have (post-MVP polish)

- [ ] POI markers render on the map at zoom >= 2x and are clickable.
- [ ] Clicking a POI in the dossier panel highlights it on the map.
- [ ] Building scatter layer adds urban texture.
- [ ] Animated water waves.
- [ ] Neon flicker effect in Entertainment district.
- [ ] Fog / atmosphere in Effects layer.
- [ ] Smooth camera pan-to-center on district selection.
- [ ] Minimap in corner showing full map with viewport indicator.

### Won't-do (out of scope for V3)

- Pathfinding / navigation between districts.
- 3D perspective or isometric view (keep top-down).
- Dynamic district data from backend (V3 uses static frontend data).
- Map editor or procedural map generation.
- Multiplayer presence indicators on map.
