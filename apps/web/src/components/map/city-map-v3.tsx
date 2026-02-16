'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DistrictMeta } from '@/lib/districts';
import type { DistrictGeo, MapViewState } from '@/lib/map/types';
import { DISTRICTS_GEO, polygonToPoints } from '@/lib/map/districts';
import { ROADS, ROAD_LABELS } from '@/lib/map/roads';
import { POIS } from '@/lib/map/pois';
import { DISTRICT_ICONS } from '@/components/city-map';
import { Maximize2, Minimize2 } from 'lucide-react';

// ── Constants ──────────────────────────────────────

const VIEW_W = 1200;
const VIEW_H = 900;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.3;          // For +/- buttons (meaningful step)
const WHEEL_ZOOM_STEP = 0.08;   // For scroll wheel (fine-grained)
const POI_VISIBLE_ZOOM = 1.8;
const POI_HIT_RADIUS = 22;

// ── Road styles ──────────────────────────────────────

const ROAD_STYLES: Record<string, {
  casingWidth: number;
  fillWidth: number;
  casingColor: string;
  fillColor: string;
  opacity: number;
  dash?: string;
  centerLine?: { color: string; width: number; dash: string; opacity: number };
}> = {
  highway: {
    casingWidth: 8,
    fillWidth: 6,
    casingColor: 'hsl(210 8% 45%)',
    fillColor: 'hsl(210 6% 62%)',
    opacity: 0.55,
    centerLine: { color: 'hsl(45 80% 60%)', width: 0.8, dash: '10 6', opacity: 0.5 },
  },
  primary: {
    casingWidth: 5,
    fillWidth: 3.5,
    casingColor: 'hsl(210 8% 50%)',
    fillColor: 'hsl(210 6% 68%)',
    opacity: 0.50,
  },
  secondary: {
    casingWidth: 3.5,
    fillWidth: 2.5,
    casingColor: 'hsl(210 6% 58%)',
    fillColor: 'hsl(210 5% 72%)',
    opacity: 0.40,
  },
  tertiary: {
    casingWidth: 2,
    fillWidth: 1.5,
    casingColor: 'hsl(210 5% 65%)',
    fillColor: 'hsl(210 4% 78%)',
    opacity: 0.30,
    dash: '5 3',
  },
};

// ── Isometric building helpers (from V2, preserved) ──

const WIN_COLOR = 'rgba(180,220,255,0.3)';

function isoBox(
  bx: number, gy: number, w: number, h: number,
  front: string, side: string, top: string, k: string
) {
  const dp = w * 0.3;
  const dh = dp * 0.5;
  const nw = Math.max(0, Math.floor((h - 6) / 7));
  return (
    <g key={k}>
      <rect x={bx} y={gy - h} width={w} height={h} fill={front} />
      <polygon
        points={`${bx+w},${gy-h} ${bx+w+dp},${gy-h-dh} ${bx+w+dp},${gy-dh} ${bx+w},${gy}`}
        fill={side}
      />
      <polygon
        points={`${bx},${gy-h} ${bx+dp},${gy-h-dh} ${bx+w+dp},${gy-h-dh} ${bx+w},${gy-h}`}
        fill={top}
      />
      {Array.from({ length: nw }, (_, i) => (
        <rect
          key={i} x={bx + 1.5} y={gy - h + 4 + i * 7}
          width={w - 3} height={2.5} fill={WIN_COLOR} rx="0.3"
        />
      ))}
    </g>
  );
}

function pointedBox(
  bx: number, gy: number, w: number, h: number,
  front: string, side: string, roof: string, k: string,
  roofH?: number
) {
  const dp = w * 0.3;
  const dh = dp * 0.5;
  const rh = roofH ?? w * 0.5;
  const nw = Math.max(0, Math.floor((h - 4) / 8));
  return (
    <g key={k}>
      <rect x={bx} y={gy - h} width={w} height={h} fill={front} />
      <polygon
        points={`${bx+w},${gy-h} ${bx+w+dp},${gy-h-dh} ${bx+w+dp},${gy-dh} ${bx+w},${gy}`}
        fill={side}
      />
      <polygon
        points={`${bx-0.5},${gy-h} ${bx+w/2},${gy-h-rh} ${bx+w+0.5},${gy-h}`}
        fill={roof}
      />
      <polygon
        points={`${bx+w+0.5},${gy-h} ${bx+w/2},${gy-h-rh} ${bx+w/2+dp},${gy-h-rh-dh} ${bx+w+0.5+dp},${gy-h-dh}`}
        fill={side} opacity="0.7"
      />
      {Array.from({ length: nw }, (_, i) => (
        <rect
          key={i} x={bx + 2} y={gy - h + 3 + i * 8}
          width={w - 4} height={2} fill={WIN_COLOR} rx="0.2"
        />
      ))}
      <rect x={bx + w/2 - 1.5} y={gy - 4} width={3} height={4} fill="rgba(0,0,0,0.15)" rx="0.3" />
    </g>
  );
}

function domeBox(
  bx: number, gy: number, w: number, h: number,
  front: string, side: string, dome: string, k: string
) {
  const dp = w * 0.3;
  const dh = dp * 0.5;
  const nw = Math.max(0, Math.floor((h - 4) / 7));
  return (
    <g key={k}>
      <rect x={bx} y={gy - h} width={w} height={h} fill={front} />
      <polygon
        points={`${bx+w},${gy-h} ${bx+w+dp},${gy-h-dh} ${bx+w+dp},${gy-dh} ${bx+w},${gy}`}
        fill={side}
      />
      <ellipse cx={bx + w/2} cy={gy - h} rx={w/2 + 1} ry={w * 0.35} fill={dome} />
      {Array.from({ length: nw }, (_, i) => (
        <rect
          key={i} x={bx + 2} y={gy - h + 3.5 + i * 7}
          width={w - 4} height={2} fill={WIN_COLOR} rx="0.2"
        />
      ))}
      <line x1={bx + 3} y1={gy} x2={bx + 3} y2={gy - h} stroke={front} strokeWidth="1.2" opacity="0.6" />
      <line x1={bx + w - 3} y1={gy} x2={bx + w - 3} y2={gy - h} stroke={front} strokeWidth="1.2" opacity="0.6" />
    </g>
  );
}

