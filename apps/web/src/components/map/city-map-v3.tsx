'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DistrictMeta, LockedZoneMeta } from '@/lib/districts';
import { LOCKED_ZONES } from '@/lib/districts';
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
const ZOOM_STEP = 0.3;
const WHEEL_ZOOM_STEP = 0.08;
const POI_VISIBLE_ZOOM = 1.8;
const POI_HIT_RADIUS = 22;

// ── Color Palette (split-complementary: 37° / 187° / 257°) ──

const COLORS = {
  // Warm greens — yellow-green undertone (~88° hue)
  grass: '#5B8C2A',
  grassLight: '#7DAF42',
  // Cool blues — 3 depth levels (~198-210° hue)
  water: '#2685B8',
  waterDeep: '#164F7E',
  waterShallow: '#6BBCE8',
  // Warm earth tones (30-42° hue, 25-35% sat)
  sand: '#DBA45C',
  sandDark: '#C48B42',
  earth: '#8B6B40',
  earthLight: '#AC8A5A',
  // Mountain & sky
  mountain: '#6E8B52',
  mountainSnow: '#F0EBE2',
  sky: '#A0C8E4',
  skyWarm: '#F0D0A0',
  // UI selection — UNCHANGED
  gold: '#FFD54F',
  goldGlow: '#FFC107',
  // Locked zones
  lockGray: '#6B7280',
  lockDash: '#9CA3AF',
  // Atmospheric & accent
  fogWarm: '#E8DBC6',
  fogCool: '#C4D6E8',
  glowWarm: '#FFE0A0',
  glowCool: '#A0D4FF',
  nightAccent: '#7B68EE',
  buildingShadow: '#3D3226',
  roofTerracotta: '#C85A3A',
  roofSlate: '#5E7182',
  neonPink: '#FF4D8B',
  neonBlue: '#3DC8FF',
  marketAwning: '#D4533B',
};

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
    casingColor: '#7A6850',
    fillColor: '#B8A48C',
    opacity: 0.7,
    centerLine: { color: '#FFD54F', width: 0.8, dash: '10 6', opacity: 0.6 },
  },
  primary: {
    casingWidth: 5,
    fillWidth: 3.5,
    casingColor: '#8B6B40',
    fillColor: '#C8A878',
    opacity: 0.65,
  },
  secondary: {
    casingWidth: 3.5,
    fillWidth: 2.5,
    casingColor: '#9A887A',
    fillColor: '#C4B4A4',
    opacity: 0.55,
  },
  tertiary: {
    casingWidth: 2,
    fillWidth: 1.5,
    casingColor: '#A8988A',
    fillColor: '#D4C4B4',
    opacity: 0.45,
    dash: '3 4',
  },
};

// ── HSL color helpers ───────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const gr = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, gr, b);
  const min = Math.min(r, gr, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:  h = ((gr - b) / d + (gr < b ? 6 : 0)) / 6; break;
      case gr: h = ((b - r) / d + 2) / 6; break;
      case b:  h = ((r - gr) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function districtColors(gradient: [string, string]) {
  const [h0, s0, l0] = hexToHsl(gradient[0]);
  const [h1, s1, l1] = hexToHsl(gradient[1]);
  return {
    front: hslToHex(h0, s0, 85),
    side: hslToHex(h1, s1, Math.max(0, l1 - 15)),
    top: hslToHex(h0, s0, Math.min(100, l0 + 10)),
    window: 'rgba(180,220,255,0.35)',
    windowWarm: 'rgba(255,210,140,0.25)',
    shadow: `${hslToHex(h1, s1, Math.max(0, l1 - 30))}33`,
    accent: `${hslToHex((h0 + 180) % 360, s0 * 0.7, 55)}66`,
  };
}

// ── Isometric 3D building helpers ──────────────────

const WIN_COLOR = 'rgba(180,220,255,0.35)';
const WARM_WIN = 'rgba(255,210,140,0.25)';

function isoBox(
  bx: number, gy: number, w: number, h: number,
  front: string, side: string, top: string, k: string,
  windowColor?: string,
) {
  const dp = w * 0.3;
  const dh = dp * 0.5;
  const nw = Math.max(0, Math.floor((h - 6) / 7));
  const wc = windowColor ?? WIN_COLOR;
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
          width={w - 3} height={2.5} fill={wc} rx="0.3"
        />
      ))}
    </g>
  );
}

function pointedBox(
  bx: number, gy: number, w: number, h: number,
  front: string, side: string, roof: string, k: string,
  roofH?: number,
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
  front: string, side: string, dome: string, k: string,
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

function flatBox(
  bx: number, gy: number, w: number, h: number,
  front: string, side: string, top: string, k: string,
) {
  const dp = w * 0.3;
  const dh = dp * 0.5;
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
      {/* Awning */}
      <rect x={bx - 1} y={gy - h + 2} width={w + 2} height={1.5} fill={side} opacity="0.5" rx="0.3" />
      {/* Door */}
      <rect x={bx + w/2 - 2} y={gy - 5} width={4} height={5} fill="rgba(0,0,0,0.12)" rx="0.5" />
    </g>
  );
}

// ── Rich district building scenes ──────────────────