function renderDistrictScene(
  code: string, cx: number, cy: number, g: [string, string]
) {
  const f = `${g[0]}DD`;
  const s = `${g[1]}CC`;
  const t = `${g[0]}88`;
  const gy = cy + 20;

  switch (code) {
    case 'CBD':
      return (
        <g>
          {isoBox(cx - 40, gy, 13, 52, f, s, t, 'c1')}
          {isoBox(cx - 22, gy, 16, 70, f, s, t, 'c2')}
          {isoBox(cx + 0, gy, 12, 44, f, s, t, 'c3')}
          {isoBox(cx + 16, gy, 15, 62, f, s, t, 'c4')}
          {isoBox(cx + 35, gy, 11, 36, f, s, t, 'c5')}
          <line x1={cx - 14} y1={gy - 70} x2={cx - 14} y2={gy - 80} stroke={g[0]} strokeWidth="0.8" />
          <circle cx={cx - 14} cy={gy - 81} r="1.2" fill={g[0]} opacity="0.8" />
        </g>
      );
    case 'OLD_TOWN':
      return (
        <g>
          {pointedBox(cx - 36, gy, 14, 20, f, s, g[1], 'o1')}
          {pointedBox(cx - 16, gy, 13, 18, f, s, g[1], 'o2')}
          {pointedBox(cx + 2, gy, 11, 34, f, s, g[1], 'o3', 16)}
          {pointedBox(cx + 18, gy, 15, 22, f, s, g[1], 'o4')}
          <line x1={cx + 7.5} y1={gy - 51} x2={cx + 7.5} y2={gy - 56} stroke={g[0]} strokeWidth="0.8" />
          <line x1={cx + 5.5} y1={gy - 54} x2={cx + 9.5} y2={gy - 54} stroke={g[0]} strokeWidth="0.8" />
        </g>
      );
    case 'MARINA':
      return (
        <g>
          {isoBox(cx - 32, gy, 18, 20, f, s, t, 'm1')}
          {isoBox(cx - 8, gy, 15, 24, f, s, t, 'm2')}
          <rect x={cx + 20} y={gy - 2} width={20} height={2} fill={g[0]} opacity="0.5" rx="0.3" />
          <polygon points={`${cx+24},${gy-4} ${cx+30},${gy-10} ${cx+30},${gy-4}`} fill={g[0]} opacity="0.5" />
          <ellipse cx={cx + 28} cy={gy - 2} rx="4" ry="1.5" fill={g[0]} opacity="0.3" />
        </g>
      );
    case 'TECH_PARK':
      return (
        <g>
          {isoBox(cx - 28, gy, 14, 38, f, s, t, 't1')}
          {isoBox(cx - 8, gy, 16, 48, f, s, t, 't2')}
          {isoBox(cx + 14, gy, 13, 34, f, s, t, 't3')}
          <rect x={cx + 14} y={gy - 32} width={10} height={4} fill="rgba(120,160,255,0.3)" rx="0.5" />
        </g>
      );
    case 'MARKET_SQ':
      return (
        <g>
          <rect x={cx - 30} y={gy - 12} width={14} height={12} fill={f} />
          <path d={`M${cx-31},${gy-12} L${cx-23},${gy-19} L${cx-15},${gy-12}`} fill={g[1]} opacity="0.8" />
          <rect x={cx - 10} y={gy - 14} width={14} height={14} fill={f} />
          <path d={`M${cx-11},${gy-14} L${cx-3},${gy-22} L${cx+5},${gy-14}`} fill={g[1]} opacity="0.9" />
          <rect x={cx + 10} y={gy - 12} width={14} height={12} fill={f} />
          <path d={`M${cx+9},${gy-12} L${cx+17},${gy-19} L${cx+25},${gy-12}`} fill={g[1]} opacity="0.8" />
        </g>
      );
    case 'ENTERTAINMENT':
      return (
        <g>
          {isoBox(cx - 24, gy, 14, 28, f, s, t, 'e1')}
          {domeBox(cx - 4, gy, 18, 34, f, s, `${g[0]}AA`, 'e2')}
          {isoBox(cx + 20, gy, 12, 22, f, s, t, 'e3')}
          <circle cx={cx - 18} cy={gy - 34} r="1.5" fill={g[0]} opacity="0.4" />
          <circle cx={cx - 18} cy={gy - 34} r="3" fill={g[0]} opacity="0.1" />
        </g>
      );
    case 'UNIVERSITY':
      return (
        <g>
          {domeBox(cx - 18, gy, 20, 26, f, s, `${g[0]}BB`, 'u1')}
          {pointedBox(cx + 8, gy, 14, 20, f, s, g[1], 'u2')}
          <line x1={cx - 13} y1={gy} x2={cx - 13} y2={gy - 22} stroke={g[0]} strokeWidth="1.2" opacity="0.4" />
          <line x1={cx - 7} y1={gy} x2={cx - 7} y2={gy - 22} stroke={g[0]} strokeWidth="1.2" opacity="0.4" />
        </g>
      );
    case 'HARBOR':
      return (
        <g>
          {isoBox(cx - 30, gy, 18, 16, f, s, t, 'h1')}
          <rect x={cx + 0} y={gy - 38} width="2.5" height="38" fill={g[0]} opacity="0.8" />
          <line x1={cx + 1} y1={gy - 38} x2={cx + 22} y2={gy - 32} stroke={g[0]} strokeWidth="1.5" opacity="0.7" />
          <line x1={cx + 18} y1={gy - 33} x2={cx + 18} y2={gy - 20} stroke={g[0]} strokeWidth="0.6" opacity="0.5" />
          <rect x={cx + 16} y={gy - 20} width={4} height={3} fill={g[0]} opacity="0.5" />
          <rect x={cx + 8} y={gy - 6} width={9} height={6} fill={g[0]} opacity="0.5" rx="0.3" />
          <rect x={cx + 19} y={gy - 6} width={9} height={6} fill={g[1]} opacity="0.6" rx="0.3" />
        </g>
      );
    case 'INDUSTRIAL':
      return (
        <g>
          {isoBox(cx - 28, gy, 20, 20, f, s, t, 'i1')}
          {isoBox(cx - 2, gy, 18, 18, f, s, t, 'i2')}
          <rect x={cx - 24} y={gy - 34} width="3" height="14" fill={g[1]} opacity="0.8" />
          <rect x={cx - 16} y={gy - 30} width="3" height="10" fill={g[1]} opacity="0.7" />
          <ellipse cx={cx - 22.5} cy={gy - 37} rx="5" ry="2.5" fill={g[0]} opacity="0.08" />
        </g>
      );
    case 'SUBURBS_N':
      return (
        <g>
          {pointedBox(cx - 28, gy, 14, 14, f, s, g[1], 's1')}
          {pointedBox(cx - 8, gy, 12, 12, f, s, g[1], 's2')}
          {pointedBox(cx + 10, gy, 14, 15, f, s, g[1], 's3')}
          <circle cx={cx - 18} cy={gy - 10} r="5" fill={g[0]} opacity="0.3" />
          <rect x={cx - 17.5} y={gy - 5} width="1" height="5" fill={g[1]} opacity="0.4" />
        </g>
      );
    case 'SUBURBS_S':
      return (
        <g>
          {pointedBox(cx - 24, gy, 12, 12, f, s, g[1], 'ss1')}
          {pointedBox(cx - 6, gy, 14, 14, f, s, g[1], 'ss2')}
          {isoBox(cx + 14, gy, 16, 14, f, s, t, 'ss3')}
          <circle cx={cx - 34} cy={gy - 3} r="3.5" fill={g[0]} opacity="0.25" />
        </g>
      );
    case 'OUTSKIRTS':
      return (
        <g>
          {pointedBox(cx - 20, gy, 14, 14, f, s, g[1], 'out1')}
          <rect x={cx + 6} y={gy - 24} width="3" height="24" fill={g[0]} opacity="0.7" />
          <circle cx={cx + 7.5} cy={gy - 24} r="1.5" fill={g[1]} opacity="0.6" />
          <line x1={cx + 7.5} y1={gy - 24} x2={cx + 7.5} y2={gy - 34} stroke={g[0]} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          <line x1={cx + 7.5} y1={gy - 24} x2={cx + 16} y2={gy - 20} stroke={g[0]} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          <line x1={cx + 7.5} y1={gy - 24} x2={cx - 1} y2={gy - 20} stroke={g[0]} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        </g>
      );
    default:
      return null;
  }
}