function renderDistrictScene(
  code: string, cx: number, cy: number, g: [string, string],
) {
  const dc = districtColors(g);
  const f = dc.front;
  const s = dc.side;
  const t = dc.top;
  const gy = cy + 20;

  switch (code) {
    case 'CBD':
      return (
        <g>
          {isoBox(cx - 42, gy, 13, 56, f, s, t, 'c1', dc.windowWarm)}
          {isoBox(cx - 24, gy, 16, 74, f, s, t, 'c2', dc.windowWarm)}
          {isoBox(cx - 2, gy, 12, 48, f, s, t, 'c3', dc.windowWarm)}
          {isoBox(cx + 16, gy, 15, 66, f, s, t, 'c4', dc.windowWarm)}
          {isoBox(cx + 36, gy, 11, 40, f, s, t, 'c5', dc.windowWarm)}
          {/* Antenna on tallest building */}
          <line x1={cx - 14} y1={gy - 74} x2={cx - 14} y2={gy - 86} stroke={g[0]} strokeWidth="0.8" />
          <circle cx={cx - 14} cy={gy - 87} r="1.2" fill="#FF4444" opacity="0.8" />
          {/* Rooftop garden on shorter building */}
          <rect x={cx - 1} y={gy - 50} width={10} height={2} fill="#4A7C59" opacity="0.4" rx="0.5" />
          {/* Sky bridge */}
          <rect x={cx + 10} y={gy - 45} width={10} height={1.5} fill={s} opacity="0.5" rx="0.3" />
          {/* Ground level details */}
          <rect x={cx - 42} y={gy} width={90} height={2} fill="rgba(0,0,0,0.05)" rx="0.3" />
        </g>
      );
    case 'OLD_TOWN':
      return (
        <g>
          {pointedBox(cx - 38, gy, 14, 22, f, s, g[1], 'o1')}
          {pointedBox(cx - 18, gy, 13, 20, f, s, g[1], 'o2')}
          {pointedBox(cx + 0, gy, 11, 38, f, s, g[1], 'o3', 16)}
          {pointedBox(cx + 18, gy, 15, 24, f, s, g[1], 'o4')}
          {flatBox(cx + 38, gy, 10, 12, f, s, t, 'o5')}
          {/* Clock tower cross */}
          <line x1={cx + 5.5} y1={gy - 55} x2={cx + 5.5} y2={gy - 60} stroke={g[0]} strokeWidth="0.8" />
          <line x1={cx + 3.5} y1={gy - 58} x2={cx + 7.5} y2={gy - 58} stroke={g[0]} strokeWidth="0.8" />
          {/* Flower boxes */}
          <rect x={cx - 36} y={gy - 10} width={4} height={1.5} fill="#E74C8B" opacity="0.5" rx="0.3" />
          <rect x={cx + 20} y={gy - 12} width={4} height={1.5} fill="#FF6B6B" opacity="0.5" rx="0.3" />
          {/* Cobblestone hint */}
          <rect x={cx - 38} y={gy} width={86} height={2} fill="rgba(0,0,0,0.04)" rx="0.3" />
        </g>
      );
    case 'MARINA':
      return (
        <g>
          {isoBox(cx - 34, gy, 18, 22, f, s, t, 'm1')}
          {isoBox(cx - 10, gy, 15, 26, f, s, t, 'm2')}
          {flatBox(cx + 10, gy, 12, 14, f, s, t, 'm3')}
          {/* Pier */}
          <rect x={cx + 26} y={gy - 2} width={24} height={2} fill={COLORS.earth} opacity="0.5" rx="0.3" />
          {/* Sailboat */}
          <polygon points={`${cx+30},${gy-6} ${cx+36},${gy-14} ${cx+36},${gy-6}`} fill="white" opacity="0.6" />
          <rect x={cx + 35} y={gy - 14} width="1" height="12" fill={COLORS.earth} opacity="0.4" />
          <ellipse cx={cx + 33} cy={gy - 3} rx="5" ry="2" fill={COLORS.water} opacity="0.3" />
          {/* Second boat */}
          <polygon points={`${cx+42},${gy-4} ${cx+46},${gy-10} ${cx+46},${gy-4}`} fill="white" opacity="0.4" />
          <rect x={cx + 45} y={gy - 10} width="0.8" height="8" fill={COLORS.earth} opacity="0.3" />
          {/* Umbrella */}
          <circle cx={cx - 26} cy={gy - 10} r="4" fill="#FF6B6B" opacity="0.3" />
          <rect x={cx - 26.5} y={gy - 10} width="1" height="10" fill={COLORS.earth} opacity="0.3" />
        </g>
      );
    case 'TECH_PARK':
      return (
        <g>
          {isoBox(cx - 30, gy, 14, 42, f, s, t, 't1', dc.windowWarm)}
          {isoBox(cx - 10, gy, 16, 52, f, s, t, 't2', dc.windowWarm)}
          {isoBox(cx + 12, gy, 13, 38, f, s, t, 't3', dc.windowWarm)}
          {/* Satellite dish on roof */}
          <ellipse cx={cx + 18} cy={gy - 38} rx="4" ry="2" fill={s} opacity="0.5" />
          <rect x={cx + 17.5} y={gy - 40} width="1" height="4" fill={s} opacity="0.4" />
          {/* Solar panels */}
          <rect x={cx - 9} y={gy - 54} width={12} height={3} fill="rgba(100,140,255,0.3)" rx="0.5" />
          <line x1={cx - 3} y1={gy - 54} x2={cx - 3} y2={gy - 51} stroke={s} strokeWidth="0.3" opacity="0.4" />
          {/* LED sign */}
          <rect x={cx - 28} y={gy - 30} width={10} height={3} fill="rgba(120,160,255,0.35)" rx="0.5" />
          {/* Ground plaza */}
          <rect x={cx - 30} y={gy} width={55} height={2} fill="rgba(0,0,0,0.04)" rx="0.3" />
        </g>
      );
    case 'MARKET_SQ':
      return (
        <g>
          {/* Market stalls with colorful roofs */}
          <rect x={cx - 32} y={gy - 12} width={14} height={12} fill={f} />
          <path d={`M${cx-33},${gy-12} L${cx-25},${gy-19} L${cx-17},${gy-12}`} fill="#E74C8B" opacity="0.7" />
          <rect x={cx - 12} y={gy - 14} width={14} height={14} fill={f} />
          <path d={`M${cx-13},${gy-14} L${cx-5},${gy-22} L${cx+3},${gy-14}`} fill="#FFD54F" opacity="0.8" />
          <rect x={cx + 8} y={gy - 12} width={14} height={12} fill={f} />
          <path d={`M${cx+7},${gy-12} L${cx+15},${gy-19} L${cx+23},${gy-12}`} fill="#4A7C59" opacity="0.7" />
          {/* Crates & goods */}
          <rect x={cx - 28} y={gy - 5} width={4} height={3} fill={COLORS.earth} opacity="0.3" rx="0.3" />
          <rect x={cx + 3} y={gy - 4} width={3} height={2.5} fill={COLORS.sandDark} opacity="0.3" rx="0.3" />
          {/* Hanging lanterns */}
          <circle cx={cx - 25} cy={gy - 16} r="1.2" fill="#FFD54F" opacity="0.5" />
          <circle cx={cx - 5} cy={gy - 18} r="1.2" fill="#FFD54F" opacity="0.5" />
          <circle cx={cx + 15} cy={gy - 16} r="1.2" fill="#FFD54F" opacity="0.5" />
          {/* Ground */}
          <rect x={cx - 32} y={gy} width={54} height={2} fill="rgba(0,0,0,0.04)" rx="0.3" />
        </g>
      );
    case 'ENTERTAINMENT':
      return (
        <g>
          {isoBox(cx - 26, gy, 14, 30, f, s, t, 'e1')}
          {domeBox(cx - 6, gy, 18, 36, f, s, `${g[0]}AA`, 'e2')}
          {isoBox(cx + 18, gy, 12, 24, f, s, t, 'e3')}
          {/* Neon sign glow */}
          <circle cx={cx - 20} cy={gy - 36} r="2" fill={g[0]} opacity="0.3" />
          <circle cx={cx - 20} cy={gy - 36} r="4" fill={g[0]} opacity="0.08" />
          {/* Ferris wheel hint */}
          <circle cx={cx + 35} cy={gy - 18} r="12" fill="none" stroke={g[0]} strokeWidth="0.8" opacity="0.25" />
          <circle cx={cx + 35} cy={gy - 18} r="1.5" fill={g[0]} opacity="0.3" />
          {/* Stars/sparkles */}
          <circle cx={cx - 8} cy={gy - 42} r="0.8" fill="#FFD54F" opacity="0.6" />
          <circle cx={cx + 12} cy={gy - 30} r="0.6" fill="#FFD54F" opacity="0.5" />
        </g>
      );
    case 'UNIVERSITY':
      return (
        <g>
          {domeBox(cx - 20, gy, 22, 28, f, s, `${g[0]}BB`, 'u1')}
          {pointedBox(cx + 8, gy, 14, 22, f, s, g[1], 'u2')}
          {flatBox(cx - 40, gy, 14, 14, f, s, t, 'u3')}
          {/* Columns */}
          <line x1={cx - 15} y1={gy} x2={cx - 15} y2={gy - 24} stroke={g[0]} strokeWidth="1.2" opacity="0.4" />
          <line x1={cx - 9} y1={gy} x2={cx - 9} y2={gy - 24} stroke={g[0]} strokeWidth="1.2" opacity="0.4" />
          <line x1={cx - 3} y1={gy} x2={cx - 3} y2={gy - 24} stroke={g[0]} strokeWidth="1.2" opacity="0.4" />
          {/* Flag */}
          <rect x={cx + 14} y={gy - 42} width="1" height="20" fill={g[1]} opacity="0.5" />
          <polygon points={`${cx+15},${gy-42} ${cx+22},${gy-39} ${cx+15},${gy-36}`} fill={g[0]} opacity="0.4" />
          {/* Lamppost */}
          <rect x={cx + 28} y={gy - 14} width="1" height="14" fill={COLORS.earth} opacity="0.3" />
          <circle cx={cx + 28.5} cy={gy - 15} r="2" fill="#FFD54F" opacity="0.2" />
        </g>
      );
    case 'HARBOR':
      return (
        <g>
          {isoBox(cx - 32, gy, 18, 18, f, s, t, 'h1')}
          {flatBox(cx - 8, gy, 14, 12, f, s, t, 'h2')}
          {/* Crane */}
          <rect x={cx + 12} y={gy - 42} width="2.5" height="42" fill={g[0]} opacity="0.8" />
          <line x1={cx + 13} y1={gy - 42} x2={cx + 34} y2={gy - 36} stroke={g[0]} strokeWidth="1.5" opacity="0.7" />
          <line x1={cx + 30} y1={gy - 37} x2={cx + 30} y2={gy - 22} stroke={g[0]} strokeWidth="0.6" opacity="0.5" />
          <rect x={cx + 28} y={gy - 22} width={4} height={3} fill={g[0]} opacity="0.5" />
          {/* Containers */}
          <rect x={cx + 10} y={gy - 6} width={9} height={6} fill="#E74C8B" opacity="0.5" rx="0.3" />
          <rect x={cx + 21} y={gy - 6} width={9} height={6} fill="#3B82F6" opacity="0.5" rx="0.3" />
          <rect x={cx + 14} y={gy - 12} width={8} height={6} fill="#22C55E" opacity="0.4" rx="0.3" />
          {/* Bollard */}
          <rect x={cx + 36} y={gy - 3} width="2" height="3" fill={COLORS.earth} opacity="0.4" rx="0.3" />
        </g>
      );
    case 'INDUSTRIAL':
      return (
        <g>
          {isoBox(cx - 30, gy, 20, 22, f, s, t, 'i1')}
          {isoBox(cx - 4, gy, 18, 20, f, s, t, 'i2')}
          {flatBox(cx + 20, gy, 16, 14, f, s, t, 'i3')}
          {/* Smokestacks */}
          <rect x={cx - 26} y={gy - 38} width="3" height="16" fill={g[1]} opacity="0.8" />
          <rect x={cx - 18} y={gy - 34} width="3" height="12" fill={g[1]} opacity="0.7" />
          {/* Smoke puffs */}
          <ellipse cx={cx - 24.5} cy={gy - 41} rx="5" ry="3" fill={g[0]} opacity="0.06" />
          <ellipse cx={cx - 22} cy={gy - 44} rx="4" ry="2.5" fill={g[0]} opacity="0.04" />
          <ellipse cx={cx - 16.5} cy={gy - 37} rx="4" ry="2.5" fill={g[0]} opacity="0.05" />
          {/* Power lines */}
          <line x1={cx + 35} y1={gy - 25} x2={cx + 45} y2={gy - 25} stroke={g[1]} strokeWidth="0.5" opacity="0.3" />
          <rect x={cx + 34} y={gy - 28} width="1.5" height="28" fill={g[1]} opacity="0.3" />
          <rect x={cx + 44} y={gy - 28} width="1.5" height="28" fill={g[1]} opacity="0.3" />
        </g>
      );
    case 'SUBURBS_N':
      return (
        <g>
          {pointedBox(cx - 30, gy, 14, 14, f, s, g[1], 's1')}
          {pointedBox(cx - 10, gy, 12, 12, f, s, g[1], 's2')}
          {pointedBox(cx + 8, gy, 14, 15, f, s, g[1], 's3')}
          {/* Garage */}
          {flatBox(cx + 26, gy, 10, 8, f, s, t, 's4')}
          {/* Tree */}
          <circle cx={cx - 20} cy={gy - 12} r="6" fill={COLORS.grass} opacity="0.35" />
          <rect x={cx - 20.5} y={gy - 6} width="1" height="6" fill={COLORS.earth} opacity="0.3" />
          {/* Fence */}
          <line x1={cx - 30} y1={gy} x2={cx + 36} y2={gy} stroke={COLORS.earth} strokeWidth="0.5" opacity="0.2" />
          {/* Mailbox */}
          <rect x={cx + 2} y={gy - 4} width="1.5" height="4" fill={COLORS.earth} opacity="0.3" />
          <rect x={cx + 1} y={gy - 5} width="3.5" height="2" fill="#3B82F6" opacity="0.3" rx="0.3" />
        </g>
      );
    case 'SUBURBS_S':
      return (
        <g>
          {pointedBox(cx - 26, gy, 12, 12, f, s, g[1], 'ss1')}
          {pointedBox(cx - 8, gy, 14, 14, f, s, g[1], 'ss2')}
          {isoBox(cx + 12, gy, 16, 14, f, s, t, 'ss3')}
          {/* Playground */}
          <rect x={cx + 32} y={gy - 8} width="1" height="8" fill={COLORS.earth} opacity="0.3" />
          <line x1={cx + 28} y1={gy - 3} x2={cx + 36} y2={gy - 3} stroke={COLORS.earth} strokeWidth="0.5" opacity="0.3" />
          {/* Bush */}
          <circle cx={cx - 36} cy={gy - 3} r="4" fill={COLORS.grass} opacity="0.3" />
          <circle cx={cx - 32} cy={gy - 2} r="3" fill={COLORS.grassLight} opacity="0.2" />
          {/* Path */}
          <rect x={cx - 8} y={gy} width={14} height={1.5} fill={COLORS.sand} opacity="0.15" rx="0.3" />
        </g>
      );
    case 'OUTSKIRTS':
      return (
        <g>
          {pointedBox(cx - 22, gy, 14, 14, f, s, g[1], 'out1')}
          {flatBox(cx + 0, gy, 12, 10, f, s, t, 'out2')}
          {/* Windmill */}
          <rect x={cx + 22} y={gy - 28} width="3" height="28" fill={g[0]} opacity="0.7" />
          <circle cx={cx + 23.5} cy={gy - 28} r="1.5" fill={g[1]} opacity="0.6" />
          {/* Windmill blades */}
          <line x1={cx + 23.5} y1={gy - 28} x2={cx + 23.5} y2={gy - 40} stroke={g[0]} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          <line x1={cx + 23.5} y1={gy - 28} x2={cx + 34} y2={gy - 24} stroke={g[0]} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          <line x1={cx + 23.5} y1={gy - 28} x2={cx + 13} y2={gy - 24} stroke={g[0]} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          <line x1={cx + 23.5} y1={gy - 28} x2={cx + 23.5} y2={gy - 16} stroke={g[0]} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          {/* Hay bale */}
          <ellipse cx={cx - 35} cy={gy - 2} rx="4" ry="3" fill={COLORS.sand} opacity="0.3" />
          {/* Fence posts */}
          <rect x={cx - 40} y={gy - 4} width="1" height="4" fill={COLORS.earth} opacity="0.2" />
          <rect x={cx - 33} y={gy - 4} width="1" height="4" fill={COLORS.earth} opacity="0.2" />
          <line x1={cx - 40} y1={gy - 2} x2={cx - 33} y2={gy - 2} stroke={COLORS.earth} strokeWidth="0.5" opacity="0.2" />
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
  poly: [number, number][], count: number, seed: number,
): [number, number][] {
  const rng = seededRandom(seed);
  const points: [number, number][] = [];
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

// ── Road junction coordinates ──

const ROAD_JUNCTIONS: [number, number][] = [
  [570, 380], [570, 310], [790, 265], [860, 415],
  [430, 500], [550, 505], [385, 220], [355, 635],
  [295, 370], [640, 340], [180, 300], [180, 580],
  [740, 680], [500, 660], [450, 370],
];

// ── Mountain data ──

const MOUNTAINS: { x: number; w: number; h: number; opacity: number; snow: boolean }[] = [
  { x: 200, w: 120, h: 85, opacity: 0.12, snow: true },
  { x: 350, w: 100, h: 70, opacity: 0.15, snow: true },
  { x: 480, w: 140, h: 95, opacity: 0.10, snow: true },
  { x: 620, w: 110, h: 75, opacity: 0.13, snow: false },
  { x: 730, w: 90, h: 65, opacity: 0.14, snow: false },
  { x: 140, w: 80, h: 55, opacity: 0.08, snow: false },
  { x: 820, w: 70, h: 50, opacity: 0.09, snow: false },
];

// ── Scattered tree positions (between districts) ──

function generateForestTrees(seed: number): { x: number; y: number; r: number; shade: string }[] {
  const rng = seededRandom(seed);
  const trees: { x: number; y: number; r: number; shade: string }[] = [];
  // Regions where trees grow (gaps between districts)
  const regions: [number, number, number, number][] = [
    [240, 260, 360, 340],    // Between University and Old Town
    [260, 140, 360, 200],    // North of Suburbs N
    [440, 250, 500, 340],    // Between Old Town and CBD
    [640, 420, 700, 500],    // Between CBD and Industrial
    [200, 440, 260, 560],    // West side gaps
    [320, 540, 400, 610],    // Between Market Sq and Suburbs S
    [600, 250, 640, 310],    // Between Tech Park and CBD
    [120, 620, 200, 680],    // SW corner
  ];
  for (const [x1, y1, x2, y2] of regions) {
    const count = 4 + Math.floor(rng() * 5);
    for (let i = 0; i < count; i++) {
      const x = x1 + rng() * (x2 - x1);
      const y = y1 + rng() * (y2 - y1);
      const r = 4 + rng() * 6;
      const shade = rng() > 0.5 ? COLORS.grass : COLORS.grassLight;
      trees.push({ x, y, r, shade });
    }
  }
  return trees;
}

const FOREST_TREES = generateForestTrees(12345);

// ── Component Props ──────────────────────────────────

interface CityMapV3Props {
  onDistrictSelect?: (district: DistrictMeta) => void;
  onLockedZoneSelect?: (zone: LockedZoneMeta) => void;
  selectedCode?: string;
}

// ── Main Component ──────────────────────────────────

export function CityMapV3({ onDistrictSelect, onLockedZoneSelect, selectedCode }: CityMapV3Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [viewState, setViewState] = useState<MapViewState>({ x: 0, y: 0, scale: 1 });
  const [showDebug, setShowDebug] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [clickFlash, setClickFlash] = useState<string | null>(null);

  const dragRef = useRef<{ active: boolean; startX: number; startY: number; startVX: number; startVY: number }>({
    active: false, startX: 0, startY: 0, startVX: 0, startVY: 0,
  });
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

  const zoomIn = useCallback(() => { zoomAt(VIEW_W / 2, VIEW_H / 2, ZOOM_STEP); }, [zoomAt]);
  const zoomOut = useCallback(() => { zoomAt(VIEW_W / 2, VIEW_H / 2, -ZOOM_STEP); }, [zoomAt]);
  const resetView = useCallback(() => { setViewState({ x: 0, y: 0, scale: 1 }); }, []);

  // ── Fullscreen ──
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
    const handleChange = () => { setIsFullscreen(!!document.fullscreenElement); };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  // ── Event handlers ──

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const svgY = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    const delta = e.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP;
    zoomAt(svgX, svgY, delta);
  }, [zoomAt]);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const target = e.target as SVGElement;
    if (target.dataset?.hitTarget) return;
    setIsDragging(true);
    dragRef.current = {
      active: true,
      startX: e.clientX, startY: e.clientY,
      startVX: viewState.x, startVY: viewState.y,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [viewState.x, viewState.y]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current.active) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = ((e.clientX - dragRef.current.startX) / rect.width) * VIEW_W;
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * VIEW_H;
    const newState = clampView(dragRef.current.startVX + dx, dragRef.current.startVY + dy, viewState.scale);
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
      pinchRef.current = { active: true, startDist: Math.hypot(dx, dy), startScale: viewState.scale };
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

  const handleTouchEnd = useCallback(() => { pinchRef.current.active = false; }, []);

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    if (!target.dataset?.hitTarget) {
      onDistrictSelect?.(null as unknown as DistrictMeta);
    }
  }, [onDistrictSelect]);

  const handleDistrictClick = useCallback((d: DistrictGeo) => {
    setClickFlash(d.code);
    setTimeout(() => setClickFlash(null), 400);
    onDistrictSelect?.(d);
  }, [onDistrictSelect]);

  const handleLockedZoneClick = useCallback((zone: LockedZoneMeta) => {
    onLockedZoneSelect?.(zone);
  }, [onLockedZoneSelect]);

  const isDebug = showDebug || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'));

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
          <filter id="v3-building-shadow" x="-10%" y="-10%" width="130%" height="140%">
            <feDropShadow dx="2" dy="3" stdDeviation="2" floodColor="#3E2C1E" floodOpacity="0.18" />
          </filter>
          <filter id="v3-select-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feFlood floodColor={COLORS.gold} floodOpacity="0.5" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="v3-hover-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feFlood floodColor={COLORS.gold} floodOpacity="0.3" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
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
          <filter id="v3-terrain-noise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="42" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="mono" />
            <feComponentTransfer in="mono" result="faint">
              <feFuncA type="linear" slope="0.04" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="faint" mode="overlay" />
          </filter>
          <filter id="v3-locked-desat" x="0%" y="0%" width="100%" height="100%">
            <feColorMatrix type="saturate" values="0.15" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="0.7" intercept="0.1" />
              <feFuncG type="linear" slope="0.7" intercept="0.1" />
              <feFuncB type="linear" slope="0.7" intercept="0.1" />
            </feComponentTransfer>
          </filter>
          <filter id="v3-depth-fog" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id="v3-paper-texture" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="3" seed="77" result="paper" />
            <feColorMatrix type="saturate" values="0" in="paper" result="mono" />
            <feComponentTransfer in="mono" result="subtle">
              <feFuncA type="linear" slope="0.02" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="subtle" mode="multiply" />
          </filter>

          {/* ── Per-district gradients + clips ── */}
          {DISTRICTS_GEO.map((d) => (
            <linearGradient key={`grad-${d.code}`} id={`v3-grad-${d.code}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={d.gradient[0]} stopOpacity="0.6" />
              <stop offset="100%" stopColor={d.gradient[1]} stopOpacity="0.75" />
            </linearGradient>
          ))}
          {DISTRICTS_GEO.map((d) => (
            <clipPath key={`clip-${d.code}`} id={`v3-clip-${d.code}`}>
              <polygon points={polygonToPoints(d.polygon)} />
            </clipPath>
          ))}

          {/* ── Locked zone gradients ── */}
          {LOCKED_ZONES.map((z) => (
            <linearGradient key={`lz-grad-${z.code}`} id={`v3-lz-grad-${z.code}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={z.gradient[0]} stopOpacity="0.2" />
              <stop offset="100%" stopColor={z.gradient[1]} stopOpacity="0.3" />
            </linearGradient>
          ))}

          {/* ── Sky gradient ── */}
          <linearGradient id="v3-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.sky} stopOpacity="0.4" />
            <stop offset="40%" stopColor={COLORS.skyWarm} stopOpacity="0.15" />
            <stop offset="100%" stopColor="#F5F0E8" stopOpacity="0.05" />
          </linearGradient>

          {/* ── Background gradient ── */}
          <radialGradient id="v3-bg-radial" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="hsl(40 25% 94%)" />
            <stop offset="60%" stopColor="hsl(40 22% 91%)" />
            <stop offset="100%" stopColor="hsl(35 18% 88%)" />
          </radialGradient>

          {/* ── Ocean gradients ── */}
          <linearGradient id="v3-sea-deep" x1="0.7" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={COLORS.water} stopOpacity="0.5" />
            <stop offset="40%" stopColor={COLORS.waterShallow} stopOpacity="0.35" />
            <stop offset="100%" stopColor={COLORS.waterShallow} stopOpacity="0.2" />
          </linearGradient>

          <linearGradient id="v3-beach" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={COLORS.sand} stopOpacity="0" />
            <stop offset="40%" stopColor={COLORS.sand} stopOpacity="0.22" />
            <stop offset="100%" stopColor={COLORS.sandDark} stopOpacity="0.35" />
          </linearGradient>

          {/* ── Park gradient ── */}
          <radialGradient id="v3-park-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={COLORS.grass} stopOpacity="0.3" />
            <stop offset="70%" stopColor={COLORS.grass} stopOpacity="0.15" />
            <stop offset="100%" stopColor={COLORS.grass} stopOpacity="0.03" />
          </radialGradient>

          {/* ── Glass overlay ── */}
          <linearGradient id="v3-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.12" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.06" />
          </linearGradient>

          {/* ── Grid pattern ── */}
          <pattern id="v3-grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke={COLORS.earthLight} strokeWidth="0.3" opacity="0.12" />
          </pattern>

          {/* ── Hatching pattern ── */}
          <pattern id="v3-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#78716C" strokeWidth="0.5" opacity="0.12" />
          </pattern>

          {/* ── Gold marching-ants stroke for selected district ── */}
          <pattern id="v3-march" width="12" height="1" patternUnits="userSpaceOnUse">
            <rect width="6" height="1" fill={COLORS.gold} />
            <rect x="6" width="6" height="1" fill="transparent" />
          </pattern>

          {/* ── Terrain texture patterns ── */}
          <pattern id="v3-tex-urban" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill="none" />
            <path d="M0,8 L16,8 M8,0 L8,16" stroke="#9CA3AF" strokeWidth="0.3" opacity="0.12" />
            <circle cx="4" cy="4" r="0.6" fill="#78716C" opacity="0.10" />
            <circle cx="12" cy="12" r="0.6" fill="#78716C" opacity="0.10" />
            <rect x="2" y="10" width="3" height="2" fill="#9CA3AF" opacity="0.06" rx="0.2" />
            <rect x="10" y="2" width="4" height="2.5" fill="#9CA3AF" opacity="0.06" rx="0.2" />
          </pattern>

          <pattern id="v3-tex-green" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="none" />
            <circle cx="5" cy="5" r="1" fill={COLORS.grass} opacity="0.18" />
            <circle cx="15" cy="12" r="0.8" fill={COLORS.grass} opacity="0.14" />
            <circle cx="10" cy="18" r="1.2" fill={COLORS.grassLight} opacity="0.12" />
            <circle cx="2" cy="14" r="0.6" fill={COLORS.grassLight} opacity="0.14" />
            <path d="M7,8 L7,5 M8,9 L9,6 M6,9 L5,6.5" stroke={COLORS.grass} strokeWidth="0.4" opacity="0.14" strokeLinecap="round" />
            <path d="M16,16 L16,13 M17,17 L18,14" stroke={COLORS.grassLight} strokeWidth="0.4" opacity="0.12" strokeLinecap="round" />
          </pattern>

          <pattern id="v3-tex-water" width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="none" />
            <path d="M2,8 Q6,6 10,8 Q14,10 18,8" fill="none" stroke={COLORS.water} strokeWidth="0.4" opacity="0.14" />
            <path d="M6,18 Q10,16 14,18 Q18,20 22,18" fill="none" stroke={COLORS.waterDeep} strokeWidth="0.3" opacity="0.12" />
            <circle cx="20" cy="5" r="0.5" fill={COLORS.waterShallow} opacity="0.12" />
          </pattern>

          <pattern id="v3-tex-industrial" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="none" />
            <path d="M0,0 L12,12 M12,0 L0,12" stroke="#78716C" strokeWidth="0.4" opacity="0.10" />
            <circle cx="6" cy="6" r="0.8" fill="#92400E" opacity="0.08" />
            <circle cx="2" cy="10" r="0.5" fill="#78716C" opacity="0.06" />
            <rect x="8" y="1" width="2" height="1.5" fill="#57534E" opacity="0.08" rx="0.2" />
          </pattern>

          <pattern id="v3-tex-rural" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill="none" />
            <path d="M0,6 L18,6 M0,12 L18,12" stroke={COLORS.earth} strokeWidth="0.3" opacity="0.10" strokeDasharray="3 2" />
            <circle cx="4" cy="3" r="0.7" fill={COLORS.grass} opacity="0.12" />
            <circle cx="12" cy="9" r="0.5" fill={COLORS.earth} opacity="0.08" />
            <circle cx="8" cy="15" r="0.6" fill={COLORS.grass} opacity="0.10" />
            <path d="M14,3 L14,1" stroke={COLORS.earth} strokeWidth="0.5" opacity="0.08" strokeLinecap="round" />
            <path d="M16,3 L16,1.5" stroke={COLORS.earth} strokeWidth="0.5" opacity="0.08" strokeLinecap="round" />
          </pattern>

          {/* ── Wave pattern ── */}
          <pattern id="v3-wave-pat" width="60" height="12" patternUnits="userSpaceOnUse">
            <path d="M0,6 Q15,2 30,6 Q45,10 60,6" fill="none" stroke={COLORS.water} strokeWidth="0.4" opacity="0.18" />
          </pattern>

          {/* ── River gradient ── */}
          <linearGradient id="v3-river" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={COLORS.water} stopOpacity="0.30" />
            <stop offset="50%" stopColor={COLORS.waterShallow} stopOpacity="0.25" />
            <stop offset="100%" stopColor={COLORS.water} stopOpacity="0.15" />
          </linearGradient>

          {/* ── Tree symbol ── */}
          <symbol id="v3-tree" viewBox="0 0 20 24">
            <rect x="9" y="16" width="2" height="8" fill={COLORS.earth} opacity="0.5" rx="0.3" />
            <circle cx="10" cy="10" r="8" fill={COLORS.grass} opacity="0.6" />
            <circle cx="7" cy="7" r="5" fill={COLORS.grassLight} opacity="0.4" />
          </symbol>

          {/* ── Mountain symbol ── */}
          <symbol id="v3-mountain" viewBox="0 0 100 70">
            <polygon points="0,70 50,0 100,70" fill={COLORS.mountain} opacity="0.8" />
            <polygon points="35,25 50,0 65,25" fill={COLORS.mountainSnow} opacity="0.5" />
          </symbol>

          {/* ── Cloud symbol ── */}
          <symbol id="v3-cloud" viewBox="0 0 60 30">
            <ellipse cx="20" cy="20" rx="18" ry="10" fill="white" opacity="0.5" />
            <ellipse cx="35" cy="15" rx="14" ry="12" fill="white" opacity="0.4" />
            <ellipse cx="45" cy="20" rx="12" ry="8" fill="white" opacity="0.35" />
          </symbol>
        </defs>

        {/* ── Pan/Zoom root ── */}
        <g id="pan-zoom-root" transform={transform} style={{ transformOrigin: '0 0', transition: isDragging ? 'none' : 'transform 120ms ease-out' }}>

          {/* ═══ LAYER 1: Sky & Terrain Base ═══ */}
          <g id="layer-sky-terrain" style={{ pointerEvents: 'none' }}>
            {/* Sky gradient at top */}
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#v3-sky)" />
            {/* Base land with warm tones */}
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#v3-bg-radial)" />
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#v3-bg-radial)" filter="url(#v3-terrain-noise)" />
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#v3-grid)" />

            {/* ── Ocean ── */}
            <path
              d="M850,0 L1200,0 L1200,900 L850,900 Q900,750 920,600 Q940,480 920,380 Q900,250 880,180 Q860,100 850,0 Z"
              fill="url(#v3-sea-deep)"
            />
            <path
              d="M850,0 L1200,0 L1200,900 L850,900 Q900,750 920,600 Q940,480 920,380 Q900,250 880,180 Q860,100 850,0 Z"
              fill="url(#v3-wave-pat)"
              opacity="0.6"
            />

            {/* ── Beach/sand strip ── */}
            <path
              d="M830,0 Q840,80 860,160 Q880,250 900,340 Q920,440 910,540 Q900,650 890,750 Q880,830 870,900 L850,900 Q860,830 870,750 Q880,650 890,540 Q900,440 890,340 Q870,250 860,160 Q850,80 840,0 Z"
              fill="url(#v3-beach)"
            />
            {[
              [845, 80], [855, 160], [870, 260], [885, 340], [895, 420],
              [900, 500], [895, 580], [885, 660], [878, 740], [872, 820],
              [848, 120], [862, 200], [878, 300], [890, 380], [898, 460],
              [895, 540], [888, 620], [882, 700], [875, 780], [870, 860],
            ].map(([sx, sy], i) => (
              <circle key={`sand-${i}`} cx={sx} cy={sy} r={0.8 + (i % 3) * 0.3} fill={COLORS.sandDark} opacity={0.12 + (i % 4) * 0.02} />
            ))}

            {/* ── Coastline edge ── */}
            <path
              d="M850,0 Q860,100 880,180 Q900,250 920,380 Q940,480 920,600 Q900,750 850,900"
              fill="none" stroke="#000" strokeWidth="3" opacity="0.15"
              filter="url(#v3-coast-shadow)"
            />

            {/* ── River flowing through city ── */}
            <path
              d="M860,490 Q820,520 780,540 Q720,570 660,585 Q600,600 540,610 Q480,620 420,640"
              fill="none" stroke={COLORS.water} strokeWidth="8" opacity="0.2"
              strokeLinecap="round"
            />
            <path
              d="M860,490 Q820,520 780,540 Q720,570 660,585 Q600,600 540,610 Q480,620 420,640"
              fill="none" stroke={COLORS.waterShallow} strokeWidth="2" opacity="0.12"
              strokeLinecap="round" strokeDasharray="4 8"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="24" dur="6s" repeatCount="indefinite" />
            </path>

            {/* ── Lake near University ── */}
            <ellipse cx="250" cy="460" rx="40" ry="25" fill={COLORS.water} opacity="0.18" />
            <ellipse cx="250" cy="460" rx="36" ry="21" fill={COLORS.waterShallow} opacity="0.08" />
            <path
              d="M220,458 Q235,454 250,458 Q265,462 280,458"
              fill="none" stroke={COLORS.waterShallow} strokeWidth="0.5" opacity="0.15"
              strokeDasharray="4 4"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="16" dur="5s" repeatCount="indefinite" />
            </path>

            {/* ── Park areas ── */}
            <ellipse cx="295" cy="370" rx="75" ry="55" fill="url(#v3-park-grad)" />
            <ellipse cx="280" cy="350" rx="30" ry="20" fill={COLORS.grass} opacity="0.18" />
            <ellipse cx="385" cy="220" rx="65" ry="45" fill="url(#v3-park-grad)" />
            <ellipse cx="350" cy="200" rx="25" ry="18" fill={COLORS.grass} opacity="0.15" />
            <ellipse cx="420" cy="240" rx="20" ry="15" fill={COLORS.grass} opacity="0.12" />
            <ellipse cx="355" cy="635" rx="60" ry="45" fill="url(#v3-park-grad)" />
            <ellipse cx="330" cy="650" rx="22" ry="16" fill={COLORS.grass} opacity="0.14" />
            <ellipse cx="180" cy="440" rx="45" ry="90" fill={COLORS.grass} opacity="0.12" />
            <ellipse cx="165" cy="350" rx="25" ry="30" fill={COLORS.grass} opacity="0.10" />
            <ellipse cx="170" cy="550" rx="20" ry="35" fill={COLORS.grass} opacity="0.10" />

            {/* ── Industrial haze ── */}
            <ellipse cx="790" cy="550" rx="80" ry="60" fill="#78716C" opacity="0.10" />
            <ellipse cx="790" cy="550" rx="80" ry="60" fill="url(#v3-hatch)" />
            <ellipse cx="810" cy="530" rx="50" ry="35" fill="#57534E" opacity="0.06" />
          </g>

          {/* ═══ LAYER 2: Mountains ═══ */}
          <g id="layer-mountains" style={{ pointerEvents: 'none' }}>
            {MOUNTAINS.map((m, i) => (
              <g key={`mtn-${i}`} opacity={m.opacity} filter={i > 4 ? 'url(#v3-depth-fog)' : undefined}>
                <use href="#v3-mountain" x={m.x} y={45 - m.h * 0.6} width={m.w} height={m.h} />
                {m.snow && (
                  <polygon
                    points={`${m.x + m.w * 0.35},${45 - m.h * 0.6 + m.h * 0.35} ${m.x + m.w * 0.5},${45 - m.h * 0.6} ${m.x + m.w * 0.65},${45 - m.h * 0.6 + m.h * 0.35}`}
                    fill={COLORS.mountainSnow}
                    opacity="0.4"
                  />
                )}
              </g>
            ))}
            {/* Clouds */}
            <use href="#v3-cloud" x="100" y="20" width="80" height="30" opacity="0.15">
              <animateTransform attributeName="transform" type="translate" from="0,0" to="30,0" dur="60s" repeatCount="indefinite" />
            </use>
            <use href="#v3-cloud" x="500" y="10" width="60" height="25" opacity="0.12">
              <animateTransform attributeName="transform" type="translate" from="0,0" to="-20,0" dur="45s" repeatCount="indefinite" />
            </use>
            <use href="#v3-cloud" x="800" y="30" width="70" height="28" opacity="0.10">
              <animateTransform attributeName="transform" type="translate" from="0,0" to="25,0" dur="55s" repeatCount="indefinite" />
            </use>
          </g>

          {/* ═══ LAYER 3: Water Detail ═══ */}
          <g id="layer-water" style={{ pointerEvents: 'none' }}>
            {/* Ocean depth zones */}
            <path
              d="M850,0 Q860,100 880,180 Q900,250 920,380 Q940,480 920,600 Q900,750 850,900 L920,900 Q950,750 960,600 Q980,480 960,380 Q940,250 920,180 Q900,100 890,0 Z"
              fill={COLORS.waterShallow} opacity="0.08"
            />
            <path
              d="M890,0 Q900,100 920,180 Q940,250 960,380 Q980,480 960,600 Q950,750 920,900 L1000,900 Q1020,750 1030,600 Q1040,480 1030,380 Q1010,250 990,180 Q970,100 960,0 Z"
              fill={COLORS.water} opacity="0.06"
            />
            <path
              d="M960,0 L1200,0 L1200,900 L1000,900 Q1020,750 1030,600 Q1040,480 1030,380 Q1010,250 990,180 Q970,100 960,0 Z"
              fill={COLORS.waterDeep} opacity="0.05"
            />

            {/* Animated waves */}
            {[
              { y: 120, w: 0.6, o: 0.22, dur: 4 },
              { y: 200, w: 0.5, o: 0.20, dur: 5.2 },
              { y: 300, w: 0.5, o: 0.18, dur: 6 },
              { y: 400, w: 0.5, o: 0.16, dur: 4.8 },
              { y: 500, w: 0.4, o: 0.14, dur: 5.5 },
              { y: 620, w: 0.4, o: 0.12, dur: 4.3 },
              { y: 740, w: 0.4, o: 0.10, dur: 5.8 },
            ].map(({ y, w, o, dur }) => (
              <path key={`wave-${y}`}
                d={`M${850 + Math.sin(y * 0.01) * 20},${y} Q${910 + Math.cos(y * 0.02) * 10},${y - 5} ${960 + Math.sin(y * 0.015) * 15},${y}`}
                fill="none" stroke={COLORS.water} strokeWidth={w} opacity={o}
                strokeDasharray="8 6"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="28" dur={`${dur}s`} repeatCount="indefinite" />
              </path>
            ))}

            {/* Shoreline foam */}
            <path
              d="M850,0 Q860,100 880,180 Q900,250 920,380 Q940,480 920,600 Q900,750 850,900"
              fill="none" stroke="#E0F0FF" strokeWidth="1.5" opacity="0.20"
              strokeDasharray="3 6"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="18" dur="3s" repeatCount="indefinite" />
            </path>

            {/* Marina piers */}
            <rect x="870" y="230" width="35" height="3" fill="#64748B" opacity="0.45" rx="0.5" />
            <rect x="875" y="233" width="2" height="12" fill="#64748B" opacity="0.35" rx="0.3" />
            <rect x="885" y="233" width="2" height="12" fill="#64748B" opacity="0.35" rx="0.3" />
            <rect x="895" y="233" width="2" height="12" fill="#64748B" opacity="0.35" rx="0.3" />
            <rect x="865" y="270" width="30" height="3" fill="#64748B" opacity="0.40" rx="0.5" />
            <rect x="870" y="273" width="2" height="10" fill="#64748B" opacity="0.30" rx="0.3" />
            <rect x="880" y="273" width="2" height="10" fill="#64748B" opacity="0.30" rx="0.3" />
            <rect x="890" y="273" width="2" height="10" fill="#64748B" opacity="0.30" rx="0.3" />

            {/* Harbor docks */}
            <rect x="905" y="390" width="40" height="5" fill="#475569" opacity="0.45" rx="0.5" />
            <line x1="910" y1="392" x2="940" y2="392" stroke="#94A3B8" strokeWidth="0.8" opacity="0.25" />
            <rect x="910" y="430" width="35" height="4" fill="#475569" opacity="0.40" rx="0.5" />
            <path d="M895,460 Q920,465 945,458" fill="none" stroke="#475569" strokeWidth="3" opacity="0.25" strokeLinecap="round" />

            {/* Foam dots */}
            {[
              [856, 100], [870, 170], [884, 240], [900, 320], [910, 400],
              [915, 470], [910, 540], [898, 610], [888, 680], [878, 750],
            ].map(([fx, fy], i) => (
              <circle key={`foam-${i}`} cx={fx} cy={fy} r={1 + (i % 3) * 0.5} fill="#E0F0FF" opacity={0.18 + (i % 5) * 0.02} />
            ))}

            {/* Shore contour lines */}
            <path
              d="M845,0 Q855,95 875,175 Q895,245 915,375 Q935,475 915,595 Q895,745 845,895"
              fill="none" stroke="#8BB8D6" strokeWidth="0.5" opacity="0.12" strokeDasharray="6 4"
            />
          </g>

          {/* ═══ LAYER 4: District Terrain Textures ═══ */}
          <g id="layer-district-textures" style={{ pointerEvents: 'none' }}>
            {DISTRICTS_GEO.map((d) => {
              const patternFill = TERRAIN_PATTERN[d.terrain];
              if (!patternFill) return null;
              return (
                <polygon
                  key={`tex-${d.code}`}
                  points={polygonToPoints(d.polygon)}
                  fill={patternFill}
                  opacity="1"
                />
              );
            })}
          </g>

          {/* ═══ LAYER 5: Environmental Scatter ═══ */}
          <g id="layer-env-scatter" style={{ pointerEvents: 'none' }}>
            {DISTRICTS_GEO.map((d, idx) => {
              if (d.terrain === 'green') {
                const trees = scatterInPolygon(d.polygon, 12, idx * 1000 + 42);
                const rng = seededRandom(idx * 1000 + 99);
                return (
                  <g key={`env-${d.code}`}>
                    {trees.map(([tx, ty], i) => {
                      const r = 4 + rng() * 5;
                      return (
                        <g key={i}>
                          <rect x={tx - 0.5} y={ty} width={1} height={r * 0.6} fill={COLORS.earth} opacity="0.15" rx="0.2" />
                          <circle cx={tx} cy={ty - r * 0.1} r={r} fill={COLORS.grass} opacity={0.10 + rng() * 0.08} />
                          <circle cx={tx - r * 0.3} cy={ty - r * 0.3} r={r * 0.6} fill={COLORS.grassLight} opacity={0.08 + rng() * 0.05} />
                        </g>
                      );
                    })}
                  </g>
                );
              }
              if (d.terrain === 'urban') {
                const bldgs = scatterInPolygon(d.polygon, 8, idx * 1000 + 77);
                const rng = seededRandom(idx * 1000 + 55);
                return (
                  <g key={`env-${d.code}`}>
                    {bldgs.map(([bx, by], i) => {
                      const w = 3 + rng() * 5;
                      const h = 2 + rng() * 4;
                      return (
                        <rect
                          key={i} x={bx - w / 2} y={by - h / 2}
                          width={w} height={h}
                          fill={d.gradient[1]} opacity={0.07 + rng() * 0.04}
                          rx="0.3"
                        />
                      );
                    })}
                  </g>
                );
              }
              if (d.terrain === 'rural') {
                const posts = scatterInPolygon(d.polygon, 6, idx * 1000 + 33);
                const rng = seededRandom(idx * 1000 + 44);
                return (
                  <g key={`env-${d.code}`}>
                    {posts.map(([px, py], i) => (
                      <g key={i}>
                        <line x1={px} y1={py} x2={px} y2={py - 3 - rng() * 2} stroke={COLORS.earth} strokeWidth="0.6" opacity="0.14" strokeLinecap="round" />
                        <circle cx={px} cy={py - 4 - rng() * 2} r="1.2" fill={COLORS.grass} opacity={0.10 + rng() * 0.05} />
                      </g>
                    ))}
                    <g clipPath={`url(#v3-clip-${d.code})`}>
                      {Array.from({ length: 5 }, (_, i) => {
                        const y = d.center[1] - 60 + i * 30;
                        return (
                          <line key={`row-${i}`} x1={d.center[0] - 50} y1={y} x2={d.center[0] + 50} y2={y}
                            stroke={COLORS.earth} strokeWidth="0.5" opacity="0.08" strokeDasharray="4 3" />
                        );
                      })}
                    </g>
                  </g>
                );
              }
              if (d.terrain === 'industrial') {
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
                            stroke="#57534E" strokeWidth="1.2" opacity="0.12" strokeLinecap="round"
                          />
                          <circle cx={px} cy={py - 3} r="2" fill="#78716C" opacity="0.05" />
                        </g>
                      );
                    })}
                  </g>
                );
              }
              return null;
            })}
          </g>

          {/* ═══ LAYER 6: Roads ═══ */}
          <g id="layer-roads" style={{ pointerEvents: 'none' }}>
            {/* Casing */}
            {ROADS.map((road) => {
              const style = ROAD_STYLES[road.type] ?? ROAD_STYLES.tertiary;
              return (
                <path
                  key={`casing-${road.id}`} d={road.path} fill="none"
                  stroke={style.casingColor} strokeWidth={style.casingWidth}
                  opacity={style.opacity * 0.7} strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray={style.dash}
                />
              );
            })}
            {/* Fill */}
            {ROADS.map((road) => {
              const style = ROAD_STYLES[road.type] ?? ROAD_STYLES.tertiary;
              return (
                <path
                  key={`fill-${road.id}`} d={road.path} fill="none"
                  stroke={style.fillColor} strokeWidth={style.fillWidth}
                  opacity={style.opacity} strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray={style.dash}
                />
              );
            })}
            {/* Center lines */}
            {ROADS.map((road) => {
              const style = ROAD_STYLES[road.type] ?? ROAD_STYLES.tertiary;
              if (!style.centerLine) return null;
              return (
                <path
                  key={`center-${road.id}`} d={road.path} fill="none"
                  stroke={style.centerLine.color} strokeWidth={style.centerLine.width}
                  opacity={style.centerLine.opacity} strokeDasharray={style.centerLine.dash}
                  strokeLinecap="round"
                />
              );
            })}
            {/* Junctions */}
            {ROAD_JUNCTIONS.map(([jx, jy], i) => (
              <g key={`junction-${i}`}>
                <circle cx={jx} cy={jy} r="4" fill="#B8A08A" opacity="0.45" />
                <circle cx={jx} cy={jy} r="4" fill="none" stroke="#8B7355" strokeWidth="0.8" opacity="0.35" />
              </g>
            ))}
          </g>

          {/* ═══ LAYER 7: Forest Trees (between districts) ═══ */}
          <g id="layer-forests" style={{ pointerEvents: 'none' }}>
            {FOREST_TREES.map((tree, i) => (
              <g key={`ftree-${i}`}>
                <rect x={tree.x - 0.4} y={tree.y} width={0.8} height={tree.r * 0.5} fill={COLORS.earth} opacity="0.12" rx="0.2" />
                <circle cx={tree.x} cy={tree.y - tree.r * 0.1} r={tree.r} fill={tree.shade} opacity="0.14" />
                <circle cx={tree.x - tree.r * 0.25} cy={tree.y - tree.r * 0.3} r={tree.r * 0.5} fill={COLORS.grassLight} opacity="0.08" />
              </g>
            ))}
          </g>

          {/* ═══ LAYER 8: Districts ═══ */}
          <g id="layer-districts" style={{ pointerEvents: 'none' }}>
            {DISTRICTS_GEO.map((d) => {
              const isSelected = selectedCode === d.code;
              const isHovered = hoveredCode === d.code;
              const isActive = isSelected || isHovered;
              const isFlashing = clickFlash === d.code;
              const pts = polygonToPoints(d.polygon);

              return (
                <g key={d.code}>
                  {/* Gold glow for selected */}
                  {isSelected && (
                    <polygon
                      points={pts}
                      fill={COLORS.gold}
                      opacity="0.4"
                      filter="url(#v3-select-glow)"
                    />
                  )}
                  {/* Hover glow */}
                  {isHovered && !isSelected && (
                    <polygon
                      points={pts}
                      fill={COLORS.gold}
                      opacity="0.25"
                      filter="url(#v3-hover-glow)"
                    />
                  )}

                  {/* Click flash overlay */}
                  {isFlashing && (
                    <polygon
                      points={pts}
                      fill="white"
                      opacity="0.5"
                      className="animate-flash-overlay"
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

                  {/* Border — gold marching ants for selected, warm for hover */}
                  <polygon
                    points={pts}
                    fill="none"
                    stroke={
                      isSelected ? COLORS.gold
                      : isHovered ? COLORS.goldGlow
                      : d.stroke
                    }
                    strokeWidth={isSelected ? 3 : isHovered ? 2 : 0.5}
                    strokeDasharray={isSelected ? '8 4' : undefined}
                    style={{
                      transition: 'stroke 300ms ease, stroke-width 300ms ease',
                    }}
                  >
                    {isSelected && (
                      <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1.5s" repeatCount="indefinite" />
                    )}
                  </polygon>

                  {/* Dim other districts when one is selected */}
                  {selectedCode && !isActive && (
                    <polygon
                      points={pts}
                      fill="rgba(245,240,232,0.3)"
                      style={{ transition: 'opacity 400ms ease' }}
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* ═══ LAYER 9: Buildings (3D scenes) ═══ */}
          <g id="layer-buildings" style={{ pointerEvents: 'none' }} filter="url(#v3-building-shadow)">
            {DISTRICTS_GEO.map((d) => {
              const isActive = selectedCode === d.code || hoveredCode === d.code;
              return (
                <g
                  key={`bldg-${d.code}`}
                  clipPath={`url(#v3-clip-${d.code})`}
                  style={{
                    transform: isActive ? 'translateY(-2px)' : 'none',
                    transition: 'transform 300ms ease',
                  }}
                >
                  {renderDistrictScene(d.code, d.center[0], d.center[1], d.gradient)}
                </g>
              );
            })}
          </g>

          {/* ═══ LAYER 10: Landmarks (district icons) ═══ */}
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
                      {DISTRICT_ICONS[d.icon]?.(isActive ? COLORS.gold : d.gradient[0])}
                    </g>
                  </g>
                </g>
              );
            })}
          </g>

          {/* ═══ LAYER 11: Locked Zones ═══ */}
          <g id="layer-locked-zones" style={{ pointerEvents: 'none' }}>
            {LOCKED_ZONES.map((zone) => {
              const pts = polygonToPoints(zone.polygon);
              return (
                <g key={`locked-${zone.code}`} filter="url(#v3-locked-desat)">
                  {/* Desaturated fill */}
                  <polygon
                    points={pts}
                    fill={`url(#v3-lz-grad-${zone.code})`}
                    opacity="0.6"
                  />
                  {/* Dashed border */}
                  <polygon
                    points={pts}
                    fill="none"
                    stroke={COLORS.lockDash}
                    strokeWidth="2"
                    strokeDasharray="8 6"
                    opacity="0.5"
                  />
                  {/* Lock icon */}
                  <g transform={`translate(${zone.center[0] - 8}, ${zone.center[1] - 12})`}>
                    <rect x="2" y="8" width="12" height="10" rx="2" fill={COLORS.lockGray} opacity="0.6" />
                    <path d="M5,8 V5 A3,3 0 0,1 11,5 V8" fill="none" stroke={COLORS.lockGray} strokeWidth="1.5" opacity="0.6" />
                  </g>
                  {/* Zone name */}
                  <text
                    x={zone.center[0]}
                    y={zone.center[1] + 16}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="select-none"
                    style={{
                      fill: COLORS.lockGray,
                      fontSize: '9px',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase' as const,
                      opacity: 0.6,
                    }}
                  >
                    {zone.name}
                  </text>
                </g>
              );
            })}
          </g>

          {/* ═══ LAYER 12: Labels ═══ */}
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
                    fill: isActive ? '#2D1A0E' : 'hsl(30 20% 30%)',
                    fontSize: isActive ? '13px' : '11px',
                    fontWeight: isActive ? 700 : 500,
                    fontFamily: 'monospace',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase' as const,
                    textShadow: isActive
                      ? '0 1px 3px rgba(255,255,255,0.6)'
                      : '0 1px 2px rgba(255,255,255,0.4)',
                    transition: 'fill 300ms ease, font-size 300ms ease',
                  }}
                >
                  {d.name.length > 16 ? d.code.replace(/_/g, ' ') : d.name}
                </text>
              );
            })}

            {/* Road labels at zoom */}
            {viewState.scale >= 1.4 && ROAD_LABELS.map((rl) => (
              <text
                key={`road-label-${rl.roadId}`}
                x={rl.position[0]}
                y={rl.position[1]}
                textAnchor="middle"
                dominantBaseline="central"
                className="select-none"
                style={{
                  fill: 'hsl(30 15% 35%)',
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

            {/* POI labels at zoom */}
            {viewState.scale >= POI_VISIBLE_ZOOM && POIS.map((poi) => (
              <text
                key={`poi-label-${poi.id}`}
                x={poi.position[0]}
                y={poi.position[1] + 16}
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fill: 'hsl(30 15% 30%)',
                  fontSize: '8px',
                  fontFamily: 'monospace',
                  textShadow: '0 1px 2px rgba(255,255,255,0.5)',
                }}
              >
                {poi.name}
              </text>
            ))}
          </g>

          {/* ═══ LAYER 13: Atmospheric Effects ═══ */}
          <g id="layer-effects" style={{ pointerEvents: 'none' }}>
            {/* Atmospheric haze */}
            <circle cx="500" cy="400" r="120" fill="hsl(40 20% 90%)" opacity="0.015" filter="url(#v3-fog)" />
            <circle cx="250" cy="350" r="80" fill="hsl(40 20% 90%)" opacity="0.012" filter="url(#v3-fog)" />
            <circle cx="800" cy="300" r="60" fill={COLORS.sky} opacity="0.015" filter="url(#v3-fog)" />

            {/* Vignette */}
            <rect
              x="0" y="0" width={VIEW_W} height={VIEW_H}
              fill="url(#v3-bg-radial)" opacity="0.12"
              style={{ mixBlendMode: 'screen' }}
            />

            {/* Outer frame */}
            <rect
              x="0" y="0" width={VIEW_W} height={VIEW_H}
              fill="none" stroke={COLORS.earthLight} strokeWidth="1" opacity="0.3" rx="4"
            />
          </g>

          {/* ═══ LAYER 14: Hit Targets (INTERACTIVE) ═══ */}
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

            {/* Locked zone hit polygons */}
            {LOCKED_ZONES.map((zone) => (
              <polygon
                key={`hit-locked-${zone.code}`}
                points={polygonToPoints(zone.polygon)}
                fill="transparent"
                className="cursor-pointer"
                data-hit-target="locked-zone"
                data-testid={`locked-${zone.code}`}
                role="button"
                aria-label={`View locked zone: ${zone.name}`}
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); handleLockedZoneClick(zone); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLockedZoneClick(zone); } }}
              />
            ))}

            {/* POI hit circles */}
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

          {/* ═══ LAYER 15: Debug (dev only) ═══ */}
          {isDebug && (
            <g id="layer-debug" style={{ pointerEvents: 'none' }}>
              {DISTRICTS_GEO.map((d) => (
                <polygon
                  key={`debug-${d.code}`}
                  points={polygonToPoints(d.polygon)}
                  fill="rgba(255,0,0,0.15)" stroke="red"
                  strokeWidth="2" strokeDasharray="8 4"
                />
              ))}
              {LOCKED_ZONES.map((z) => (
                <polygon
                  key={`debug-lz-${z.code}`}
                  points={polygonToPoints(z.polygon)}
                  fill="rgba(255,165,0,0.15)" stroke="orange"
                  strokeWidth="2" strokeDasharray="6 4"
                />
              ))}
              {POIS.map((poi) => (
                <circle
                  key={`debug-poi-${poi.id}`}
                  cx={poi.position[0]} cy={poi.position[1]}
                  r={POI_HIT_RADIUS}
                  fill="rgba(0,255,0,0.2)" stroke="lime" strokeWidth="1.5"
                />
              ))}
              {DISTRICTS_GEO.map((d) => (
                <circle
                  key={`debug-center-${d.code}`}
                  cx={d.center[0]} cy={d.center[1]}
                  r="4" fill="yellow" opacity="0.8"
                />
              ))}
            </g>
          )}
        </g>
      </svg>

      {/* ═══ Zoom Controls ═══ */}
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