// ── Terrain texture pattern mapping ──────────────────

const TERRAIN_PATTERN: Record<string, string> = {
  urban: 'url(#v3-tex-urban)',
  green: 'url(#v3-tex-green)',
  water: 'url(#v3-tex-water)',
  industrial: 'url(#v3-tex-industrial)',
  rural: 'url(#v3-tex-rural)',
};

// ── Seeded pseudo-random for deterministic scatter ──

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function scatterInPolygon(
  poly: [number, number][], count: number, seed: number
): [number, number][] {
  const rng = seededRandom(seed);
  const points: [number, number][] = [];
  // Bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of poly) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  let attempts = 0;
  while (points.length < count && attempts < count * 20) {
    const x = minX + rng() * (maxX - minX);
    const y = minY + rng() * (maxY - minY);
    if (pointInPolygon(x, y, poly)) {
      points.push([x, y]);
    }
    attempts++;
  }
  return points;
}

// ── Road intersection data ──
// Key junction coordinates where multiple roads meet
const ROAD_JUNCTIONS: [number, number][] = [
  [570, 380], // CBD center - hub of main-avenue, university-blvd, tech-corridor, cbd-south
  [570, 310], // CBD north - tech-corridor/main-avenue junction
  [790, 265], // Marina - marina-drive meets waterfront-rd
  [860, 415], // Harbor - waterfront-rd meets harbor-freight
  [430, 500], // Market Sq - cbd-south/entertainment-strip junction
  [550, 505], // Entertainment - entertainment-cbd meets main-avenue south
  [385, 220], // Suburbs N - suburb-n-arterial starts
  [355, 635], // Suburbs S - suburb-s-arterial starts
  [295, 370], // University - university-blvd starts
  [640, 340], // CBD east edge - tech-corridor/marina-drive
  [180, 300], // Outskirts north link
  [180, 580], // Outskirts south link
  [740, 680], // Harbor freight south terminus
  [500, 660], // Industrial-south south terminus
  [450, 370], // Old Town - suburb-n-arterial meets
];

// ── Component Props ──────────────────────────────────

interface CityMapV3Props {
  onDistrictSelect?: (district: DistrictMeta) => void;
  selectedCode?: string;
}

// ── Main Component ──────────────────────────────────

export function CityMapV3({ onDistrictSelect, selectedCode }: CityMapV3Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [viewState, setViewState] = useState<MapViewState>({ x: 0, y: 0, scale: 1 });
  const [showDebug, setShowDebug] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Drag state refs (avoid re-renders during drag)
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; startVX: number; startVY: number }>({
    active: false, startX: 0, startY: 0, startVX: 0, startVY: 0,
  });

  // Pinch state ref
  const pinchRef = useRef<{ active: boolean; startDist: number; startScale: number }>({
    active: false, startDist: 0, startScale: 1,
  });

  // ── Pan/zoom helpers ──

  const clampView = useCallback((x: number, y: number, scale: number): MapViewState => {
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    const maxPanX = VIEW_W * (s - 1) * 0.6;
    const maxPanY = VIEW_H * (s - 1) * 0.6;
    return {
      scale: s,
      x: Math.min(maxPanX, Math.max(-maxPanX, x)),
      y: Math.min(maxPanY, Math.max(-maxPanY, y)),
    };
  }, []);

  const zoomAt = useCallback((cx: number, cy: number, delta: number) => {
    setViewState((prev) => {
      const newScale = prev.scale + delta;
      const ratio = newScale / prev.scale;
      const newX = cx - ratio * (cx - prev.x);
      const newY = cy - ratio * (cy - prev.y);
      return clampView(newX, newY, newScale);
    });
  }, [clampView]);

  const zoomIn = useCallback(() => {
    zoomAt(VIEW_W / 2, VIEW_H / 2, ZOOM_STEP);
  }, [zoomAt]);

  const zoomOut = useCallback(() => {
    zoomAt(VIEW_W / 2, VIEW_H / 2, -ZOOM_STEP);
  }, [zoomAt]);

  const resetView = useCallback(() => {
    setViewState({ x: 0, y: 0, scale: 1 });
  }, []);

  // ── Fullscreen toggle ──
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  // ── Event handlers ──

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Convert screen coords to SVG viewBox coords
    const svgX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const svgY = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    const delta = e.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP;
    zoomAt(svgX, svgY, delta);
  }, [zoomAt]);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Only pan on primary button and only if clicking empty space
    if (e.button !== 0) return;
    const target = e.target as SVGElement;
    // If clicking on a hit-target, don't start pan
    if (target.dataset?.hitTarget) return;

    setIsDragging(true);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startVX: viewState.x,
      startVY: viewState.y,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [viewState.x, viewState.y]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current.active) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Convert pixel delta to viewBox-space delta
    const dx = ((e.clientX - dragRef.current.startX) / rect.width) * VIEW_W;
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * VIEW_H;
    const newState = clampView(
      dragRef.current.startVX + dx,
      dragRef.current.startVY + dy,
      viewState.scale,
    );
    setViewState(newState);
  }, [clampView, viewState.scale]);

  const handlePointerUp = useCallback(() => {
    dragRef.current.active = false;
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = {
        active: true,
        startDist: Math.hypot(dx, dy),
        startScale: viewState.scale,
      };
    }
  }, [viewState.scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 2 && pinchRef.current.active) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinchRef.current.startDist;
      const newScale = pinchRef.current.startScale * ratio;
      // Center zoom between the two fingers
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const cx = (((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) / rect.width) * VIEW_W;
      const cy = (((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) / rect.height) * VIEW_H;
      setViewState((prev) => {
        const r = newScale / prev.scale;
        return clampView(cx - r * (cx - prev.x), cy - r * (cy - prev.y), newScale);
      });
    }
  }, [clampView]);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current.active = false;
  }, []);

  // Click empty space to deselect
  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    if (!target.dataset?.hitTarget) {
      onDistrictSelect?.(null as unknown as DistrictMeta);
    }
  }, [onDistrictSelect]);

  const handleDistrictClick = useCallback((d: DistrictGeo) => {
    onDistrictSelect?.(d);
  }, [onDistrictSelect]);

  // Check debug param on mount
  const isDebug = showDebug || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'));

  // ── Transform string ──
  const transform = `translate(${viewState.x}, ${viewState.y}) scale(${viewState.scale})`;

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-xl overflow-hidden ${isFullscreen ? 'h-full' : 'aspect-[4/3] lg:aspect-auto lg:min-h-[600px] lg:h-[calc(100vh-12rem)]'}`}
      style={{
        touchAction: 'none',
        boxShadow: '0 2px 12px hsl(220 15% 15% / 0.1), 0 1px 4px hsl(220 15% 15% / 0.06)',
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleSvgClick}
      >
        <defs>
          {/* ── Filters ── */}
          <filter id="v3-district-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="v3-icon-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="v3-fog" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="30" />
          </filter>
          <filter id="v3-coast-shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="6" result="shadow" />
            <feFlood floodColor="#8B7355" floodOpacity="0.12" result="color" />
            <feComposite in="color" in2="shadow" operator="in" result="darkShadow" />
            <feMerge>
              <feMergeNode in="darkShadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* ── Noise pattern (SVG fractal noise for terrain texture) ── */}
          <filter id="v3-terrain-noise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="42" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="mono" />
            <feComponentTransfer in="mono" result="faint">
              <feFuncA type="linear" slope="0.04" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="faint" mode="overlay" />
          </filter>

          {/* ── Per-district gradients + clips ── */}
          {DISTRICTS_GEO.map((d) => (
            <linearGradient key={`grad-${d.code}`} id={`v3-grad-${d.code}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={d.gradient[0]} stopOpacity="0.55" />
              <stop offset="100%" stopColor={d.gradient[1]} stopOpacity="0.70" />
            </linearGradient>
          ))}
          {DISTRICTS_GEO.map((d) => (
            <clipPath key={`clip-${d.code}`} id={`v3-clip-${d.code}`}>
              <polygon points={polygonToPoints(d.polygon)} />
            </clipPath>
          ))}

          {/* ── Background gradient ── */}
          <radialGradient id="v3-bg-radial" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="hsl(40 20% 94%)" />
            <stop offset="60%" stopColor="hsl(40 18% 92%)" />
            <stop offset="100%" stopColor="hsl(35 15% 90%)" />
          </radialGradient>

          {/* ── Ocean: deep to shallow gradient ── */}
          <linearGradient id="v3-sea-deep" x1="0.7" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3B7CB8" stopOpacity="0.45" />
            <stop offset="40%" stopColor="#5A9BD5" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#78B4E8" stopOpacity="0.25" />
          </linearGradient>

          {/* ── Beach/sand edge gradient ── */}
          <linearGradient id="v3-beach" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D4A574" stopOpacity="0" />
            <stop offset="40%" stopColor="#D4A574" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#C8956A" stopOpacity="0.30" />
          </linearGradient>

          {/* ── Park gradient ── */}
          <radialGradient id="v3-park-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4CAF50" stopOpacity="0.25" />
            <stop offset="70%" stopColor="#388E3C" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#388E3C" stopOpacity="0.03" />
          </radialGradient>

          {/* ── Glass overlay ── */}
          <linearGradient id="v3-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.06" />
          </linearGradient>

          {/* ── Grid pattern ── */}
          <pattern id="v3-grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="hsl(220 10% 75%)" strokeWidth="0.3" opacity="0.15" />
          </pattern>

          {/* ── Hatching pattern for industrial zone ── */}
          <pattern id="v3-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#78716C" strokeWidth="0.5" opacity="0.12" />
          </pattern>

          {/* ── Terrain texture patterns ── */}

          {/* Urban: concrete grid + dots */}
          <pattern id="v3-tex-urban" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill="none" />
            <path d="M0,8 L16,8 M8,0 L8,16" stroke="#9CA3AF" strokeWidth="0.3" opacity="0.12" />
            <circle cx="4" cy="4" r="0.6" fill="#78716C" opacity="0.10" />
            <circle cx="12" cy="12" r="0.6" fill="#78716C" opacity="0.10" />
            <rect x="2" y="10" width="3" height="2" fill="#9CA3AF" opacity="0.06" rx="0.2" />
            <rect x="10" y="2" width="4" height="2.5" fill="#9CA3AF" opacity="0.06" rx="0.2" />
          </pattern>

          {/* Green: grass blades + dots */}
          <pattern id="v3-tex-green" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="none" />
            <circle cx="5" cy="5" r="1" fill="#4CAF50" opacity="0.15" />
            <circle cx="15" cy="12" r="0.8" fill="#388E3C" opacity="0.12" />
            <circle cx="10" cy="18" r="1.2" fill="#4CAF50" opacity="0.10" />
            <circle cx="2" cy="14" r="0.6" fill="#66BB6A" opacity="0.12" />
            <path d="M7,8 L7,5 M8,9 L9,6 M6,9 L5,6.5" stroke="#388E3C" strokeWidth="0.4" opacity="0.12" strokeLinecap="round" />
            <path d="M16,16 L16,13 M17,17 L18,14" stroke="#4CAF50" strokeWidth="0.4" opacity="0.10" strokeLinecap="round" />
          </pattern>

          {/* Water: ripple arcs */}
          <pattern id="v3-tex-water" width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="none" />
            <path d="M2,8 Q6,6 10,8 Q14,10 18,8" fill="none" stroke="#3B82F6" strokeWidth="0.4" opacity="0.12" />
            <path d="M6,18 Q10,16 14,18 Q18,20 22,18" fill="none" stroke="#2563EB" strokeWidth="0.3" opacity="0.10" />
            <circle cx="20" cy="5" r="0.5" fill="#60A5FA" opacity="0.10" />
          </pattern>

          {/* Industrial: cross-hatch + rust */}
          <pattern id="v3-tex-industrial" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="none" />
            <path d="M0,0 L12,12 M12,0 L0,12" stroke="#78716C" strokeWidth="0.4" opacity="0.10" />
            <circle cx="6" cy="6" r="0.8" fill="#92400E" opacity="0.08" />
            <circle cx="2" cy="10" r="0.5" fill="#78716C" opacity="0.06" />
            <rect x="8" y="1" width="2" height="1.5" fill="#57534E" opacity="0.08" rx="0.2" />
          </pattern>

          {/* Rural: field rows + earthy dots */}
          <pattern id="v3-tex-rural" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill="none" />
            <path d="M0,6 L18,6 M0,12 L18,12" stroke="#8B7355" strokeWidth="0.3" opacity="0.10" strokeDasharray="3 2" />
            <circle cx="4" cy="3" r="0.7" fill="#6B8E23" opacity="0.10" />
            <circle cx="12" cy="9" r="0.5" fill="#8B7355" opacity="0.08" />
            <circle cx="8" cy="15" r="0.6" fill="#6B8E23" opacity="0.08" />
            <path d="M14,3 L14,1" stroke="#8B7355" strokeWidth="0.5" opacity="0.08" strokeLinecap="round" />
            <path d="M16,3 L16,1.5" stroke="#8B7355" strokeWidth="0.5" opacity="0.08" strokeLinecap="round" />
          </pattern>

          {/* ── Wave pattern for water ── */}
          <pattern id="v3-wave-pat" width="60" height="12" patternUnits="userSpaceOnUse">
            <path d="M0,6 Q15,2 30,6 Q45,10 60,6" fill="none" stroke="#4A90C4" strokeWidth="0.4" opacity="0.15" />
          </pattern>

          {/* ── Canal/river gradient ── */}
          <linearGradient id="v3-canal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2E86AB" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#1A6C8B" stopOpacity="0.18" />
          </linearGradient>
        </defs>

        {/* ── Pan/Zoom root ── */}
        <g id="pan-zoom-root" transform={transform} style={{ transformOrigin: '0 0', transition: isDragging ? 'none' : 'transform 120ms ease-out' }}>

          {/* ═══ LAYER 1: Terrain ═══ */}
          <g id="layer-terrain" style={{ pointerEvents: 'none' }}>
            {/* Base land with noise texture */}
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#v3-bg-radial)" />
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#v3-bg-radial)" filter="url(#v3-terrain-noise)" />
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#v3-grid)" />

            {/* ── Ocean (east coast, deep) ── */}
            <path
              d="M850,0 L1200,0 L1200,900 L850,900 Q900,750 920,600 Q940,480 920,380 Q900,250 880,180 Q860,100 850,0 Z"
              fill="url(#v3-sea-deep)"
            />
            {/* Ocean wave texture overlay */}
            <path
              d="M850,0 L1200,0 L1200,900 L850,900 Q900,750 920,600 Q940,480 920,380 Q900,250 880,180 Q860,100 850,0 Z"
              fill="url(#v3-wave-pat)"
              opacity="0.6"
            />

            {/* ── Beach/sand strip along coastline ── */}
            <path
              d="M830,0 Q840,80 860,160 Q880,250 900,340 Q920,440 910,540 Q900,650 890,750 Q880,830 870,900 L850,900 Q860,830 870,750 Q880,650 890,540 Q900,440 890,340 Q870,250 860,160 Q850,80 840,0 Z"
              fill="url(#v3-beach)"
            />
            {/* Sand grain dots along beach */}
            {[
              [845, 80], [855, 160], [870, 260], [885, 340], [895, 420],
              [900, 500], [895, 580], [885, 660], [878, 740], [872, 820],
              [848, 120], [862, 200], [878, 300], [890, 380], [898, 460],
              [895, 540], [888, 620], [882, 700], [875, 780], [870, 860],
            ].map(([sx, sy], i) => (
              <circle key={`sand-${i}`} cx={sx} cy={sy} r={0.8 + (i % 3) * 0.3} fill="#C8956A" opacity={0.10 + (i % 4) * 0.02} />
            ))}

            {/* ── Coastline edge shadow ── */}
            <path
              d="M850,0 Q860,100 880,180 Q900,250 920,380 Q940,480 920,600 Q900,750 850,900"
              fill="none"
              stroke="#000"
              strokeWidth="3"
              opacity="0.15"
              filter="url(#v3-coast-shadow)"
            />

            {/* ── Canal from Harbor area southwest ── */}
            <path
              d="M860,490 Q820,520 780,540 Q720,570 660,585 Q600,600 540,610 Q480,620 420,640"
              fill="none"
              stroke="#2E86AB"
              strokeWidth="6"
              opacity="0.25"
              strokeLinecap="round"
            />
            <path
              d="M860,490 Q820,520 780,540 Q720,570 660,585 Q600,600 540,610 Q480,620 420,640"
              fill="none"
              stroke="#4A90C4"
              strokeWidth="1"
              opacity="0.15"
              strokeLinecap="round"
              strokeDasharray="4 8"
            />

            {/* ── Park areas (shaped, not just ellipses) ── */}
            {/* University campus green */}
            <ellipse cx="295" cy="370" rx="75" ry="55" fill="url(#v3-park-grad)" />
            <ellipse cx="280" cy="350" rx="30" ry="20" fill="#4CAF50" opacity="0.15" />
            {/* North Suburbs parks */}
            <ellipse cx="385" cy="220" rx="65" ry="45" fill="url(#v3-park-grad)" />
            <ellipse cx="350" cy="200" rx="25" ry="18" fill="#4CAF50" opacity="0.12" />
            <ellipse cx="420" cy="240" rx="20" ry="15" fill="#4CAF50" opacity="0.10" />
            {/* South Suburbs parks */}
            <ellipse cx="355" cy="635" rx="60" ry="45" fill="url(#v3-park-grad)" />
            <ellipse cx="330" cy="650" rx="22" ry="16" fill="#388E3C" opacity="0.12" />
            {/* Outskirts fields */}
            <ellipse cx="180" cy="440" rx="45" ry="90" fill="#6B8E23" opacity="0.10" />
            <ellipse cx="165" cy="350" rx="25" ry="30" fill="#6B8E23" opacity="0.08" />
            <ellipse cx="170" cy="550" rx="20" ry="35" fill="#6B8E23" opacity="0.08" />

            {/* ── Industrial haze + hatching ── */}
            <ellipse cx="790" cy="550" rx="80" ry="60" fill="#78716C" opacity="0.10" />
            <ellipse cx="790" cy="550" rx="80" ry="60" fill="url(#v3-hatch)" />
            {/* Industrial smog gradient */}
            <ellipse cx="810" cy="530" rx="50" ry="35" fill="#57534E" opacity="0.06" />
          </g>

          {/* ═══ LAYER 1b: District terrain textures ═══ */}
          <g id="layer-district-textures" style={{ pointerEvents: 'none' }}>
            {DISTRICTS_GEO.map((d) => {
              const patternFill = TERRAIN_PATTERN[d.terrain];
              if (!patternFill) return null;
              const pts = polygonToPoints(d.polygon);
              return (
                <polygon
                  key={`tex-${d.code}`}
                  points={pts}
                  fill={patternFill}
                  opacity="1"
                />
              );
            })}
          </g>

          {/* ═══ LAYER 1c: Environmental scatter ═══ */}
          <g id="layer-env-scatter" style={{ pointerEvents: 'none' }}>
            {DISTRICTS_GEO.map((d, idx) => {
              if (d.terrain === 'green') {
                // Trees: circles with trunk lines
                const trees = scatterInPolygon(d.polygon, 10, idx * 1000 + 42);
                const rng = seededRandom(idx * 1000 + 99);
                return (
                  <g key={`env-${d.code}`}>
                    {trees.map(([tx, ty], i) => {
                      const r = 4 + rng() * 4;
                      return (
                        <g key={i}>
                          <rect x={tx - 0.5} y={ty} width={1} height={r * 0.6} fill="#5D4037" opacity="0.12" rx="0.2" />
                          <circle cx={tx} cy={ty - r * 0.1} r={r} fill="#4CAF50" opacity={0.08 + rng() * 0.06} />
                          <circle cx={tx - r * 0.3} cy={ty - r * 0.3} r={r * 0.6} fill="#388E3C" opacity={0.06 + rng() * 0.04} />
                        </g>
                      );
                    })}
                  </g>
                );
              }
              if (d.terrain === 'urban') {
                // Small building footprints
                const bldgs = scatterInPolygon(d.polygon, 8, idx * 1000 + 77);
                const rng = seededRandom(idx * 1000 + 55);
                return (
                  <g key={`env-${d.code}`}>
                    {bldgs.map(([bx, by], i) => {
                      const w = 3 + rng() * 5;
                      const h = 2 + rng() * 4;
                      return (
                        <rect
                          key={i}
                          x={bx - w / 2}
                          y={by - h / 2}
                          width={w}
                          height={h}
                          fill={d.gradient[1]}
                          opacity={0.06 + rng() * 0.04}
                          rx="0.3"
                        />
                      );
                    })}
                  </g>
                );
              }
              if (d.terrain === 'rural') {
                // Field rows + fence posts
                const posts = scatterInPolygon(d.polygon, 6, idx * 1000 + 33);
                const rng = seededRandom(idx * 1000 + 44);
                return (
                  <g key={`env-${d.code}`}>
                    {posts.map(([px, py], i) => (
                      <g key={i}>
                        <line x1={px} y1={py} x2={px} y2={py - 3 - rng() * 2} stroke="#8B7355" strokeWidth="0.6" opacity="0.12" strokeLinecap="round" />
                        <circle cx={px} cy={py - 4 - rng() * 2} r="1.2" fill="#6B8E23" opacity={0.08 + rng() * 0.04} />
                      </g>
                    ))}
                    {/* Field rows */}
                    <g clipPath={`url(#v3-clip-${d.code})`}>
                      {Array.from({ length: 5 }, (_, i) => {
                        const y = d.center[1] - 60 + i * 30;
                        return (
                          <line key={`row-${i}`} x1={d.center[0] - 50} y1={y} x2={d.center[0] + 50} y2={y}
                            stroke="#8B7355" strokeWidth="0.5" opacity="0.08" strokeDasharray="4 3" />
                        );
                      })}
                    </g>
                  </g>
                );
              }
              if (d.terrain === 'industrial') {
                // Pipes + smoke wisps
                const pipes = scatterInPolygon(d.polygon, 4, idx * 1000 + 88);
                const rng = seededRandom(idx * 1000 + 66);
                return (
                  <g key={`env-${d.code}`}>
                    {pipes.map(([px, py], i) => {
                      const len = 8 + rng() * 12;
                      const angle = rng() * 180;
                      return (
                        <g key={i}>
                          <line
                            x1={px} y1={py}
                            x2={px + Math.cos(angle * Math.PI / 180) * len}
                            y2={py + Math.sin(angle * Math.PI / 180) * len}
                            stroke="#57534E" strokeWidth="1.2" opacity="0.10" strokeLinecap="round"
                          />
                          <circle cx={px} cy={py - 3} r="2" fill="#78716C" opacity="0.04" />
                        </g>
                      );
                    })}
                  </g>
                );
              }
              return null;
            })}
          </g>

          {/* ═══ LAYER 2: Water detail ═══ */}
          <g id="layer-water" style={{ pointerEvents: 'none' }}>

            {/* ── Ocean depth zones ── */}
            {/* Shallow zone (near coast) */}
            <path
              d="M850,0 Q860,100 880,180 Q900,250 920,380 Q940,480 920,600 Q900,750 850,900 L920,900 Q950,750 960,600 Q980,480 960,380 Q940,250 920,180 Q900,100 890,0 Z"
              fill="#78B4E8" opacity="0.08"
            />
            {/* Mid zone */}
            <path
              d="M890,0 Q900,100 920,180 Q940,250 960,380 Q980,480 960,600 Q950,750 920,900 L1000,900 Q1020,750 1030,600 Q1040,480 1030,380 Q1010,250 990,180 Q970,100 960,0 Z"
              fill="#5A9BD5" opacity="0.06"
            />
            {/* Deep zone */}
            <path
              d="M960,0 L1200,0 L1200,900 L1000,900 Q1020,750 1030,600 Q1040,480 1030,380 Q1010,250 990,180 Q970,100 960,0 Z"
              fill="#3B7CB8" opacity="0.05"
            />

            {/* Animated wave lines along coastline (multiple depths) */}
            {[
              { y: 120, w: 0.6, o: 0.20, dur: 4 },
              { y: 200, w: 0.5, o: 0.18, dur: 5.2 },
              { y: 300, w: 0.5, o: 0.18, dur: 6 },
              { y: 400, w: 0.5, o: 0.16, dur: 4.8 },
              { y: 500, w: 0.4, o: 0.14, dur: 5.5 },
              { y: 620, w: 0.4, o: 0.12, dur: 4.3 },
              { y: 740, w: 0.4, o: 0.10, dur: 5.8 },
            ].map(({ y, w, o, dur }) => (
              <path key={`wave-${y}`}
                d={`M${850 + Math.sin(y * 0.01) * 20},${y} Q${910 + Math.cos(y * 0.02) * 10},${y - 5} ${960 + Math.sin(y * 0.015) * 15},${y}`}
                fill="none" stroke="#4A90C4" strokeWidth={w} opacity={o}
                strokeDasharray="8 6"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="28" dur={`${dur}s`} repeatCount="indefinite" />
              </path>
            ))}

            {/* Shoreline foam line */}
            <path
              d="M850,0 Q860,100 880,180 Q900,250 920,380 Q940,480 920,600 Q900,750 850,900"
              fill="none"
              stroke="#C5DCF0"
              strokeWidth="1.5"
              opacity="0.18"
              strokeDasharray="3 6"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="18" dur="3s" repeatCount="indefinite" />
            </path>

            {/* ── Marina docks (detailed piers) ── */}
            {/* Main pier */}
            <rect x="870" y="230" width="35" height="3" fill="#64748B" opacity="0.40" rx="0.5" />
            {/* Finger piers */}
            <rect x="875" y="233" width="2" height="12" fill="#64748B" opacity="0.30" rx="0.3" />
            <rect x="885" y="233" width="2" height="12" fill="#64748B" opacity="0.30" rx="0.3" />
            <rect x="895" y="233" width="2" height="12" fill="#64748B" opacity="0.30" rx="0.3" />
            {/* Second pier */}
            <rect x="865" y="270" width="30" height="3" fill="#64748B" opacity="0.35" rx="0.5" />
            <rect x="870" y="273" width="2" height="10" fill="#64748B" opacity="0.25" rx="0.3" />
            <rect x="880" y="273" width="2" height="10" fill="#64748B" opacity="0.25" rx="0.3" />
            <rect x="890" y="273" width="2" height="10" fill="#64748B" opacity="0.25" rx="0.3" />
            {/* Third pier */}
            <rect x="860" y="300" width="25" height="2.5" fill="#64748B" opacity="0.30" rx="0.3" />

            {/* ── Harbor docks (heavy industrial piers) ── */}
            {/* Main cargo pier */}
            <rect x="905" y="390" width="40" height="5" fill="#475569" opacity="0.40" rx="0.5" />
            {/* Crane track on pier */}
            <line x1="910" y1="392" x2="940" y2="392" stroke="#94A3B8" strokeWidth="0.8" opacity="0.25" />
            {/* Secondary pier */}
            <rect x="910" y="430" width="35" height="4" fill="#475569" opacity="0.35" rx="0.5" />
            {/* Breakwater */}
            <path
              d="M895,460 Q920,465 945,458"
              fill="none" stroke="#475569" strokeWidth="3" opacity="0.25" strokeLinecap="round"
            />

            {/* Canal water detail */}
            <path
              d="M855,488 Q815,518 775,538 Q715,568 655,583 Q595,598 535,608"
              fill="none" stroke="#4A90C4" strokeWidth="0.5" opacity="0.12"
              strokeDasharray="4 6"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="20" dur="7s" repeatCount="indefinite" />
            </path>

            {/* ── Foam dots along shoreline ── */}
            {[
              [856, 100], [870, 170], [884, 240], [900, 320], [910, 400],
              [915, 470], [910, 540], [898, 610], [888, 680], [878, 750],
              [868, 820], [860, 140], [876, 210], [892, 280], [905, 360],
              [912, 440], [908, 520], [896, 590], [884, 660], [874, 730],
            ].map(([fx, fy], i) => (
              <circle key={`foam-${i}`} cx={fx} cy={fy} r={1 + (i % 3) * 0.5} fill="#E0F0FF" opacity={0.15 + (i % 5) * 0.02} />
            ))}

            {/* ── Rocky edges near harbor ── */}
            {[
              [905, 370], [912, 385], [920, 400], [925, 420], [918, 445],
              [910, 460], [900, 475], [895, 490],
            ].map(([rx, ry], i) => (
              <polygon
                key={`rock-${i}`}
                points={`${rx},${ry} ${rx + 3},${ry - 1.5} ${rx + 5},${ry + 1} ${rx + 3},${ry + 2.5} ${rx + 1},${ry + 2}`}
                fill="#64748B"
                opacity={0.10 + (i % 3) * 0.03}
              />
            ))}

            {/* ── Extra shoreline contour lines ── */}
            <path
              d="M845,0 Q855,95 875,175 Q895,245 915,375 Q935,475 915,595 Q895,745 845,895"
              fill="none" stroke="#8BB8D6" strokeWidth="0.5" opacity="0.12" strokeDasharray="6 4"
            />
            <path
              d="M840,0 Q850,90 870,170 Q890,240 910,370 Q930,470 910,590 Q890,740 840,890"
              fill="none" stroke="#A6CCE0" strokeWidth="0.3" opacity="0.08" strokeDasharray="3 5"
            />
          </g>

          {/* ═══ LAYER 3: Roads ═══ */}
          <g id="layer-roads" style={{ pointerEvents: 'none' }}>
            {/* Pass 1: Road casings (all roads, bottom layer) */}
            {ROADS.map((road) => {
              const style = ROAD_STYLES[road.type] ?? ROAD_STYLES.tertiary;
              return (
                <path
                  key={`casing-${road.id}`}
                  d={road.path}
                  fill="none"
                  stroke={style.casingColor}
                  strokeWidth={style.casingWidth}
                  opacity={style.opacity * 0.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={style.dash}
                />
              );
            })}
            {/* Pass 2: Road fills (lighter inner stroke) */}
            {ROADS.map((road) => {
              const style = ROAD_STYLES[road.type] ?? ROAD_STYLES.tertiary;
              return (
                <path
                  key={`fill-${road.id}`}
                  d={road.path}
                  fill="none"
                  stroke={style.fillColor}
                  strokeWidth={style.fillWidth}
                  opacity={style.opacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={style.dash}
                />
              );
            })}
            {/* Pass 3: Center lines (highway only) */}
            {ROADS.map((road) => {
              const style = ROAD_STYLES[road.type] ?? ROAD_STYLES.tertiary;
              if (!style.centerLine) return null;
              return (
                <path
                  key={`center-${road.id}`}
                  d={road.path}
                  fill="none"
                  stroke={style.centerLine.color}
                  strokeWidth={style.centerLine.width}
                  opacity={style.centerLine.opacity}
                  strokeDasharray={style.centerLine.dash}
                  strokeLinecap="round"
                />
              );
            })}
            {/* Pass 4: Road intersections */}
            {ROAD_JUNCTIONS.map(([jx, jy], i) => (
              <g key={`junction-${i}`}>
                <circle cx={jx} cy={jy} r="4" fill="hsl(210 6% 68%)" opacity="0.45" />
                <circle cx={jx} cy={jy} r="4" fill="none" stroke="hsl(210 8% 50%)" strokeWidth="0.8" opacity="0.35" />
              </g>
            ))}
          </g>

          {/* ═══ LAYER 4: Districts ═══ */}
          <g id="layer-districts" style={{ pointerEvents: 'none' }}>
            {DISTRICTS_GEO.map((d) => {
              const isSelected = selectedCode === d.code;
              const isHovered = hoveredCode === d.code;
              const isActive = isSelected || isHovered;
              const pts = polygonToPoints(d.polygon);

              return (
                <g key={d.code}>
                  {/* Glow */}
                  {isActive && (
                    <polygon
                      points={pts}
                      fill={d.gradient[0]}
                      opacity="0.35"
                      filter="url(#v3-district-glow)"
                    />
                  )}

                  {/* Clipped content */}
                  <g clipPath={`url(#v3-clip-${d.code})`}>
                    <polygon
                      points={pts}
                      fill={`url(#v3-grad-${d.code})`}
                      opacity={isActive ? 0.9 : 0.55}
                      style={{ transition: 'opacity 300ms ease' }}
                    />
                    <polygon
                      points={pts}
                      fill="url(#v3-glass)"
                      opacity={isActive ? 0.5 : 0.3}
                      style={{ transition: 'opacity 300ms ease' }}
                    />
                  </g>

                  {/* Border */}
                  <polygon
                    points={pts}
                    fill="none"
                    stroke={
                      isSelected ? 'hsl(192 55% 38%)'
                      : isHovered ? 'hsl(192 45% 45%)'
                      : d.stroke
                    }
                    strokeWidth={isSelected ? 3 : isHovered ? 2 : 0.5}
                    style={{ transition: 'stroke 300ms ease, stroke-width 300ms ease' }}
                  />
                </g>
              );
            })}
          </g>

          {/* ═══ LAYER 5: Buildings (3D scenes clipped) ═══ */}
          <g id="layer-buildings" style={{ pointerEvents: 'none' }}>
            {DISTRICTS_GEO.map((d) => (
              <g key={`bldg-${d.code}`} clipPath={`url(#v3-clip-${d.code})`}>
                {renderDistrictScene(d.code, d.center[0], d.center[1], d.gradient)}
              </g>
            ))}
          </g>

          {/* ═══ LAYER 6: Landmarks (district icons) ═══ */}
          <g id="layer-landmarks" style={{ pointerEvents: 'none' }}>
            {DISTRICTS_GEO.map((d, idx) => {
              const isActive = selectedCode === d.code || hoveredCode === d.code;
              return (
                <g key={`icon-${d.code}`}
                  transform={`translate(${d.center[0] - 14}, ${d.center[1] - 26})`}
                >
                  <g
                    className={isActive ? '' : 'animate-icon-float'}
                    style={{
                      animationDelay: `${(idx * 0.4) % 3}s`,
                      opacity: isActive ? 1 : 0.7,
                      filter: isActive ? 'url(#v3-icon-glow)' : 'none',
                    }}
                  >
                    <g style={{ transform: 'scale(1.15)', transformOrigin: '12px 12px' }}>
                      {DISTRICT_ICONS[d.icon]?.(isActive ? '#fff' : d.gradient[0])}
                    </g>
                  </g>
                </g>
              );
            })}
          </g>

          {/* ═══ LAYER 7: Labels ═══ */}
          <g id="layer-labels" style={{ pointerEvents: 'none' }}>
            {DISTRICTS_GEO.map((d) => {
              const isActive = selectedCode === d.code || hoveredCode === d.code;
              return (
                <text
                  key={`label-${d.code}`}
                  x={d.center[0]}
                  y={d.center[1] + 12}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="select-none"
                  style={{
                    fill: isActive ? 'hsl(220 15% 15%)' : 'hsl(220 12% 35%)',
                    fontSize: isActive ? '13px' : '11px',
                    fontWeight: isActive ? 700 : 500,
                    fontFamily: 'monospace',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase' as const,
                    textShadow: isActive
                      ? '0 1px 3px rgba(255,255,255,0.5)'
                      : '0 1px 2px rgba(255,255,255,0.4)',
                    transition: 'fill 300ms ease, font-size 300ms ease',
                  }}
                >
                  {d.name.length > 16 ? d.code.replace(/_/g, ' ') : d.name}
                </text>
              );
            })}

            {/* Road labels (visible at moderate zoom) */}
            {viewState.scale >= 1.4 && ROAD_LABELS.map((rl) => (
              <text
                key={`road-label-${rl.roadId}`}
                x={rl.position[0]}
                y={rl.position[1]}
                textAnchor="middle"
                dominantBaseline="central"
                className="select-none"
                style={{
                  fill: 'hsl(210 10% 40%)',
                  fontSize: '7px',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textShadow: '0 1px 2px rgba(255,255,255,0.5)',
                  transform: `rotate(${rl.angle}deg)`,
                  transformOrigin: `${rl.position[0]}px ${rl.position[1]}px`,
                }}
              >
                {rl.label}
              </text>
            ))}

            {/* POI labels (visible at zoom >= threshold) */}
            {viewState.scale >= POI_VISIBLE_ZOOM && POIS.map((poi) => (
              <text
                key={`poi-label-${poi.id}`}
                x={poi.position[0]}
                y={poi.position[1] + 16}
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fill: 'hsl(210 12% 35%)',
                  fontSize: '8px',
                  fontFamily: 'monospace',
                  textShadow: '0 1px 2px rgba(255,255,255,0.5)',
                }}
              >
                {poi.name}
              </text>
            ))}
          </g>

          {/* ═══ LAYER 8: Effects ═══ */}
          <g id="layer-effects" style={{ pointerEvents: 'none' }}>
            {/* Atmospheric haze */}
            <circle cx="500" cy="400" r="120" fill="hsl(40 15% 88%)" opacity="0.015" filter="url(#v3-fog)" />
            <circle cx="250" cy="350" r="80" fill="hsl(40 15% 88%)" opacity="0.01" filter="url(#v3-fog)" />
            <circle cx="800" cy="300" r="60" fill="hsl(200 30% 80%)" opacity="0.015" filter="url(#v3-fog)" />

            {/* Vignette */}
            <rect
              x="0" y="0" width={VIEW_W} height={VIEW_H}
              fill="url(#v3-bg-radial)" opacity="0.15"
              style={{ mixBlendMode: 'screen' }}
            />

            {/* Outer frame */}
            <rect
              x="0" y="0" width={VIEW_W} height={VIEW_H}
              fill="none"
              stroke="hsl(220 12% 75%)"
              strokeWidth="1"
              opacity="0.25"
              rx="4"
            />
          </g>

          {/* ═══ LAYER 9: Hit Targets (INTERACTIVE) ═══ */}
          <g id="layer-hit-targets" style={{ pointerEvents: 'all' }}>
            {/* District hit polygons */}
            {DISTRICTS_GEO.map((d) => (
              <polygon
                key={`hit-${d.code}`}
                points={polygonToPoints(d.polygon)}
                fill="transparent"
                className="cursor-pointer"
                data-hit-target="district"
                data-district-code={d.code}
                data-testid={`district-${d.code}`}
                role="button"
                aria-label={`Select ${d.name} district`}
                tabIndex={0}
                onMouseEnter={() => setHoveredCode(d.code)}
                onMouseLeave={() => setHoveredCode(null)}
                onClick={(e) => { e.stopPropagation(); handleDistrictClick(d); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDistrictClick(d); } }}
              />
            ))}

            {/* POI hit circles (only visible at zoom) */}
            {viewState.scale >= POI_VISIBLE_ZOOM && POIS.map((poi) => (
              <circle
                key={`hit-poi-${poi.id}`}
                cx={poi.position[0]}
                cy={poi.position[1]}
                r={POI_HIT_RADIUS}
                fill="transparent"
                className="cursor-pointer"
                data-hit-target="poi"
                data-poi-id={poi.id}
                data-testid={`poi-${poi.id}`}
                role="button"
                aria-label={poi.name}
              />
            ))}
          </g>

          {/* ═══ LAYER 10: Debug Overlay (dev only) ═══ */}
          {isDebug && (
            <g id="layer-debug" style={{ pointerEvents: 'none' }}>
              {DISTRICTS_GEO.map((d) => (
                <polygon
                  key={`debug-${d.code}`}
                  points={polygonToPoints(d.polygon)}
                  fill="rgba(255,0,0,0.15)"
                  stroke="red"
                  strokeWidth="2"
                  strokeDasharray="8 4"
                />
              ))}
              {POIS.map((poi) => (
                <circle
                  key={`debug-poi-${poi.id}`}
                  cx={poi.position[0]}
                  cy={poi.position[1]}
                  r={POI_HIT_RADIUS}
                  fill="rgba(0,255,0,0.2)"
                  stroke="lime"
                  strokeWidth="1.5"
                />
              ))}
              {/* District centers */}
              {DISTRICTS_GEO.map((d) => (
                <circle
                  key={`debug-center-${d.code}`}
                  cx={d.center[0]}
                  cy={d.center[1]}
                  r="4"
                  fill="yellow"
                  opacity="0.8"
                />
              ))}
            </g>
          )}
        </g>
      </svg>

      {/* ═══ Zoom Controls (HTML overlay) ═══ */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5" style={{ pointerEvents: 'auto' }}>
        <button
          onClick={zoomIn}
          className="w-9 h-9 rounded-lg glass-surface flex items-center justify-center text-foreground/80 hover:text-foreground hover:neon-border transition-all text-lg font-bold"
          aria-label="Zoom in"
          data-testid="zoom-in"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-9 h-9 rounded-lg glass-surface flex items-center justify-center text-foreground/80 hover:text-foreground hover:neon-border transition-all text-lg font-bold"
          aria-label="Zoom out"
          data-testid="zoom-out"
        >
          &minus;
        </button>
        <button
          onClick={resetView}
          className="w-9 h-9 rounded-lg glass-surface flex items-center justify-center text-foreground/80 hover:text-foreground hover:neon-border transition-all text-xs font-mono"
          aria-label="Reset zoom"
          data-testid="zoom-reset"
        >
          1:1
        </button>
        <button
          onClick={toggleFullscreen}
          className="w-9 h-9 rounded-lg glass-surface flex items-center justify-center text-foreground/80 hover:text-foreground hover:neon-border transition-all"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          data-testid="fullscreen-toggle"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Debug toggle (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={() => setShowDebug((v) => !v)}
          className={`absolute top-2 left-2 px-2 py-1 rounded text-[10px] font-mono transition-all ${
            showDebug ? 'bg-red-500/30 text-red-300 border border-red-500/40' : 'glass-surface text-muted-foreground'
          }`}
        >
          {showDebug ? 'DEBUG ON' : 'DBG'}
        </button>
      )}

      {/* Zoom level indicator */}
      {viewState.scale > 1.05 && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded glass-surface text-[10px] font-mono text-muted-foreground">
          {viewState.scale.toFixed(1)}x
        </div>
      )}
    </div>
  );
}
