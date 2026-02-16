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
          {/* 7 skyscrapers — dramatic height variation 40-90px */}
          {isoBox(cx - 48, gy, 11, 52, f, s, t, 'c0', dc.windowWarm)}
          {isoBox(cx - 34, gy, 13, 56, f, s, t, 'c1', dc.windowWarm)}
          {isoBox(cx - 18, gy, 16, 90, f, s, t, 'c2', dc.windowWarm)}
          {isoBox(cx + 2, gy, 12, 48, f, s, t, 'c3', dc.windowWarm)}
          {isoBox(cx + 18, gy, 15, 72, f, s, t, 'c4', dc.windowWarm)}
          {isoBox(cx + 38, gy, 11, 40, f, s, t, 'c5', dc.windowWarm)}
          {isoBox(cx + 52, gy, 10, 62, f, s, t, 'c6', dc.windowWarm)}
          {/* Glass curtain wall — horizontal lines on 3 tallest */}
          {[[-18, 90], [-18 + 16 + 2 + 18, 72], [cx - cx - 18, 90]].length && (
            <>
              {Array.from({ length: 16 }, (_, i) => (
                <line key={`cw1-${i}`} x1={cx - 18} y1={gy - 90 + 5 + i * 5} x2={cx - 18 + 16} y2={gy - 90 + 5 + i * 5} stroke="white" strokeWidth="0.3" opacity="0.08" />
              ))}
              {Array.from({ length: 13 }, (_, i) => (
                <line key={`cw2-${i}`} x1={cx + 18} y1={gy - 72 + 5 + i * 5} x2={cx + 18 + 15} y2={gy - 72 + 5 + i * 5} stroke="white" strokeWidth="0.3" opacity="0.08" />
              ))}
              {Array.from({ length: 11 }, (_, i) => (
                <line key={`cw3-${i}`} x1={cx + 52} y1={gy - 62 + 5 + i * 5} x2={cx + 52 + 10} y2={gy - 62 + 5 + i * 5} stroke="white" strokeWidth="0.3" opacity="0.08" />
              ))}
            </>
          )}
          {/* Helipad on tallest building */}
          <circle cx={cx - 10} cy={gy - 92} r="5" fill={t} opacity="0.6" />
          <circle cx={cx - 10} cy={gy - 92} r="4" fill="none" stroke="white" strokeWidth="0.4" opacity="0.4" />
          <text x={cx - 12} y={gy - 90} fontSize="4" fill="white" opacity="0.4" fontFamily="monospace">H</text>
          {/* Rooftop gardens on 2 buildings */}
          <rect x={cx + 2} y={gy - 50} width={10} height={2} fill="#4A7C59" opacity="0.4" rx="0.5" />
          <rect x={cx - 34} y={gy - 58} width={11} height={2} fill="#4A7C59" opacity="0.35" rx="0.5" />
          {/* Revolving restaurant dome */}
          <ellipse cx={cx + 25.5} cy={gy - 74} rx="5" ry="3" fill={`${g[0]}AA`} opacity="0.5" />
          {/* Antenna on tallest */}
          <line x1={cx - 10} y1={gy - 90} x2={cx - 10} y2={gy - 100} stroke={g[0]} strokeWidth="0.8" />
          <circle cx={cx - 10} cy={gy - 101} r="1.2" fill="#FF4444" opacity="0.8" />
          {/* Sky bridge */}
          <rect x={cx + 12} y={gy - 45} width={8} height={1.5} fill={s} opacity="0.5" rx="0.3" />
          {/* Plaza fountain at ground level */}
          <circle cx={cx + 5} cy={gy + 4} r="5" fill={COLORS.waterShallow} opacity="0.12" />
          <circle cx={cx + 5} cy={gy + 4} r="3" fill={COLORS.water} opacity="0.08" />
          <circle cx={cx + 5} cy={gy + 4} r="1" fill="white" opacity="0.10" />
          {/* Ground level */}
          <rect x={cx - 48} y={gy} width={110} height={2} fill="rgba(0,0,0,0.05)" rx="0.3" />
          {/* Ground-level awnings */}
          <rect x={cx - 48} y={gy - 4} width={8} height={1.5} fill={COLORS.marketAwning} opacity="0.2" rx="0.3" />
          <rect x={cx + 2} y={gy - 4} width={8} height={1.5} fill={COLORS.neonBlue} opacity="0.15" rx="0.3" />
        </g>
      );
    case 'OLD_TOWN':
      return (
        <g>
          {/* 6 buildings — mix of pointed and flat */}
          {pointedBox(cx - 44, gy, 14, 22, f, s, g[1], 'o0')}
          {pointedBox(cx - 26, gy, 13, 20, f, s, g[1], 'o1')}
          {pointedBox(cx - 8, gy, 11, 44, f, s, g[1], 'o2', 18)}
          {pointedBox(cx + 8, gy, 15, 24, f, s, g[1], 'o3')}
          {flatBox(cx + 28, gy, 12, 16, f, s, t, 'o4')}
          {flatBox(cx + 44, gy, 10, 12, f, s, t, 'o5')}
          {/* Church steeple — tallest structure with cross */}
          <line x1={cx - 2.5} y1={gy - 63} x2={cx - 2.5} y2={gy - 70} stroke={g[0]} strokeWidth="0.8" />
          <line x1={cx - 4.5} y1={gy - 68} x2={cx - 0.5} y2={gy - 68} stroke={g[0]} strokeWidth="0.8" />
          {/* Town clock on church tower */}
          <circle cx={cx - 2.5} cy={gy - 52} r="2.5" fill="white" opacity="0.25" />
          <line x1={cx - 2.5} y1={gy - 52} x2={cx - 2.5} y2={gy - 54} stroke={g[1]} strokeWidth="0.4" opacity="0.4" />
          <line x1={cx - 2.5} y1={gy - 52} x2={cx - 1} y2={gy - 51.5} stroke={g[1]} strokeWidth="0.3" opacity="0.4" />
          {/* Ornate window shutters — tiny rects flanking windows */}
          {[[-26, 20], [-8, 44], [8, 24]].map(([bx, bh], bi) => {
            const nw = Math.max(0, Math.floor((bh - 4) / 8));
            return Array.from({ length: nw }, (_, wi) => (
              <g key={`shutter-${bi}-${wi}`}>
                <rect x={cx + bx} y={gy - bh + 3 + wi * 8} width={1} height={2.5} fill={g[1]} opacity="0.15" rx="0.1" />
                <rect x={cx + bx + (bi === 2 ? 14 : bi === 1 ? 10 : 12)} y={gy - bh + 3 + wi * 8} width={1} height={2.5} fill={g[1]} opacity="0.15" rx="0.1" />
              </g>
            ));
          })}
          {/* Hanging flower baskets on building edges */}
          <circle cx={cx - 44} cy={gy - 10} r="1.2" fill="#E74C8B" opacity="0.5" />
          <circle cx={cx - 26} cy={gy - 8} r="1" fill="#FF6B6B" opacity="0.45" />
          <circle cx={cx + 23} cy={gy - 12} r="1.2" fill="#E74C8B" opacity="0.5" />
          <circle cx={cx + 40} cy={gy - 8} r="1" fill="#FFD54F" opacity="0.4" />
          {/* Cobblestone ground */}
          <rect x={cx - 44} y={gy} width={96} height={4} fill="url(#v3-cobblestone)" opacity="0.15" />
          {/* Town well/fountain */}
          <circle cx={cx + 36} cy={gy + 6} r="3" fill={COLORS.waterShallow} opacity="0.12" />
          <rect x={cx + 35} y={gy + 2} width={2} height={4} fill={COLORS.earth} opacity="0.15" rx="0.2" />
        </g>
      );
    case 'MARINA':
      return (
        <g>
          {isoBox(cx - 34, gy, 18, 22, f, s, t, 'm1')}
          {isoBox(cx - 10, gy, 15, 26, f, s, t, 'm2')}
          {flatBox(cx + 10, gy, 12, 14, f, s, t, 'm3')}
          {/* Lighthouse — tall narrow structure with beacon */}
          <rect x={cx - 46} y={gy - 36} width={5} height={36} fill="white" opacity="0.5" />
          <rect x={cx - 47} y={gy - 38} width={7} height={3} fill={g[0]} opacity="0.5" />
          <circle cx={cx - 43.5} cy={gy - 40} r="2.5" fill={COLORS.gold} opacity="0.5">
            <animate attributeName="opacity" values="0.5;0.9;0.5" dur="2s" repeatCount="indefinite" />
          </circle>
          {/* Pier */}
          <rect x={cx + 26} y={gy - 2} width={28} height={2.5} fill={COLORS.earth} opacity="0.5" rx="0.3" />
          {/* Dock cleats */}
          <rect x={cx + 28} y={gy - 3} width={1.5} height={1.5} fill={COLORS.earth} opacity="0.35" rx="0.2" />
          <rect x={cx + 38} y={gy - 3} width={1.5} height={1.5} fill={COLORS.earth} opacity="0.35" rx="0.2" />
          <rect x={cx + 48} y={gy - 3} width={1.5} height={1.5} fill={COLORS.earth} opacity="0.35" rx="0.2" />
          {/* Sailboats — 4 with varying sails */}
          <polygon points={`${cx+30},${gy-8} ${cx+36},${gy-18} ${cx+36},${gy-8}`} fill="white" opacity="0.6" />
          <rect x={cx + 35} y={gy - 18} width="1" height="14" fill={COLORS.earth} opacity="0.4" />
          <ellipse cx={cx + 33} cy={gy - 4} rx="5" ry="2" fill={COLORS.water} opacity="0.3" />
          <polygon points={`${cx+42},${gy-6} ${cx+46},${gy-14} ${cx+46},${gy-6}`} fill="white" opacity="0.4" />
          <rect x={cx + 45} y={gy - 14} width="0.8" height="10" fill={COLORS.earth} opacity="0.3" />
          <polygon points={`${cx+50},${gy-6} ${cx+53},${gy-12} ${cx+53},${gy-6}`} fill="#FFD54F" opacity="0.35" />
          <rect x={cx + 52.5} y={gy - 12} width="0.6" height="8" fill={COLORS.earth} opacity="0.3" />
          <polygon points={`${cx+26},${gy-6} ${cx+24},${gy-12} ${cx+24},${gy-6}`} fill="white" opacity="0.3" />
          <rect x={cx + 23.5} y={gy - 12} width="0.6" height="8" fill={COLORS.earth} opacity="0.3" />
          {/* Rope lines from boats to dock */}
          <path d={`M${cx+30},${gy-3} Q${cx+29},${gy-5} ${cx+28},${gy-3}`} fill="none" stroke={COLORS.earth} strokeWidth="0.3" opacity="0.2" />
          <path d={`M${cx+44},${gy-3} Q${cx+43},${gy-5} ${cx+42},${gy-3}`} fill="none" stroke={COLORS.earth} strokeWidth="0.3" opacity="0.2" />
          {/* Seaside café — flat awning with tables */}
          <rect x={cx + 10} y={gy - 8} width={10} height={1.5} fill={COLORS.marketAwning} opacity="0.3" rx="0.3" />
          <circle cx={cx + 13} cy={gy - 4} r="1" fill={COLORS.earth} opacity="0.15" />
          <circle cx={cx + 17} cy={gy - 4} r="1" fill={COLORS.earth} opacity="0.15" />
          {/* Seagulls on pier posts */}
          <use href="#v3-seagull" x={cx + 30} y={gy - 8} width="5" height="3" opacity="0.25" />
          <use href="#v3-seagull" x={cx + 44} y={gy - 6} width="4" height="2.5" opacity="0.20" />
          {/* Beach umbrella */}
          <circle cx={cx - 26} cy={gy - 10} r="4" fill="#FF6B6B" opacity="0.3" />
          <rect x={cx - 26.5} y={gy - 10} width="1" height="10" fill={COLORS.earth} opacity="0.3" />
        </g>
      );
    case 'TECH_PARK':
      return (
        <g>
          {isoBox(cx - 32, gy, 14, 42, f, s, t, 't1', dc.windowWarm)}
          {isoBox(cx - 14, gy, 16, 52, f, s, t, 't2', dc.windowWarm)}
          {isoBox(cx + 8, gy, 13, 38, f, s, t, 't3', dc.windowWarm)}
          {/* Glass dome building */}
          {domeBox(cx + 26, gy, 18, 28, f, s, `${COLORS.neonBlue}66`, 't4')}
          {/* Server building with blinking lights */}
          {flatBox(cx + 48, gy, 10, 18, f, s, t, 't5')}
          {[0, 1, 2, 3].map((li) => (
            <circle key={`blink-${li}`} cx={cx + 51 + li * 2} cy={gy - 14 + li * 3} r="0.6" fill={li % 2 === 0 ? '#22C55E' : COLORS.neonBlue} opacity="0.5">
              <animate attributeName="opacity" values="0.5;0.1;0.5" dur={`${0.8 + li * 0.3}s`} repeatCount="indefinite" />
            </circle>
          ))}
          {/* Solar panel arrays */}
          <rect x={cx - 13} y={gy - 54} width={14} height={3.5} fill="rgba(100,140,255,0.3)" rx="0.5" />
          <line x1={cx - 6} y1={gy - 54} x2={cx - 6} y2={gy - 50.5} stroke={s} strokeWidth="0.3" opacity="0.4" />
          <line x1={cx} y1={gy - 54} x2={cx} y2={gy - 50.5} stroke={s} strokeWidth="0.3" opacity="0.4" />
          <rect x={cx + 8} y={gy - 40} width={10} height={3} fill="rgba(100,140,255,0.25)" rx="0.5" />
          <line x1={cx + 13} y1={gy - 40} x2={cx + 13} y2={gy - 37} stroke={s} strokeWidth="0.3" opacity="0.3" />
          {/* Satellite dish */}
          <ellipse cx={cx + 36} cy={gy - 28} rx="4" ry="2" fill={s} opacity="0.5" />
          <rect x={cx + 35.5} y={gy - 30} width="1" height="4" fill={s} opacity="0.4" />
          {/* Digital billboard with neon glow */}
          <rect x={cx - 30} y={gy - 30} width={10} height={5} fill={COLORS.neonBlue} opacity="0.15" rx="0.5" />
          <rect x={cx - 30} y={gy - 30} width={10} height={5} fill="none" stroke={COLORS.neonBlue} strokeWidth="0.5" opacity="0.25" rx="0.5" />
          {/* Drone/satellite floating above */}
          <rect x={cx - 4} y={gy - 64} width={3} height={1.5} fill={s} opacity="0.25" rx="0.3">
            <animateTransform attributeName="transform" type="translate" values="0,0;0,-3;0,0" dur="4s" repeatCount="indefinite" />
          </rect>
          <line x1={cx - 5} y1={gy - 63} x2={cx} y2={gy - 63} stroke={s} strokeWidth="0.3" opacity="0.2">
            <animateTransform attributeName="transform" type="translate" values="0,0;0,-3;0,0" dur="4s" repeatCount="indefinite" />
          </line>
          {/* EV charging stations */}
          <rect x={cx + 46} y={gy - 4} width={1} height={4} fill="#6B7280" opacity="0.2" />
          <circle cx={cx + 46.5} cy={gy - 5} r="0.8" fill="#22C55E" opacity="0.3" />
          <rect x={cx + 50} y={gy - 4} width={1} height={4} fill="#6B7280" opacity="0.2" />
          <circle cx={cx + 50.5} cy={gy - 5} r="0.8" fill="#22C55E" opacity="0.3" />
          {/* Ground plaza */}
          <rect x={cx - 32} y={gy} width={68} height={2} fill="url(#v3-tech-grid)" opacity="0.12" />
        </g>
      );
    case 'MARKET_SQ':
      return (
        <g>
          {/* 5 market stalls with vivid alternating roofs */}
          <rect x={cx - 40} y={gy - 12} width={14} height={12} fill={f} />
          <path d={`M${cx-41},${gy-12} L${cx-33},${gy-20} L${cx-25},${gy-12}`} fill="#E74C8B" opacity="0.7" />
          <rect x={cx - 22} y={gy - 14} width={14} height={14} fill={f} />
          <path d={`M${cx-23},${gy-14} L${cx-15},${gy-22} L${cx-7},${gy-14}`} fill="#FFD54F" opacity="0.8" />
          <rect x={cx - 2} y={gy - 12} width={14} height={12} fill={f} />
          <path d={`M${cx-3},${gy-12} L${cx+5},${gy-19} L${cx+13},${gy-12}`} fill="#4A7C59" opacity="0.7" />
          <rect x={cx + 18} y={gy - 13} width={13} height={13} fill={f} />
          <path d={`M${cx+17},${gy-13} L${cx+24.5},${gy-20} L${cx+32},${gy-13}`} fill={COLORS.neonBlue} opacity="0.5" />
          <rect x={cx + 36} y={gy - 11} width={12} height={11} fill={f} />
          <path d={`M${cx+35},${gy-11} L${cx+42},${gy-18} L${cx+49},${gy-11}`} fill={COLORS.marketAwning} opacity="0.7" />
          {/* Product displays under awnings */}
          {[[-38, 4], [-20, 5], [0, 4], [20, 4], [38, 3]].map(([off, count], si) => (
            <g key={`prod-${si}`}>
              {Array.from({ length: count }, (_, pi) => (
                <rect key={pi} x={cx + off + pi * 3} y={gy - 4} width={2} height={1.5}
                  fill={['#E74C8B', '#FFD54F', '#22C55E', '#3B82F6', '#FF6B6B'][pi % 5]} opacity="0.2" rx="0.2" />
              ))}
            </g>
          ))}
          {/* Central fountain with water spray */}
          <circle cx={cx} cy={gy + 6} r="5" fill={COLORS.waterShallow} opacity="0.12" />
          <circle cx={cx} cy={gy + 6} r="3" fill={COLORS.water} opacity="0.08" />
          {/* Spray droplets — animated rising */}
          {[0, 1, 2].map((di) => (
            <circle key={`spray-${di}`} cx={cx - 1 + di} cy={gy + 2} r="0.4" fill={COLORS.waterShallow} opacity="0.15">
              <animate attributeName="cy" values={`${gy + 2};${gy - 2};${gy + 2}`} dur={`${1.5 + di * 0.3}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.15;0.04;0.15" dur={`${1.5 + di * 0.3}s`} repeatCount="indefinite" />
            </circle>
          ))}
          {/* String lights between stalls */}
          <path d={`M${cx-33},${gy-18} Q${cx-24},${gy-15} ${cx-15},${gy-20}`} fill="none" stroke={COLORS.gold} strokeWidth="0.3" opacity="0.2" />
          <path d={`M${cx-15},${gy-20} Q${cx-6},${gy-17} ${cx+5},${gy-17}`} fill="none" stroke={COLORS.gold} strokeWidth="0.3" opacity="0.2" />
          <path d={`M${cx+5},${gy-17} Q${cx+14},${gy-15} ${cx+24.5},${gy-18}`} fill="none" stroke={COLORS.gold} strokeWidth="0.3" opacity="0.2" />
          {/* Tiny lights on string */}
          {[-28, -20, -10, 0, 10, 20].map((lx, li) => (
            <circle key={`slight-${li}`} cx={cx + lx} cy={gy - 17 + Math.abs(lx) * 0.02} r="0.5" fill="#FFD54F" opacity="0.4" />
          ))}
          {/* Busker/musician silhouette */}
          <circle cx={cx - 6} cy={gy + 3} r="1" fill={g[1]} opacity="0.15" />
          <rect x={cx - 6.5} y={gy + 4} width={1} height={3} fill={g[1]} opacity="0.12" rx="0.2" />
          {/* Barrel stacks and crate piles */}
          <ellipse cx={cx + 14} cy={gy - 1} rx="2" ry="1.5" fill={COLORS.earth} opacity="0.2" />
          <rect x={cx - 30} y={gy - 4} width={3} height={3} fill={COLORS.sandDark} opacity="0.2" rx="0.3" />
          <rect x={cx - 28} y={gy - 6} width={2.5} height={2.5} fill={COLORS.earth} opacity="0.18" rx="0.3" />
          {/* Ground */}
          <rect x={cx - 40} y={gy} width={90} height={2} fill="rgba(0,0,0,0.04)" rx="0.3" />
        </g>
      );
    case 'ENTERTAINMENT':
      return (
        <g>
          {isoBox(cx - 30, gy, 14, 30, f, s, t, 'e1')}
          {domeBox(cx - 10, gy, 18, 36, f, s, `${g[0]}AA`, 'e2')}
          {isoBox(cx + 14, gy, 12, 24, f, s, t, 'e3')}
          {/* Ferris wheel with animated rotation */}
          <g>
            <circle cx={cx + 40} cy={gy - 22} r="14" fill="none" stroke={g[0]} strokeWidth="1" opacity="0.3" />
            <circle cx={cx + 40} cy={gy - 22} r="2" fill={g[0]} opacity="0.35" />
            {/* Spokes */}
            <g>
              {[0, 45, 90, 135].map((angle) => (
                <line key={`spoke-${angle}`}
                  x1={cx + 40 + Math.cos(angle * Math.PI / 180) * 14}
                  y1={gy - 22 + Math.sin(angle * Math.PI / 180) * 14}
                  x2={cx + 40 - Math.cos(angle * Math.PI / 180) * 14}
                  y2={gy - 22 - Math.sin(angle * Math.PI / 180) * 14}
                  stroke={g[0]} strokeWidth="0.5" opacity="0.2"
                />
              ))}
              <animateTransform attributeName="transform" type="rotate" from={`0 ${cx+40} ${gy-22}`} to={`360 ${cx+40} ${gy-22}`} dur="20s" repeatCount="indefinite" />
            </g>
            {/* Support */}
            <line x1={cx + 36} y1={gy} x2={cx + 40} y2={gy - 8} stroke={g[0]} strokeWidth="1" opacity="0.3" />
            <line x1={cx + 44} y1={gy} x2={cx + 40} y2={gy - 8} stroke={g[0]} strokeWidth="1" opacity="0.3" />
          </g>
          {/* Theater with marquee and neon glow */}
          <rect x={cx - 30} y={gy - 34} width={14} height={4} fill={g[0]} opacity="0.3" rx="0.5" />
          <rect x={cx - 30} y={gy - 34} width={14} height={4} fill="none" stroke={COLORS.neonPink} strokeWidth="0.5" opacity="0.3" rx="0.5" />
          {/* Roller coaster track */}
          <path d={`M${cx-42},${gy-8} Q${cx-38},${gy-22} ${cx-32},${gy-10} Q${cx-28},${gy-2} ${cx-22},${gy-14}`}
            fill="none" stroke={g[0]} strokeWidth="0.8" opacity="0.2" />
          {/* Stage lights */}
          <circle cx={cx - 6} cy={gy - 40} r="2" fill={COLORS.neonPink} opacity="0.15" filter="url(#v3-glow-warm)" />
          <circle cx={cx + 4} cy={gy - 38} r="1.5" fill={COLORS.neonBlue} opacity="0.12" filter="url(#v3-glow-cool)" />
          {/* Popcorn cart */}
          <rect x={cx + 18} y={gy - 6} width={4} height={5} fill="#FFD54F" opacity="0.25" rx="0.3" />
          <rect x={cx + 17} y={gy - 7} width={6} height={2} fill={COLORS.marketAwning} opacity="0.2" rx="0.3" />
          {/* Animated neon sign flicker */}
          <rect x={cx - 8} y={gy - 42} width={8} height={2} fill={COLORS.neonPink} opacity="0.2" rx="0.3">
            <animate attributeName="opacity" values="0.2;0.08;0.2;0.15;0.2" dur="3s" repeatCount="indefinite" />
          </rect>
          {/* Sparkles */}
          <circle cx={cx + 12} cy={gy - 30} r="0.6" fill="#FFD54F" opacity="0.5" />
          <circle cx={cx - 16} cy={gy - 16} r="0.8" fill="#FFD54F" opacity="0.6" />
        </g>
      );
    case 'UNIVERSITY':
      return (
        <g>
          {domeBox(cx - 22, gy, 22, 28, f, s, `${g[0]}BB`, 'u1')}
          {pointedBox(cx + 6, gy, 14, 22, f, s, g[1], 'u2')}
          {flatBox(cx - 44, gy, 14, 14, f, s, t, 'u3')}
          {flatBox(cx + 26, gy, 12, 12, f, s, t, 'u4')}
          {/* Columned entrance — 5 columns with horizontal beam */}
          {[0, 1, 2, 3, 4].map((ci) => (
            <line key={`col-${ci}`} x1={cx - 18 + ci * 6} y1={gy} x2={cx - 18 + ci * 6} y2={gy - 24} stroke={g[0]} strokeWidth="1.2" opacity="0.4" />
          ))}
          <line x1={cx - 19} y1={gy - 24} x2={cx + 7} y2={gy - 24} stroke={g[0]} strokeWidth="1.5" opacity="0.35" />
          {/* Clock tower with clock face */}
          <rect x={cx + 8} y={gy - 38} width={10} height={16} fill={f} opacity="0.6" />
          <polygon points={`${cx+7},${gy-38} ${cx+13},${gy-46} ${cx+19},${gy-38}`} fill={g[1]} opacity="0.5" />
          <circle cx={cx + 13} cy={gy - 32} r="3" fill="white" opacity="0.2" />
          <line x1={cx + 13} y1={gy - 32} x2={cx + 13} y2={gy - 34.5} stroke={g[1]} strokeWidth="0.4" opacity="0.35" />
          <line x1={cx + 13} y1={gy - 32} x2={cx + 14.5} y2={gy - 31} stroke={g[1]} strokeWidth="0.3" opacity="0.35" />
          {/* Open book symbol on ground */}
          <path d={`M${cx-4},${gy+5} L${cx-1},${gy+3} L${cx+2},${gy+5}`} fill="none" stroke={g[0]} strokeWidth="0.5" opacity="0.15" />
          {/* Campus paths */}
          <line x1={cx - 22} y1={gy + 2} x2={cx + 6} y2={gy + 2} stroke={COLORS.sand} strokeWidth="0.8" opacity="0.1" />
          <line x1={cx - 11} y1={gy + 2} x2={cx - 11} y2={gy + 8} stroke={COLORS.sand} strokeWidth="0.8" opacity="0.08" />
          {/* Sports field */}
          <rect x={cx + 30} y={gy + 2} width={14} height={8} fill={COLORS.grass} opacity="0.12" rx="0.5" />
          <line x1={cx + 37} y1={gy + 2} x2={cx + 37} y2={gy + 10} stroke="white" strokeWidth="0.3" opacity="0.1" />
          <circle cx={cx + 37} cy={gy + 6} r="2" fill="none" stroke="white" strokeWidth="0.2" opacity="0.08" />
          {/* Flag with graduation cap hint */}
          <rect x={cx + 20} y={gy - 42} width="1" height="20" fill={g[1]} opacity="0.5" />
          <polygon points={`${cx+21},${gy-42} ${cx+28},${gy-39} ${cx+21},${gy-36}`} fill={g[0]} opacity="0.4" />
          <rect x={cx + 19} y={gy - 44} width={4} height={1} fill={g[1]} opacity="0.3" />
          {/* Lamppost */}
          <rect x={cx + 42} y={gy - 14} width="1" height="14" fill={COLORS.earth} opacity="0.3" />
          <circle cx={cx + 42.5} cy={gy - 15} r="2" fill="#FFD54F" opacity="0.2" />
        </g>
      );
    case 'HARBOR':
      return (
        <g>
          {isoBox(cx - 36, gy, 18, 18, f, s, t, 'h1')}
          {flatBox(cx - 12, gy, 14, 12, f, s, t, 'h2')}
          {/* Crane — taller with cable animation */}
          <rect x={cx + 8} y={gy - 52} width="3" height="52" fill={g[0]} opacity="0.8" />
          <line x1={cx + 9.5} y1={gy - 52} x2={cx + 36} y2={gy - 44} stroke={g[0]} strokeWidth="1.5" opacity="0.7" />
          <line x1={cx + 32} y1={gy - 45} x2={cx + 32} y2={gy - 26} stroke={g[0]} strokeWidth="0.6" opacity="0.5">
            <animate attributeName="x1" values={`${cx+32};${cx+30};${cx+32}`} dur="5s" repeatCount="indefinite" />
          </line>
          <rect x={cx + 30} y={gy - 26} width={4} height={3} fill={g[0]} opacity="0.5" />
          {/* Cargo ship — large rectangle with bridge */}
          <rect x={cx - 30} y={gy + 4} width={36} height={8} fill="#374151" opacity="0.25" rx="0.5" />
          <rect x={cx - 28} y={gy} width={6} height={4} fill="#4B5563" opacity="0.2" rx="0.3" />
          {/* Container stacks — organized grid */}
          <rect x={cx + 6} y={gy - 6} width={7} height={6} fill="#E74C8B" opacity="0.5" rx="0.3" />
          <rect x={cx + 15} y={gy - 6} width={7} height={6} fill="#3B82F6" opacity="0.5" rx="0.3" />
          <rect x={cx + 24} y={gy - 6} width={7} height={6} fill="#22C55E" opacity="0.4" rx="0.3" />
          <rect x={cx + 10} y={gy - 12} width={7} height={6} fill="#FFD54F" opacity="0.45" rx="0.3" />
          <rect x={cx + 19} y={gy - 12} width={7} height={6} fill="#8B5CF6" opacity="0.4" rx="0.3" />
          <rect x={cx + 6} y={gy - 18} width={7} height={6} fill="#3B82F6" opacity="0.35" rx="0.3" />
          {/* Tugboat — small boat near ship */}
          <rect x={cx + 8} y={gy + 10} width={6} height={3} fill={g[1]} opacity="0.2" rx="0.5" />
          <rect x={cx + 12} y={gy + 8} width={2} height={2} fill={g[1]} opacity="0.15" />
          {/* Mooring bollards */}
          {[0, 1, 2, 3].map((bi) => (
            <rect key={`bollard-${bi}`} x={cx + 34 + bi * 5} y={gy - 3} width="2" height="3" fill={COLORS.earth} opacity="0.4" rx="0.3" />
          ))}
          {/* Fuel storage tanks */}
          <circle cx={cx - 40} cy={gy - 4} r="5" fill="#9CA3AF" opacity="0.12" />
          <line x1={cx - 45} y1={gy - 4} x2={cx - 35} y2={gy - 4} stroke="#6B7280" strokeWidth="0.5" opacity="0.1" />
        </g>
      );
    case 'INDUSTRIAL':
      return (
        <g>
          {/* Factory with sawtooth roof */}
          <rect x={cx - 34} y={gy - 22} width={28} height={22} fill={f} opacity="0.9" />
          <polygon points={`${cx-34},${gy-22} ${cx-27},${gy-30} ${cx-20},${gy-22} ${cx-13},${gy-30} ${cx-6},${gy-22}`} fill={s} opacity="0.7" />
          <rect x={cx - 32} y={gy - 16} width={5} height={3} fill={dc.window} opacity="0.3" rx="0.2" />
          <rect x={cx - 24} y={gy - 16} width={5} height={3} fill={dc.window} opacity="0.3" rx="0.2" />
          <rect x={cx - 16} y={gy - 16} width={5} height={3} fill={dc.window} opacity="0.3" rx="0.2" />
          {isoBox(cx + 0, gy, 18, 20, f, s, t, 'i2')}
          {flatBox(cx + 24, gy, 16, 14, f, s, t, 'i3')}
          {/* Smokestacks with animated smoke */}
          <rect x={cx - 30} y={gy - 42} width="3" height="20" fill={g[1]} opacity="0.8" />
          <rect x={cx - 22} y={gy - 38} width="3" height="16" fill={g[1]} opacity="0.7" />
          <ellipse cx={cx - 28.5} cy={gy - 45} rx="5" ry="3" fill={g[0]} opacity="0.06">
            <animate attributeName="cy" values={`${gy-45};${gy-56};${gy-45}`} dur="7s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.06;0.01;0.06" dur="7s" repeatCount="indefinite" />
            <animate attributeName="rx" values="5;9;5" dur="7s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx={cx - 20.5} cy={gy - 41} rx="4" ry="2.5" fill={g[0]} opacity="0.05">
            <animate attributeName="cy" values={`${gy-41};${gy-52};${gy-41}`} dur="8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.05;0.01;0.05" dur="8s" repeatCount="indefinite" />
            <animate attributeName="rx" values="4;7;4" dur="8s" repeatCount="indefinite" />
          </ellipse>
          {/* Cooling towers — wide-at-top trapezoids */}
          <polygon points={`${cx+42},${gy} ${cx+44},${gy-18} ${cx+52},${gy-18} ${cx+54},${gy}`} fill={s} opacity="0.35" />
          <ellipse cx={cx + 48} cy={gy - 18} rx="5" ry="2" fill={t} opacity="0.3" />
          {/* Steam from cooling tower */}
          <ellipse cx={cx + 48} cy={gy - 22} rx="3" ry="1.5" fill="white" opacity="0.04">
            <animate attributeName="cy" values={`${gy-22};${gy-30};${gy-22}`} dur="10s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.04;0.01;0.04" dur="10s" repeatCount="indefinite" />
          </ellipse>
          {/* Power line towers */}
          <rect x={cx + 36} y={gy - 28} width="1.5" height="28" fill={g[1]} opacity="0.3" />
          <line x1={cx + 34} y1={gy - 26} x2={cx + 39} y2={gy - 28} stroke={g[1]} strokeWidth="0.5" opacity="0.2" />
          <line x1={cx + 34} y1={gy - 28} x2={cx + 39} y2={gy - 26} stroke={g[1]} strokeWidth="0.5" opacity="0.2" />
          <line x1={cx + 37} y1={gy - 28} x2={cx + 56} y2={gy - 25} stroke={g[1]} strokeWidth="0.4" opacity="0.15" />
          {/* Water treatment pool */}
          <circle cx={cx + 18} cy={gy + 6} r="5" fill={COLORS.waterShallow} opacity="0.12" />
          <circle cx={cx + 18} cy={gy + 6} r="3" fill={COLORS.water} opacity="0.06" />
          {/* Truck silhouette */}
          <rect x={cx + 26} y={gy - 3} width={6} height={3} fill="#4B5563" opacity="0.12" rx="0.3" />
          <rect x={cx + 24} y={gy - 2} width={3} height={2} fill="#4B5563" opacity="0.10" rx="0.2" />
          <circle cx={cx + 25.5} cy={gy} r="0.8" fill="#374151" opacity="0.12" />
          <circle cx={cx + 30.5} cy={gy} r="0.8" fill="#374151" opacity="0.12" />
        </g>
      );
    case 'SUBURBS_N':
      return (
        <g>
          {/* 5 houses with varied sizes and roofs */}
          {pointedBox(cx - 36, gy, 14, 14, f, s, g[1], 'sn0')}
          {pointedBox(cx - 18, gy, 12, 12, f, s, COLORS.roofTerracotta, 'sn1')}
          {pointedBox(cx - 2, gy, 14, 15, f, s, g[1], 'sn2')}
          {pointedBox(cx + 16, gy, 11, 11, f, s, COLORS.roofSlate, 'sn3')}
          {flatBox(cx + 30, gy, 10, 8, f, s, t, 'sn4')}
          {/* Gardens behind houses */}
          <circle cx={cx - 32} cy={gy + 5} r="3" fill={COLORS.grass} opacity="0.2" />
          <circle cx={cx - 14} cy={gy + 4} r="2.5" fill={COLORS.grassLight} opacity="0.18" />
          <circle cx={cx + 6} cy={gy + 5} r="3.5" fill={COLORS.grass} opacity="0.2" />
          <circle cx={cx + 20} cy={gy + 4} r="2" fill={COLORS.grassLight} opacity="0.15" />
          {/* Swing set */}
          <line x1={cx + 42} y1={gy} x2={cx + 42} y2={gy - 8} stroke={COLORS.earth} strokeWidth="0.8" opacity="0.2" />
          <line x1={cx + 48} y1={gy} x2={cx + 48} y2={gy - 8} stroke={COLORS.earth} strokeWidth="0.8" opacity="0.2" />
          <line x1={cx + 42} y1={gy - 8} x2={cx + 48} y2={gy - 8} stroke={COLORS.earth} strokeWidth="0.8" opacity="0.2" />
          <line x1={cx + 44} y1={gy - 8} x2={cx + 43} y2={gy - 2} stroke={COLORS.earth} strokeWidth="0.4" opacity="0.15" />
          <line x1={cx + 46} y1={gy - 8} x2={cx + 47} y2={gy - 2} stroke={COLORS.earth} strokeWidth="0.4" opacity="0.15" />
          {/* Car in driveway */}
          <rect x={cx + 12} y={gy + 1} width={5} height={2.5} fill="#4B5563" opacity="0.12" rx="0.5" />
          {/* Doghouse */}
          <rect x={cx - 40} y={gy - 3} width={4} height={3} fill={COLORS.earth} opacity="0.15" rx="0.2" />
          <polygon points={`${cx-40},${gy-3} ${cx-38},${gy-5.5} ${cx-36},${gy-3}`} fill={g[1]} opacity="0.15" />
          {/* Bicycle shape near house */}
          <circle cx={cx + 26} cy={gy - 1} r="1.2" fill="none" stroke={COLORS.earth} strokeWidth="0.3" opacity="0.12" />
          <circle cx={cx + 29} cy={gy - 1} r="1.2" fill="none" stroke={COLORS.earth} strokeWidth="0.3" opacity="0.12" />
          <line x1={cx + 26} y1={gy - 1} x2={cx + 28} y2={gy - 3} stroke={COLORS.earth} strokeWidth="0.3" opacity="0.12" />
          <line x1={cx + 28} y1={gy - 3} x2={cx + 29} y2={gy - 1} stroke={COLORS.earth} strokeWidth="0.3" opacity="0.12" />
          {/* Tree */}
          <circle cx={cx - 24} cy={gy - 12} r="6" fill={COLORS.grass} opacity="0.35" />
          <rect x={cx - 24.5} y={gy - 6} width="1" height="6" fill={COLORS.earth} opacity="0.3" />
          {/* Fence */}
          <line x1={cx - 36} y1={gy} x2={cx + 40} y2={gy} stroke={COLORS.earth} strokeWidth="0.5" opacity="0.2" />
          {/* Mailbox */}
          <rect x={cx + 0} y={gy - 4} width="1.5" height="4" fill={COLORS.earth} opacity="0.3" />
          <rect x={cx - 1} y={gy - 5} width="3.5" height="2" fill="#3B82F6" opacity="0.3" rx="0.3" />
        </g>
      );
    case 'SUBURBS_S':
      return (
        <g>
          {/* 4 houses, different layout */}
          {pointedBox(cx - 30, gy, 12, 12, f, s, COLORS.roofSlate, 'ss0')}
          {pointedBox(cx - 14, gy, 14, 14, f, s, g[1], 'ss1')}
          {pointedBox(cx + 4, gy, 13, 13, f, s, COLORS.roofTerracotta, 'ss2')}
          {isoBox(cx + 22, gy, 16, 14, f, s, t, 'ss3')}
          {/* Swimming pool behind one house */}
          <rect x={cx - 28} y={gy + 3} width={8} height={5} fill={COLORS.water} opacity="0.15" rx="1" />
          <rect x={cx - 27} y={gy + 4} width={6} height={3} fill={COLORS.waterShallow} opacity="0.08" rx="0.5" />
          {/* Trampoline */}
          <circle cx={cx + 8} cy={gy + 6} r="3" fill="none" stroke={COLORS.earth} strokeWidth="0.5" opacity="0.12" />
          <circle cx={cx + 8} cy={gy + 6} r="2.5" fill="#374151" opacity="0.04" />
          {/* BBQ grill with smoke wisps */}
          <rect x={cx + 34} y={gy - 3} width={3} height={3} fill="#4B5563" opacity="0.15" rx="0.3" />
          <ellipse cx={cx + 35.5} cy={gy - 5} rx="1.5" ry="0.8" fill="#9CA3AF" opacity="0.05">
            <animate attributeName="cy" values={`${gy-5};${gy-9};${gy-5}`} dur="6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.05;0.01;0.05" dur="6s" repeatCount="indefinite" />
          </ellipse>
          {/* Stepping stones path */}
          {[0, 1, 2, 3, 4, 5].map((si) => (
            <circle key={`step-${si}`} cx={cx - 14 + si * 5} cy={gy + 2 + Math.sin(si) * 1} r="1" fill={COLORS.sand} opacity="0.10" />
          ))}
          {/* Bush */}
          <circle cx={cx - 38} cy={gy - 3} r="4" fill={COLORS.grass} opacity="0.3" />
          <circle cx={cx - 34} cy={gy - 2} r="3" fill={COLORS.grassLight} opacity="0.2" />
          {/* Playground equipment */}
          <rect x={cx + 40} y={gy - 8} width="1" height="8" fill={COLORS.earth} opacity="0.25" />
          <line x1={cx + 36} y1={gy - 3} x2={cx + 44} y2={gy - 3} stroke={COLORS.earth} strokeWidth="0.5" opacity="0.2" />
          {/* Path */}
          <rect x={cx - 14} y={gy} width={14} height={1.5} fill={COLORS.sand} opacity="0.15" rx="0.3" />
        </g>
      );
    case 'OUTSKIRTS':
      return (
        <g>
          {pointedBox(cx - 26, gy, 14, 14, f, s, g[1], 'out1')}
          {flatBox(cx - 6, gy, 12, 10, f, s, t, 'out2')}
          {/* Windmill with animated blades */}
          <rect x={cx + 20} y={gy - 28} width="3" height="28" fill={g[0]} opacity="0.7" />
          <circle cx={cx + 21.5} cy={gy - 28} r="1.5" fill={g[1]} opacity="0.6" />
          <g>
            <line x1={cx + 21.5} y1={gy - 28} x2={cx + 21.5} y2={gy - 40} stroke={g[0]} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
            <line x1={cx + 21.5} y1={gy - 28} x2={cx + 32} y2={gy - 24} stroke={g[0]} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
            <line x1={cx + 21.5} y1={gy - 28} x2={cx + 11} y2={gy - 24} stroke={g[0]} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
            <line x1={cx + 21.5} y1={gy - 28} x2={cx + 21.5} y2={gy - 16} stroke={g[0]} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
            <animateTransform attributeName="transform" type="rotate" from={`0 ${cx+21.5} ${gy-28}`} to={`360 ${cx+21.5} ${gy-28}`} dur="20s" repeatCount="indefinite" />
          </g>
          {/* Silo */}
          <rect x={cx + 28} y={gy - 20} width={6} height={20} fill={s} opacity="0.4" rx="0.5" />
          <ellipse cx={cx + 31} cy={gy - 20} rx="3.5" ry="1.5" fill={t} opacity="0.35" />
          {/* Crop fields — parallel lines */}
          <g>
            {Array.from({ length: 6 }, (_, i) => (
              <line key={`crop-${i}`}
                x1={cx - 44} y1={gy + 4 + i * 3}
                x2={cx - 10} y2={gy + 4 + i * 3}
                stroke={COLORS.grass} strokeWidth="0.5" opacity="0.08" />
            ))}
          </g>
          {/* Scarecrow */}
          <line x1={cx - 36} y1={gy + 2} x2={cx - 36} y2={gy - 6} stroke={COLORS.earth} strokeWidth="0.6" opacity="0.15" />
          <line x1={cx - 39} y1={gy - 4} x2={cx - 33} y2={gy - 4} stroke={COLORS.earth} strokeWidth="0.6" opacity="0.15" />
          <circle cx={cx - 36} cy={gy - 7} r="1.5" fill={COLORS.sandDark} opacity="0.12" />
          {/* Pond with reeds */}
          <ellipse cx={cx + 40} cy={gy + 8} rx="6" ry="4" fill={COLORS.water} opacity="0.12" />
          <ellipse cx={cx + 40} cy={gy + 8} rx="4" ry="2.5" fill={COLORS.waterShallow} opacity="0.06" />
          <line x1={cx + 45} y1={gy + 6} x2={cx + 45} y2={gy + 2} stroke={COLORS.grass} strokeWidth="0.5" opacity="0.12" />
          <line x1={cx + 47} y1={gy + 7} x2={cx + 47} y2={gy + 3} stroke={COLORS.grass} strokeWidth="0.5" opacity="0.12" />
          {/* Tractor */}
          <rect x={cx + 6} y={gy - 3} width={5} height={3} fill="#22C55E" opacity="0.15" rx="0.3" />
          <circle cx={cx + 7} cy={gy} r="1" fill="#374151" opacity="0.12" />
          <circle cx={cx + 10} cy={gy} r="1.3" fill="#374151" opacity="0.12" />
          {/* Hay bale */}
          <ellipse cx={cx - 38} cy={gy - 2} rx="4" ry="3" fill={COLORS.sand} opacity="0.3" />
          {/* Fence */}
          <rect x={cx - 44} y={gy - 4} width="1" height="4" fill={COLORS.earth} opacity="0.2" />
          <rect x={cx - 37} y={gy - 4} width="1" height="4" fill={COLORS.earth} opacity="0.2" />
          <line x1={cx - 44} y1={gy - 2} x2={cx - 37} y2={gy - 2} stroke={COLORS.earth} strokeWidth="0.5" opacity="0.2" />
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

/** Per-district pattern overrides (code → fill) */
const DISTRICT_PATTERN_OVERRIDE: Record<string, string> = {
  OLD_TOWN: 'url(#v3-cobblestone)',
  TECH_PARK: 'url(#v3-tech-grid)',
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
  // Additional background mountains (use v3-mist via index > 4)
  { x: 50,  w: 100, h: 60, opacity: 0.06, snow: false },
  { x: 560, w: 85,  h: 50, opacity: 0.07, snow: true },
  { x: 900, w: 95,  h: 55, opacity: 0.05, snow: false },
];

// ── Scattered tree positions (between districts) ──

type ForestItem = {
  x: number; y: number; r: number; shade: string;
  kind: 'deciduous' | 'conifer' | 'bush';
};

function generateForestTrees(seed: number): ForestItem[] {
  const rng = seededRandom(seed);
  const trees: ForestItem[] = [];
  // Regions where trees grow (gaps between districts) — 16 total
  const regions: [number, number, number, number][] = [
    [240, 260, 360, 340],    // Between University and Old Town
    [260, 140, 360, 200],    // North of Suburbs N
    [440, 250, 500, 340],    // Between Old Town and CBD
    [640, 420, 700, 500],    // Between CBD and Industrial
    [200, 440, 260, 560],    // West side gaps
    [320, 540, 400, 610],    // Between Market Sq and Suburbs S
    [600, 250, 640, 310],    // Between Tech Park and CBD
    [120, 620, 200, 680],    // SW corner
    // ── Additional gap regions ──
    [140, 200, 200, 260],    // NW corner
    [400, 100, 470, 160],    // N of Old Town
    [660, 200, 720, 270],    // NE between Tech Park and Marina
    [500, 380, 560, 440],    // Central gap south of CBD
    [340, 430, 400, 490],    // Between Market Sq and University
    [700, 560, 760, 620],    // Eastern industrial fringe
    [220, 680, 280, 740],    // S of Outskirts
    [460, 570, 540, 630],    // SE gap below CBD
  ];
  for (const [x1, y1, x2, y2] of regions) {
    const count = 6 + Math.floor(rng() * 7); // 6-12 per region
    for (let i = 0; i < count; i++) {
      const x = x1 + rng() * (x2 - x1);
      const y = y1 + rng() * (y2 - y1);
      const r = 4 + rng() * 6;
      const shade = rng() > 0.5 ? COLORS.grass : COLORS.grassLight;
      // 60% deciduous, 30% conifer, 10% bush
      const roll = rng();
      const kind: ForestItem['kind'] = roll < 0.6 ? 'deciduous' : roll < 0.9 ? 'conifer' : 'bush';
      trees.push({ x, y, r, shade, kind });
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
          {/* ══════════════════════════════════════
              FILTERS
              ══════════════════════════════════════ */}

          {/* Compound building shadow: soft ambient + hard contact */}
          <filter id="v3-building-shadow" x="-10%" y="-10%" width="130%" height="140%">
            {/* Soft ambient shadow */}
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="softBlur" />
            <feOffset in="softBlur" dx="2" dy="4" result="softOff" />
            <feFlood floodColor={COLORS.buildingShadow} floodOpacity="0.14" result="softColor" />
            <feComposite in="softColor" in2="softOff" operator="in" result="softShadow" />
            {/* Hard contact shadow */}
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" result="hardBlur" />
            <feOffset in="hardBlur" dx="0.5" dy="1" result="hardOff" />
            <feFlood floodColor={COLORS.buildingShadow} floodOpacity="0.22" result="hardColor" />
            <feComposite in="hardColor" in2="hardOff" operator="in" result="hardShadow" />
            <feMerge>
              <feMergeNode in="softShadow" />
              <feMergeNode in="hardShadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
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

          {/* Warm fog — broader, tinted */}
          <filter id="v3-fog" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="40" result="blurred" />
            <feFlood floodColor={COLORS.fogWarm} floodOpacity="0.06" result="warmTint" />
            <feBlend in="blurred" in2="warmTint" mode="screen" />
          </filter>
          <filter id="v3-fog-warm" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="40" result="blurred" />
            <feFlood floodColor={COLORS.fogWarm} floodOpacity="0.08" result="warmTint" />
            <feBlend in="blurred" in2="warmTint" mode="screen" />
          </filter>
          <filter id="v3-fog-cool" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="25" result="blurred" />
            <feFlood floodColor={COLORS.fogCool} floodOpacity="0.06" result="coolTint" />
            <feBlend in="blurred" in2="coolTint" mode="screen" />
          </filter>

          {/* Coast shadow with inner glow via erode */}
          <filter id="v3-coast-shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="shadow" />
            <feFlood floodColor={COLORS.earth} floodOpacity="0.12" result="color" />
            <feComposite in="color" in2="shadow" operator="in" result="darkShadow" />
            {/* Inner glow */}
            <feMorphology in="SourceAlpha" operator="erode" radius="2" result="eroded" />
            <feGaussianBlur in="eroded" stdDeviation="3" result="innerBlur" />
            <feFlood floodColor={COLORS.fogWarm} floodOpacity="0.08" result="innerColor" />
            <feComposite in="innerColor" in2="innerBlur" operator="in" result="innerGlow" />
            <feMerge>
              <feMergeNode in="darkShadow" />
              <feMergeNode in="innerGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Terrain noise — larger grain, warm tint overlay */}
          <filter id="v3-terrain-noise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="5" seed="42" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="mono" />
            <feComponentTransfer in="mono" result="faint">
              <feFuncA type="linear" slope="0.04" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="faint" mode="overlay" result="grained" />
            {/* Subtle warm tint overlay */}
            <feFlood floodColor={COLORS.fogWarm} floodOpacity="0.02" result="warmOverlay" />
            <feBlend in="grained" in2="warmOverlay" mode="screen" />
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

          {/* ── New Filters ── */}

          {/* Ambient occlusion — darken where buildings meet ground */}
          <filter id="v3-ambient-occlusion" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="aoBlur" />
            <feColorMatrix in="aoBlur" type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0" result="aoDark" />
            <feMerge>
              <feMergeNode in="aoDark" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Warm glow for lanterns & windows */}
          <filter id="v3-glow-warm" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="warmBlur" />
            <feFlood floodColor={COLORS.glowWarm} floodOpacity="0.35" result="warmFlood" />
            <feComposite in="warmFlood" in2="warmBlur" operator="in" result="warmGlow" />
            <feMerge>
              <feMergeNode in="warmGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Cool glow for tech / neon */}
          <filter id="v3-glow-cool" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="coolBlur" />
            <feFlood floodColor={COLORS.glowCool} floodOpacity="0.35" result="coolFlood" />
            <feComposite in="coolFlood" in2="coolBlur" operator="in" result="coolGlow" />
            <feMerge>
              <feMergeNode in="coolGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Atmospheric mist — very large blur, low opacity */}
          <filter id="v3-mist" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="50" result="mistBlur" />
            <feComponentTransfer in="mistBlur">
              <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
          </filter>

          {/* Golden hour — shift warm, slight contrast boost */}
          <filter id="v3-golden-hour" x="0%" y="0%" width="100%" height="100%">
            <feColorMatrix type="matrix"
              values="1.05 0.05 0    0 0.02
                      0    1.02 0    0 0.01
                      0    0    0.95 0 0
                      0    0    0    1 0" />
          </filter>

          {/* ══════════════════════════════════════
              PER-DISTRICT GRADIENTS + CLIPS
              ══════════════════════════════════════ */}

          {/* 3-stop radial: bright center → mid ring → darker edge */}
          {DISTRICTS_GEO.map((d) => (
            <radialGradient key={`grad-${d.code}`} id={`v3-grad-${d.code}`} cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor={d.gradient[0]} stopOpacity="0.7" />
              <stop offset="55%" stopColor={d.gradient[1]} stopOpacity="0.6" />
              <stop offset="100%" stopColor={d.gradient[1]} stopOpacity="0.45" />
            </radialGradient>
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

          {/* ══════════════════════════════════════
              GRADIENTS
              ══════════════════════════════════════ */}

          {/* 5-stop sky — horizon warm band + blue-pink at top */}
          <linearGradient id="v3-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.sky} stopOpacity="0.45" />
            <stop offset="15%" stopColor="#C4A8D0" stopOpacity="0.12" />
            <stop offset="40%" stopColor={COLORS.skyWarm} stopOpacity="0.18" />
            <stop offset="60%" stopColor={COLORS.fogWarm} stopOpacity="0.10" />
            <stop offset="100%" stopColor="#F5F0E8" stopOpacity="0.04" />
          </linearGradient>

          {/* 4-stop bg radial — warm center hotspot, cooler edges */}
          <radialGradient id="v3-bg-radial" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor="hsl(42 30% 95%)" />
            <stop offset="30%" stopColor="hsl(40 25% 93%)" />
            <stop offset="65%" stopColor="hsl(38 20% 90%)" />
            <stop offset="100%" stopColor="hsl(215 12% 87%)" />
          </radialGradient>

          {/* 5-stop sea: shallow reef → mid water → deep → abyssal */}
          <linearGradient id="v3-sea-deep" x1="0.7" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={COLORS.waterShallow} stopOpacity="0.2" />
            <stop offset="20%" stopColor="#55B8A0" stopOpacity="0.28" />
            <stop offset="45%" stopColor={COLORS.water} stopOpacity="0.4" />
            <stop offset="75%" stopColor={COLORS.waterDeep} stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0D3B5E" stopOpacity="0.35" />
          </linearGradient>

          {/* Beach with foam-white edge */}
          <linearGradient id="v3-beach" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={COLORS.sand} stopOpacity="0" />
            <stop offset="30%" stopColor={COLORS.sand} stopOpacity="0.22" />
            <stop offset="70%" stopColor={COLORS.sandDark} stopOpacity="0.35" />
            <stop offset="92%" stopColor="#F5F0E8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="white" stopOpacity="0.15" />
          </linearGradient>

          {/* ── Park gradient ── */}
          <radialGradient id="v3-park-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={COLORS.grass} stopOpacity="0.3" />
            <stop offset="70%" stopColor={COLORS.grass} stopOpacity="0.15" />
            <stop offset="100%" stopColor={COLORS.grass} stopOpacity="0.03" />
          </radialGradient>

          {/* ── Glass overlay ── */}
          <linearGradient id="v3-glass" x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.12" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.06" />
          </linearGradient>

          {/* ── New Gradients ── */}

          {/* Sunset overlay — diagonal warm wash */}
          <linearGradient id="v3-sunset-overlay" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FF8C60" stopOpacity="0.03" />
            <stop offset="40%" stopColor="#FFB088" stopOpacity="0.015" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>

          {/* Depth gradient — atmospheric perspective */}
          <linearGradient id="v3-depth-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.fogWarm} stopOpacity="0" />
            <stop offset="60%" stopColor={COLORS.fogWarm} stopOpacity="0.03" />
            <stop offset="100%" stopColor={COLORS.fogWarm} stopOpacity="0.08" />
          </linearGradient>

          {/* ══════════════════════════════════════
              PATTERNS
              ══════════════════════════════════════ */}

          <pattern id="v3-grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke={COLORS.earthLight} strokeWidth="0.3" opacity="0.12" />
          </pattern>

          <pattern id="v3-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#78716C" strokeWidth="0.5" opacity="0.12" />
          </pattern>

          <pattern id="v3-march" width="12" height="1" patternUnits="userSpaceOnUse">
            <rect width="6" height="1" fill={COLORS.gold} />
            <rect x="6" width="6" height="1" fill="transparent" />
          </pattern>

          {/* ── Terrain texture patterns (upgraded) ── */}

          {/* Urban — grid + tiny windows + AC units */}
          <pattern id="v3-tex-urban" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill="none" />
            <path d="M0,8 L16,8 M8,0 L8,16" stroke="#9CA3AF" strokeWidth="0.3" opacity="0.12" />
            <circle cx="4" cy="4" r="0.6" fill="#78716C" opacity="0.10" />
            <circle cx="12" cy="12" r="0.6" fill="#78716C" opacity="0.10" />
            {/* Tiny windows */}
            <rect x="2" y="10" width="1.5" height="1.8" fill="#9CA3AF" opacity="0.08" rx="0.15" />
            <rect x="4.5" y="10" width="1.5" height="1.8" fill="#9CA3AF" opacity="0.06" rx="0.15" />
            <rect x="10" y="2" width="1.5" height="1.8" fill="#9CA3AF" opacity="0.07" rx="0.15" />
            <rect x="12.5" y="2" width="1.5" height="1.8" fill="#9CA3AF" opacity="0.06" rx="0.15" />
            {/* AC unit shapes */}
            <rect x="10" y="6" width="2" height="1.2" fill="#78716C" opacity="0.06" rx="0.2" />
            <rect x="3" y="14" width="2" height="1.2" fill="#78716C" opacity="0.05" rx="0.2" />
          </pattern>

          {/* Green — grass + tiny flower dots */}
          <pattern id="v3-tex-green" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="none" />
            <circle cx="5" cy="5" r="1" fill={COLORS.grass} opacity="0.18" />
            <circle cx="15" cy="12" r="0.8" fill={COLORS.grass} opacity="0.14" />
            <circle cx="10" cy="18" r="1.2" fill={COLORS.grassLight} opacity="0.12" />
            <circle cx="2" cy="14" r="0.6" fill={COLORS.grassLight} opacity="0.14" />
            <path d="M7,8 L7,5 M8,9 L9,6 M6,9 L5,6.5" stroke={COLORS.grass} strokeWidth="0.4" opacity="0.14" strokeLinecap="round" />
            <path d="M16,16 L16,13 M17,17 L18,14" stroke={COLORS.grassLight} strokeWidth="0.4" opacity="0.12" strokeLinecap="round" />
            {/* Tiny flower dots */}
            <circle cx="3" cy="8" r="0.5" fill={COLORS.neonPink} opacity="0.08" />
            <circle cx="17" cy="4" r="0.4" fill={COLORS.glowWarm} opacity="0.08" />
            <circle cx="12" cy="16" r="0.45" fill={COLORS.marketAwning} opacity="0.06" />
          </pattern>

          {/* Water — 3 wave lines with varying dash patterns */}
          <pattern id="v3-tex-water" width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="none" />
            <path d="M2,6 Q6,4 10,6 Q14,8 18,6" fill="none" stroke={COLORS.water} strokeWidth="0.4" opacity="0.14" />
            <path d="M4,13 Q8,11 12,13 Q16,15 20,13" fill="none" stroke={COLORS.waterDeep} strokeWidth="0.3" opacity="0.12" strokeDasharray="4 2" />
            <path d="M0,20 Q5,18 10,20 Q15,22 20,20 Q23,18 24,20" fill="none" stroke={COLORS.waterShallow} strokeWidth="0.35" opacity="0.10" strokeDasharray="2 3" />
            <circle cx="20" cy="5" r="0.5" fill={COLORS.waterShallow} opacity="0.12" />
            <circle cx="6" cy="20" r="0.3" fill={COLORS.water} opacity="0.08" />
          </pattern>

          <pattern id="v3-tex-industrial" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="none" />
            <path d="M0,0 L12,12 M12,0 L0,12" stroke="#78716C" strokeWidth="0.4" opacity="0.10" />
            <circle cx="6" cy="6" r="0.8" fill="#92400E" opacity="0.08" />
            <circle cx="2" cy="10" r="0.5" fill="#78716C" opacity="0.06" />
            <rect x="8" y="1" width="2" height="1.5" fill="#57534E" opacity="0.08" rx="0.2" />
          </pattern>

          {/* Rural — crop row lines + wheat stalks */}
          <pattern id="v3-tex-rural" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill="none" />
            {/* Crop row lines */}
            <path d="M0,4 L18,4 M0,9 L18,9 M0,14 L18,14" stroke={COLORS.earth} strokeWidth="0.25" opacity="0.10" strokeDasharray="3 2" />
            <circle cx="4" cy="3" r="0.7" fill={COLORS.grass} opacity="0.12" />
            <circle cx="12" cy="9" r="0.5" fill={COLORS.earth} opacity="0.08" />
            <circle cx="8" cy="15" r="0.6" fill={COLORS.grass} opacity="0.10" />
            {/* Wheat stalk shapes */}
            <path d="M14,3 L14,0.5" stroke={COLORS.earth} strokeWidth="0.5" opacity="0.08" strokeLinecap="round" />
            <path d="M13.2,1.8 L14,0.5 L14.8,1.8" stroke={COLORS.sand} strokeWidth="0.3" opacity="0.06" strokeLinecap="round" fill="none" />
            <path d="M16,3.5 L16,1" stroke={COLORS.earth} strokeWidth="0.5" opacity="0.08" strokeLinecap="round" />
            <path d="M15.3,2.2 L16,1 L16.7,2.2" stroke={COLORS.sand} strokeWidth="0.3" opacity="0.06" strokeLinecap="round" fill="none" />
            <path d="M6,14 L6,11.5" stroke={COLORS.earth} strokeWidth="0.4" opacity="0.07" strokeLinecap="round" />
            <path d="M5.4,12.5 L6,11.5 L6.6,12.5" stroke={COLORS.sand} strokeWidth="0.25" opacity="0.05" strokeLinecap="round" fill="none" />
          </pattern>

          {/* ── New Patterns ── */}

          {/* Cobblestone — brick-offset rounded rects for Old Town */}
          <pattern id="v3-cobblestone" width="12" height="10" patternUnits="userSpaceOnUse">
            <rect width="12" height="10" fill="none" />
            {/* Row 1 */}
            <rect x="0.5" y="0.5" width="5" height="4" rx="1" fill={COLORS.earthLight} opacity="0.08" stroke={COLORS.earth} strokeWidth="0.2" strokeOpacity="0.06" />
            <rect x="6.5" y="0.5" width="5" height="4" rx="1" fill={COLORS.earth} opacity="0.06" stroke={COLORS.earth} strokeWidth="0.2" strokeOpacity="0.06" />
            {/* Row 2 — offset */}
            <rect x="-2" y="5.5" width="5" height="4" rx="1" fill={COLORS.earth} opacity="0.07" stroke={COLORS.earth} strokeWidth="0.2" strokeOpacity="0.06" />
            <rect x="3.5" y="5.5" width="5" height="4" rx="1" fill={COLORS.earthLight} opacity="0.06" stroke={COLORS.earth} strokeWidth="0.2" strokeOpacity="0.06" />
            <rect x="9" y="5.5" width="5" height="4" rx="1" fill={COLORS.earth} opacity="0.08" stroke={COLORS.earth} strokeWidth="0.2" strokeOpacity="0.06" />
          </pattern>

          {/* Tech grid — circuit-board lines for Tech Park */}
          <pattern id="v3-tech-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="none" />
            {/* Vertical + horizontal traces */}
            <path d="M5,0 L5,8 L12,8 L12,20" stroke={COLORS.neonBlue} strokeWidth="0.3" opacity="0.10" fill="none" />
            <path d="M0,15 L8,15 L8,5 L20,5" stroke={COLORS.neonBlue} strokeWidth="0.25" opacity="0.08" fill="none" />
            {/* Nodes */}
            <circle cx="5" cy="8" r="0.8" fill={COLORS.neonBlue} opacity="0.10" />
            <circle cx="12" cy="8" r="0.6" fill={COLORS.glowCool} opacity="0.08" />
            <circle cx="8" cy="15" r="0.6" fill={COLORS.neonBlue} opacity="0.08" />
            <circle cx="8" cy="5" r="0.5" fill={COLORS.glowCool} opacity="0.06" />
            {/* Chip pad */}
            <rect x="14" y="13" width="3" height="3" fill="none" stroke={COLORS.neonBlue} strokeWidth="0.25" opacity="0.08" rx="0.3" />
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

          {/* ══════════════════════════════════════
              SYMBOLS
              ══════════════════════════════════════ */}

          {/* Tree — trunk detail, leaf highlight, shadow at base */}
          <symbol id="v3-tree" viewBox="0 0 20 24">
            {/* Shadow at base */}
            <ellipse cx="10" cy="23" rx="6" ry="1.5" fill={COLORS.buildingShadow} opacity="0.10" />
            {/* Trunk with darker stripe */}
            <rect x="9" y="16" width="2" height="8" fill={COLORS.earth} opacity="0.5" rx="0.3" />
            <rect x="9.6" y="16" width="0.8" height="8" fill={COLORS.buildingShadow} opacity="0.12" rx="0.2" />
            {/* Main canopy */}
            <circle cx="10" cy="10" r="8" fill={COLORS.grass} opacity="0.6" />
            {/* Leaf highlight — offset lighter circle */}
            <circle cx="7" cy="7" r="5" fill={COLORS.grassLight} opacity="0.4" />
            <circle cx="6" cy="6" r="2.5" fill={COLORS.grassLight} opacity="0.18" />
          </symbol>

          {/* Mountain — second ridge, rocky texture, treeline */}
          <symbol id="v3-mountain" viewBox="0 0 100 70">
            {/* Main peak */}
            <polygon points="0,70 50,0 100,70" fill={COLORS.mountain} opacity="0.8" />
            {/* Second ridge at 40% height */}
            <polygon points="10,70 38,28 66,70" fill={COLORS.mountain} opacity="0.55" />
            {/* Snow cap */}
            <polygon points="35,25 50,0 65,25" fill={COLORS.mountainSnow} opacity="0.5" />
            {/* Rocky texture lines on face */}
            <path d="M30,50 L38,38 M55,45 L48,35 M70,55 L62,42" stroke={COLORS.earth} strokeWidth="0.8" opacity="0.12" fill="none" strokeLinecap="round" />
            <path d="M22,60 L28,52 M75,58 L68,50" stroke={COLORS.earth} strokeWidth="0.6" opacity="0.08" fill="none" strokeLinecap="round" />
            {/* Treeline at base */}
            <circle cx="15" cy="66" r="4" fill={COLORS.grass} opacity="0.25" />
            <circle cx="25" cy="65" r="3.5" fill={COLORS.grassLight} opacity="0.20" />
            <circle cx="80" cy="66" r="4" fill={COLORS.grass} opacity="0.22" />
            <circle cx="70" cy="67" r="3" fill={COLORS.grassLight} opacity="0.18" />
          </symbol>

          {/* Cloud — fluffier with gray underside */}
          <symbol id="v3-cloud" viewBox="0 0 60 30">
            {/* Underside shadow */}
            <ellipse cx="28" cy="23" rx="22" ry="6" fill="#B0B8C4" opacity="0.12" />
            {/* Main body */}
            <ellipse cx="20" cy="18" rx="18" ry="10" fill="white" opacity="0.5" />
            <ellipse cx="35" cy="14" rx="14" ry="12" fill="white" opacity="0.4" />
            <ellipse cx="45" cy="18" rx="12" ry="8" fill="white" opacity="0.35" />
            {/* Extra puffs for fluffy shape */}
            <ellipse cx="12" cy="16" rx="10" ry="7" fill="white" opacity="0.3" />
            <ellipse cx="50" cy="16" rx="8" ry="6" fill="white" opacity="0.25" />
          </symbol>

          {/* ── New Symbols ── */}

          {/* Pine tree — conifer for mountain regions */}
          <symbol id="v3-pine-tree" viewBox="0 0 16 24">
            <ellipse cx="8" cy="23" rx="4" ry="1" fill={COLORS.buildingShadow} opacity="0.08" />
            <rect x="7" y="18" width="2" height="6" fill={COLORS.earth} opacity="0.45" rx="0.3" />
            <polygon points="8,2 14,14 2,14" fill={COLORS.grass} opacity="0.55" />
            <polygon points="8,6 12,16 4,16" fill={COLORS.grass} opacity="0.45" />
            <polygon points="8,10 11,18 5,18" fill={COLORS.grassLight} opacity="0.35" />
          </symbol>

          {/* Bush — small rounded cluster */}
          <symbol id="v3-bush" viewBox="0 0 12 8">
            <ellipse cx="6" cy="7" rx="5" ry="1" fill={COLORS.buildingShadow} opacity="0.06" />
            <ellipse cx="4" cy="5" rx="4" ry="3.5" fill={COLORS.grass} opacity="0.40" />
            <ellipse cx="8" cy="5" rx="3.5" ry="3" fill={COLORS.grassLight} opacity="0.35" />
            <ellipse cx="6" cy="4" rx="3" ry="2.5" fill={COLORS.grassLight} opacity="0.20" />
          </symbol>

          {/* Rock — irregular polygon with shading */}
          <symbol id="v3-rock" viewBox="0 0 14 10">
            <polygon points="2,10 0,5 3,1 9,0 13,3 14,8 10,10" fill={COLORS.earthLight} opacity="0.45" />
            <polygon points="3,1 9,0 13,3 8,4 4,3" fill={COLORS.mountainSnow} opacity="0.15" />
            <path d="M4,3 L8,4 L10,10" stroke={COLORS.earth} strokeWidth="0.4" opacity="0.10" fill="none" />
          </symbol>

          {/* Sailboat — simple boat silhouette for marina */}
          <symbol id="v3-sailboat" viewBox="0 0 16 18">
            {/* Hull */}
            <path d="M2,14 Q8,18 14,14 L12,14 L4,14 Z" fill={COLORS.earth} opacity="0.35" />
            {/* Mast */}
            <rect x="7.5" y="3" width="0.8" height="12" fill={COLORS.earth} opacity="0.4" />
            {/* Sail */}
            <polygon points="8,3 14,10 8,12" fill="white" opacity="0.5" />
            <polygon points="8,4 3,9 8,11" fill="white" opacity="0.35" />
          </symbol>

          {/* Seagull — tiny V-shape bird */}
          <symbol id="v3-seagull" viewBox="0 0 12 6">
            <path d="M0,4 Q3,0 6,3 Q9,0 12,4" fill="none" stroke="#555" strokeWidth="0.8" opacity="0.25" strokeLinecap="round" />
          </symbol>
        </defs>

        {/* ── Pan/Zoom root ── */}
        <g id="pan-zoom-root" transform={transform} style={{ transformOrigin: '0 0', transition: isDragging ? 'none' : 'transform 120ms ease-out' }}>

          {/* ═══ LAYER 1: Sky & Terrain Base ═══ */}
          <g id="layer-sky-terrain" style={{ pointerEvents: 'none' }}>
            {/* 5-stop sky gradient */}
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#v3-sky)" />
            {/* Sunset overlay wash */}
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#v3-sunset-overlay)" />
            {/* Base land with golden-hour filter */}
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#v3-bg-radial)" filter="url(#v3-golden-hour)" />
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#v3-bg-radial)" filter="url(#v3-terrain-noise)" />
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#v3-grid)" />

            {/* Dappled sunlight pools */}
            <ellipse cx="350" cy="320" rx="120" ry="90" fill={COLORS.glowWarm} opacity="0.06" />
            <ellipse cx="580" cy="500" rx="100" ry="75" fill={COLORS.glowWarm} opacity="0.05" />
            <ellipse cx="200" cy="600" rx="80" ry="60" fill={COLORS.gold} opacity="0.04" />

            {/* Atmospheric perspective depth */}
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#v3-depth-gradient)" />

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
            {/* Ocean shimmer — slow translating light streaks */}
            <g opacity="0.03">
              {[0, 1, 2, 3, 4].map((i) => (
                <line key={`shimmer-${i}`}
                  x1={920 + i * 50} y1={60 + i * 170}
                  x2={960 + i * 50} y2={80 + i * 170}
                  stroke="white" strokeWidth="0.8"
                >
                  <animateTransform attributeName="transform" type="translate" from="0,0" to="40,0" dur="20s" repeatCount="indefinite" />
                </line>
              ))}
            </g>

            {/* ── Beach/sand strip ── */}
            <path
              d="M830,0 Q840,80 860,160 Q880,250 900,340 Q920,440 910,540 Q900,650 890,750 Q880,830 870,900 L850,900 Q860,830 870,750 Q880,650 890,540 Q900,440 890,340 Q870,250 860,160 Q850,80 840,0 Z"
              fill="url(#v3-beach)"
            />
            {/* Shell/pebble scatter — 35 tiny circles */}
            {(() => {
              const rng = seededRandom(7771);
              const coastX = (t: number) => 840 + Math.sin(t * 0.8) * 30 + t * 2;
              return Array.from({ length: 35 }, (_, i) => {
                const t = rng() * 900;
                const cx = coastX(t / 90) + (rng() - 0.5) * 16;
                const cy = t;
                const r = 0.5 + rng() * 1;
                const shade = rng() > 0.5 ? COLORS.sandDark : COLORS.earthLight;
                return <circle key={`shell-${i}`} cx={cx} cy={cy} r={r} fill={shade} opacity={0.10 + rng() * 0.08} />;
              });
            })()}

            {/* ── Coastline edge ── */}
            <path
              d="M850,0 Q860,100 880,180 Q900,250 920,380 Q940,480 920,600 Q900,750 850,900"
              fill="none" stroke="#000" strokeWidth="3" opacity="0.15"
              filter="url(#v3-coast-shadow)"
            />
            {/* Inner foam line */}
            <path
              d="M846,0 Q856,98 876,178 Q896,248 916,377 Q936,477 916,597 Q896,747 846,897"
              fill="none" stroke="white" strokeWidth="0.8" opacity="0.12"
              strokeDasharray="3 4"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="14" dur="4s" repeatCount="indefinite" />
            </path>
            {/* Coastal rocks */}
            {[
              [854, 90], [872, 195], [894, 290], [908, 370], [918, 450],
              [916, 550], [904, 640], [892, 720], [882, 790], [870, 860],
            ].map(([rx, ry], i) => (
              <use key={`rock-${i}`} href="#v3-rock" x={rx - 5} y={ry - 3} width={10 + (i % 3) * 2} height={7 + (i % 2) * 2} opacity={0.3 + (i % 4) * 0.05} />
            ))}

            {/* ── River flowing through city ── */}
            {/* Wide base */}
            <path
              d="M860,490 Q820,520 780,540 Q720,570 660,585 Q600,600 540,610 Q480,620 420,640"
              fill="none" stroke={COLORS.water} strokeWidth="12" opacity="0.18"
              strokeLinecap="round"
            />
            {/* Mid band */}
            <path
              d="M860,490 Q820,520 780,540 Q720,570 660,585 Q600,600 540,610 Q480,620 420,640"
              fill="none" stroke={COLORS.waterShallow} strokeWidth="8" opacity="0.12"
              strokeLinecap="round"
            />
            {/* Animated highlight */}
            <path
              d="M860,490 Q820,520 780,540 Q720,570 660,585 Q600,600 540,610 Q480,620 420,640"
              fill="none" stroke={COLORS.waterShallow} strokeWidth="3" opacity="0.14"
              strokeLinecap="round" strokeDasharray="4 8"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="24" dur="6s" repeatCount="indefinite" />
            </path>
            {/* Counter-current texture */}
            <path
              d="M860,490 Q820,520 780,540 Q720,570 660,585 Q600,600 540,610 Q480,620 420,640"
              fill="none" stroke={COLORS.water} strokeWidth="1" opacity="0.08"
              strokeLinecap="round" strokeDasharray="2 6"
            >
              <animate attributeName="stroke-dashoffset" from="16" to="0" dur="8s" repeatCount="indefinite" />
            </path>
            {/* Riverbank bushes */}
            <use href="#v3-bush" x="808" y="530" width="10" height="7" opacity="0.25" />
            <use href="#v3-bush" x="720" y="560" width="9" height="6" opacity="0.22" />
            <use href="#v3-bush" x="620" y="590" width="11" height="7" opacity="0.20" />
            <use href="#v3-bush" x="520" y="605" width="8" height="6" opacity="0.18" />
            <use href="#v3-bush" x="445" y="630" width="10" height="7" opacity="0.22" />

            {/* ── Lake near University ── */}
            {/* Concentric depth rings */}
            <ellipse cx="250" cy="460" rx="40" ry="25" fill={COLORS.water} opacity="0.18" />
            <ellipse cx="250" cy="460" rx="33" ry="20" fill={COLORS.waterShallow} opacity="0.08" />
            <ellipse cx="250" cy="460" rx="22" ry="13" fill={COLORS.water} opacity="0.06" />
            <ellipse cx="250" cy="460" rx="12" ry="7" fill={COLORS.waterDeep} opacity="0.05" />
            {/* Lake ripples */}
            <path
              d="M220,458 Q235,454 250,458 Q265,462 280,458"
              fill="none" stroke={COLORS.waterShallow} strokeWidth="0.5" opacity="0.15"
              strokeDasharray="4 4"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="16" dur="5s" repeatCount="indefinite" />
            </path>
            {/* Sailboats on lake */}
            <use href="#v3-sailboat" x="240" y="448" width="10" height="12" opacity="0.3">
              <animateTransform attributeName="transform" type="translate" from="0,0" to="4,1" dur="12s" repeatCount="indefinite" />
            </use>
            <use href="#v3-sailboat" x="260" y="455" width="8" height="10" opacity="0.22">
              <animateTransform attributeName="transform" type="translate" from="0,0" to="-3,0.5" dur="15s" repeatCount="indefinite" />
            </use>
            {/* Reeds/cattails along east edge */}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <g key={`reed-${i}`}>
                <line x1={280 + i * 3} y1={448 + i * 2} x2={280 + i * 3} y2={441 + i * 2} stroke={COLORS.grass} strokeWidth="0.6" opacity="0.18" strokeLinecap="round" />
                <ellipse cx={280 + i * 3} cy={440 + i * 2} rx="1" ry="1.8" fill={COLORS.earth} opacity="0.12" />
              </g>
            ))}

            {/* ── Park areas (doubled + scatter) ── */}
            {/* Park 1: University area */}
            <ellipse cx="295" cy="370" rx="75" ry="55" fill="url(#v3-park-grad)" />
            <ellipse cx="280" cy="350" rx="30" ry="20" fill={COLORS.grass} opacity="0.18" />
            <ellipse cx="310" cy="395" rx="22" ry="16" fill={COLORS.grass} opacity="0.12" />
            <use href="#v3-tree" x="265" y="340" width="12" height="14" opacity="0.18" />
            <use href="#v3-tree" x="295" y="355" width="10" height="12" opacity="0.15" />
            <use href="#v3-bush" x="275" y="368" width="8" height="5" opacity="0.14" />
            <circle cx="288" cy="360" r="0.8" fill={COLORS.neonPink} opacity="0.15" />
            <circle cx="300" cy="380" r="0.8" fill={COLORS.glowWarm} opacity="0.12" />
            <circle cx="270" cy="375" r="0.7" fill="white" opacity="0.10" />
            <circle cx="310" cy="365" r="0.8" fill={COLORS.neonPink} opacity="0.12" />
            <circle cx="285" cy="385" r="0.6" fill={COLORS.glowWarm} opacity="0.10" />

            {/* Park 2: North */}
            <ellipse cx="385" cy="220" rx="65" ry="45" fill="url(#v3-park-grad)" />
            <ellipse cx="350" cy="200" rx="25" ry="18" fill={COLORS.grass} opacity="0.15" />
            <ellipse cx="420" cy="240" rx="20" ry="15" fill={COLORS.grass} opacity="0.12" />
            <ellipse cx="370" cy="235" rx="18" ry="12" fill={COLORS.grass} opacity="0.10" />
            <use href="#v3-tree" x="345" y="195" width="12" height="14" opacity="0.16" />
            <use href="#v3-bush" x="410" y="230" width="9" height="6" opacity="0.12" />
            <use href="#v3-tree" x="380" y="225" width="10" height="12" opacity="0.14" />
            <circle cx="360" cy="215" r="0.8" fill={COLORS.neonPink} opacity="0.14" />
            <circle cx="400" cy="210" r="0.7" fill={COLORS.glowWarm} opacity="0.12" />
            <circle cx="375" cy="240" r="0.8" fill="white" opacity="0.10" />
            <circle cx="395" cy="230" r="0.6" fill={COLORS.neonPink} opacity="0.10" />
            <circle cx="415" cy="245" r="0.7" fill={COLORS.glowWarm} opacity="0.12" />

            {/* Park 3: South */}
            <ellipse cx="355" cy="635" rx="60" ry="45" fill="url(#v3-park-grad)" />
            <ellipse cx="330" cy="650" rx="22" ry="16" fill={COLORS.grass} opacity="0.14" />
            <ellipse cx="375" cy="625" rx="18" ry="14" fill={COLORS.grass} opacity="0.10" />
            <use href="#v3-tree" x="325" y="640" width="11" height="13" opacity="0.15" />
            <use href="#v3-bush" x="365" y="620" width="8" height="5" opacity="0.12" />
            <circle cx="340" cy="645" r="0.8" fill={COLORS.neonPink} opacity="0.12" />
            <circle cx="360" cy="630" r="0.7" fill="white" opacity="0.10" />
            <circle cx="350" cy="650" r="0.8" fill={COLORS.glowWarm} opacity="0.12" />
            <circle cx="375" cy="640" r="0.6" fill={COLORS.neonPink} opacity="0.10" />
            <circle cx="335" cy="625" r="0.7" fill={COLORS.glowWarm} opacity="0.12" />

            {/* Park 4: West strip */}
            <ellipse cx="180" cy="440" rx="45" ry="90" fill={COLORS.grass} opacity="0.12" />
            <ellipse cx="165" cy="350" rx="25" ry="30" fill={COLORS.grass} opacity="0.10" />
            <ellipse cx="170" cy="550" rx="20" ry="35" fill={COLORS.grass} opacity="0.10" />
            <ellipse cx="190" cy="400" rx="18" ry="25" fill={COLORS.grass} opacity="0.08" />
            <ellipse cx="175" cy="490" rx="15" ry="22" fill={COLORS.grass} opacity="0.08" />
            <use href="#v3-tree" x="170" y="380" width="10" height="12" opacity="0.14" />
            <use href="#v3-tree" x="185" y="450" width="9" height="11" opacity="0.12" />
            <use href="#v3-bush" x="160" y="520" width="8" height="5" opacity="0.12" />
            <circle cx="175" cy="410" r="0.7" fill={COLORS.neonPink} opacity="0.10" />
            <circle cx="185" cy="470" r="0.8" fill="white" opacity="0.10" />
            <circle cx="165" cy="540" r="0.7" fill={COLORS.glowWarm} opacity="0.12" />
            <circle cx="180" cy="380" r="0.6" fill={COLORS.neonPink} opacity="0.12" />
            <circle cx="170" cy="500" r="0.8" fill={COLORS.glowWarm} opacity="0.10" />

            {/* Park 5: Extra NE patch */}
            <ellipse cx="520" cy="180" rx="35" ry="25" fill="url(#v3-park-grad)" />
            <ellipse cx="515" cy="175" rx="15" ry="10" fill={COLORS.grass} opacity="0.10" />
            <use href="#v3-tree" x="510" y="170" width="9" height="11" opacity="0.12" />
            <use href="#v3-bush" x="528" y="185" width="8" height="5" opacity="0.10" />
            <circle cx="520" cy="180" r="0.7" fill={COLORS.neonPink} opacity="0.12" />
            <circle cx="530" cy="175" r="0.6" fill="white" opacity="0.10" />

            {/* Park 6: Extra SE patch */}
            <ellipse cx="470" cy="700" rx="30" ry="22" fill="url(#v3-park-grad)" />
            <ellipse cx="468" cy="698" rx="12" ry="9" fill={COLORS.grass} opacity="0.10" />
            <use href="#v3-tree" x="462" y="690" width="10" height="12" opacity="0.13" />
            <use href="#v3-bush" x="478" y="705" width="8" height="5" opacity="0.10" />
            <circle cx="470" cy="700" r="0.8" fill={COLORS.glowWarm} opacity="0.12" />
            <circle cx="480" cy="695" r="0.7" fill={COLORS.neonPink} opacity="0.10" />

            {/* ── Industrial haze (atmospheric + smoke wisps) ── */}
            <ellipse cx="790" cy="550" rx="80" ry="60" fill="#78716C" opacity="0.10" filter="url(#v3-fog-warm)" />
            <ellipse cx="790" cy="550" rx="80" ry="60" fill="url(#v3-hatch)" />
            <ellipse cx="810" cy="530" rx="50" ry="35" fill="#57534E" opacity="0.06" />
            {/* Drifting smoke wisps */}
            <path d="M770,530 Q780,518 790,522 Q800,526 810,518" fill="none" stroke="#9CA3AF" strokeWidth="1.2" opacity="0.06">
              <animateTransform attributeName="transform" type="translate" from="0,0" to="15,-8" dur="18s" repeatCount="indefinite" />
            </path>
            <path d="M800,545 Q812,535 820,540 Q830,545 840,535" fill="none" stroke="#9CA3AF" strokeWidth="1" opacity="0.04">
              <animateTransform attributeName="transform" type="translate" from="0,0" to="12,-6" dur="22s" repeatCount="indefinite" />
            </path>
            <path d="M780,560 Q790,550 800,555 Q810,560 818,550" fill="none" stroke="#78716C" strokeWidth="0.8" opacity="0.05">
              <animateTransform attributeName="transform" type="translate" from="0,0" to="10,-10" dur="25s" repeatCount="indefinite" />
            </path>
          </g>

          {/* ═══ LAYER 2: Mountains ═══ */}
          <g id="layer-mountains" style={{ pointerEvents: 'none' }}>
            {MOUNTAINS.map((m, i) => {
              const mtnFilter = i > 4 ? 'url(#v3-mist)' : undefined;
              const rng = seededRandom(i * 3141 + 59);
              const pineCount = 3 + Math.floor(rng() * 3);
              return (
                <g key={`mtn-${i}`} opacity={m.opacity} filter={mtnFilter}>
                  <use href="#v3-mountain" x={m.x} y={45 - m.h * 0.6} width={m.w} height={m.h} />
                  {m.snow && (
                    <polygon
                      points={`${m.x + m.w * 0.35},${45 - m.h * 0.6 + m.h * 0.35} ${m.x + m.w * 0.5},${45 - m.h * 0.6} ${m.x + m.w * 0.65},${45 - m.h * 0.6 + m.h * 0.35}`}
                      fill={COLORS.mountainSnow}
                      opacity="0.4"
                    />
                  )}
                  {/* Pine trees at mountain base */}
                  {Array.from({ length: pineCount }, (_, pi) => {
                    const px = m.x + m.w * 0.15 + rng() * m.w * 0.7;
                    const py = 45 - m.h * 0.6 + m.h * 0.75 + rng() * m.h * 0.2;
                    const pw = 6 + rng() * 5;
                    return <use key={`pine-${i}-${pi}`} href="#v3-pine-tree" x={px} y={py} width={pw} height={pw * 1.5} opacity={0.15 + rng() * 0.1} />;
                  })}
                  {/* Snow-melt streams from snowy peaks */}
                  {m.snow && (
                    <>
                      <path
                        d={`M${m.x + m.w * 0.48},${45 - m.h * 0.6 + m.h * 0.25} Q${m.x + m.w * 0.42},${45 - m.h * 0.6 + m.h * 0.5} ${m.x + m.w * 0.38},${45 - m.h * 0.6 + m.h * 0.8}`}
                        fill="none" stroke={COLORS.waterShallow} strokeWidth="0.5" opacity="0.08" strokeLinecap="round"
                      />
                      <path
                        d={`M${m.x + m.w * 0.55},${45 - m.h * 0.6 + m.h * 0.3} Q${m.x + m.w * 0.58},${45 - m.h * 0.6 + m.h * 0.55} ${m.x + m.w * 0.62},${45 - m.h * 0.6 + m.h * 0.85}`}
                        fill="none" stroke={COLORS.waterShallow} strokeWidth="0.4" opacity="0.06" strokeLinecap="round"
                      />
                    </>
                  )}
                </g>
              );
            })}

            {/* Clouds — 6 with varied sizes, staggered durations, shadows */}
            {[
              { x: 80,  y: 18, w: 85, h: 32, o: 0.15, dx: 30,  dur: 60 },
              { x: 300, y: 8,  w: 65, h: 26, o: 0.12, dx: -25, dur: 45 },
              { x: 500, y: 12, w: 75, h: 30, o: 0.14, dx: 20,  dur: 55 },
              { x: 680, y: 22, w: 55, h: 22, o: 0.10, dx: -18, dur: 70 },
              { x: 150, y: 40, w: 50, h: 20, o: 0.08, dx: 22,  dur: 80 },
              { x: 850, y: 15, w: 70, h: 28, o: 0.11, dx: -28, dur: 90 },
            ].map((c, i) => (
              <g key={`cloud-${i}`}>
                {/* Cloud shadow on ground */}
                <ellipse cx={c.x + c.w / 2} cy={c.y + c.h + 5} rx={c.w * 0.4} ry={c.h * 0.15} fill="#888" opacity="0.03">
                  <animateTransform attributeName="transform" type="translate" from="0,0" to={`${c.dx},0`} dur={`${c.dur}s`} repeatCount="indefinite" />
                </ellipse>
                <use href="#v3-cloud" x={c.x} y={c.y} width={c.w} height={c.h} opacity={c.o}>
                  <animateTransform attributeName="transform" type="translate" from="0,0" to={`${c.dx},0`} dur={`${c.dur}s`} repeatCount="indefinite" />
                </use>
              </g>
            ))}

            {/* Seagulls — slow drifting V-shapes */}
            {[
              { x: 200, y: 55, s: 10, dx: 15, dur: 35 },
              { x: 420, y: 35, s: 8,  dx: -10, dur: 40 },
              { x: 650, y: 48, s: 9,  dx: 12, dur: 50 },
              { x: 900, y: 42, s: 7,  dx: -8,  dur: 38 },
              { x: 320, y: 62, s: 6,  dx: 8,   dur: 55 },
              { x: 750, y: 30, s: 8,  dx: -14, dur: 45 },
            ].map((b, i) => (
              <use key={`gull-${i}`} href="#v3-seagull" x={b.x} y={b.y} width={b.s} height={b.s * 0.5} opacity="0.20">
                <animateTransform attributeName="transform" type="translate" from="0,0" to={`${b.dx},${Math.abs(b.dx) * 0.2}`} dur={`${b.dur}s`} repeatCount="indefinite" />
              </use>
            ))}
          </g>

          {/* ═══ LAYER 3: Water Detail ═══ */}
          <g id="layer-water" style={{ pointerEvents: 'none' }}>
            {/* Ocean depth zones — 5 smooth transitions */}
            <path
              d="M850,0 Q860,100 880,180 Q900,250 920,380 Q940,480 920,600 Q900,750 850,900 L890,900 Q920,750 930,600 Q950,480 930,380 Q910,250 900,180 Q880,100 870,0 Z"
              fill={COLORS.waterShallow} opacity="0.06"
            />
            <path
              d="M870,0 Q880,100 900,180 Q910,250 930,380 Q950,480 930,600 Q920,750 890,900 L920,900 Q950,750 960,600 Q980,480 960,380 Q940,250 920,180 Q900,100 890,0 Z"
              fill={COLORS.waterShallow} opacity="0.08"
            />
            <path
              d="M890,0 Q900,100 920,180 Q940,250 960,380 Q980,480 960,600 Q950,750 920,900 L1000,900 Q1020,750 1030,600 Q1040,480 1030,380 Q1010,250 990,180 Q970,100 960,0 Z"
              fill={COLORS.water} opacity="0.06"
            />
            <path
              d="M960,0 Q970,100 990,180 Q1010,250 1030,380 Q1040,480 1030,600 Q1020,750 1000,900 L1100,900 Q1100,750 1110,600 Q1115,480 1100,380 Q1080,250 1060,180 Q1040,100 1030,0 Z"
              fill={COLORS.waterDeep} opacity="0.05"
            />
            <path
              d="M1030,0 L1200,0 L1200,900 L1100,900 Q1100,750 1110,600 Q1115,480 1100,380 Q1080,250 1060,180 Q1040,100 1030,0 Z"
              fill={COLORS.waterDeep} opacity="0.07"
            />

            {/* Animated waves — 12 horizontal + 4 diagonal cross-waves */}
            {[
              { y: 80,  w: 0.6, o: 0.22, dur: 4 },
              { y: 150, w: 0.55, o: 0.20, dur: 4.8 },
              { y: 220, w: 0.5, o: 0.18, dur: 5.5 },
              { y: 300, w: 0.5, o: 0.17, dur: 6 },
              { y: 370, w: 0.5, o: 0.16, dur: 4.6 },
              { y: 440, w: 0.45, o: 0.15, dur: 5.2 },
              { y: 520, w: 0.45, o: 0.14, dur: 5.8 },
              { y: 590, w: 0.4, o: 0.13, dur: 4.3 },
              { y: 660, w: 0.4, o: 0.12, dur: 5 },
              { y: 730, w: 0.4, o: 0.11, dur: 5.5 },
              { y: 800, w: 0.35, o: 0.10, dur: 4.8 },
              { y: 860, w: 0.35, o: 0.09, dur: 5.3 },
            ].map(({ y, w, o, dur }) => (
              <path key={`wave-${y}`}
                d={`M${850 + Math.sin(y * 0.01) * 20},${y} Q${910 + Math.cos(y * 0.02) * 10},${y - 5} ${960 + Math.sin(y * 0.015) * 15},${y} Q${1020 + Math.cos(y * 0.012) * 12},${y + 4} ${1080 + Math.sin(y * 0.018) * 10},${y}`}
                fill="none" stroke={COLORS.water} strokeWidth={w} opacity={o}
                strokeDasharray="8 6"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="28" dur={`${dur}s`} repeatCount="indefinite" />
              </path>
            ))}
            {/* Diagonal cross-waves */}
            {[
              { x1: 870, y1: 100, x2: 1050, y2: 250, dur: 7 },
              { x1: 880, y1: 300, x2: 1100, y2: 480, dur: 8.5 },
              { x1: 860, y1: 500, x2: 1060, y2: 680, dur: 6.5 },
              { x1: 870, y1: 680, x2: 1080, y2: 860, dur: 7.5 },
            ].map((dw, i) => (
              <line key={`xwave-${i}`}
                x1={dw.x1} y1={dw.y1} x2={dw.x2} y2={dw.y2}
                stroke={COLORS.waterShallow} strokeWidth="0.3" opacity="0.06"
                strokeDasharray="6 8"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="28" dur={`${dw.dur}s`} repeatCount="indefinite" />
              </line>
            ))}

            {/* Ocean sailboats — slowly drifting */}
            {[
              { x: 940, y: 200, w: 14, h: 16, o: 0.28, dx: 8, dur: 30 },
              { x: 1020, y: 400, w: 10, h: 12, o: 0.22, dx: -6, dur: 40 },
              { x: 980, y: 620, w: 12, h: 14, o: 0.25, dx: 5,  dur: 35 },
              { x: 1060, y: 150, w: 8,  h: 10, o: 0.18, dx: -4, dur: 45 },
            ].map((sb, i) => (
              <use key={`osail-${i}`} href="#v3-sailboat" x={sb.x} y={sb.y} width={sb.w} height={sb.h} opacity={sb.o}>
                <animateTransform attributeName="transform" type="translate" from="0,0" to={`${sb.dx},${Math.abs(sb.dx) * 0.3}`} dur={`${sb.dur}s`} repeatCount="indefinite" />
              </use>
            ))}

            {/* Shoreline foam */}
            <path
              d="M850,0 Q860,100 880,180 Q900,250 920,380 Q940,480 920,600 Q900,750 850,900"
              fill="none" stroke="#E0F0FF" strokeWidth="1.5" opacity="0.20"
              strokeDasharray="3 6"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="18" dur="3s" repeatCount="indefinite" />
            </path>

            {/* Tidal zone — animated line following coast */}
            <path
              d="M852,0 Q862,102 882,182 Q902,252 922,382 Q942,482 922,602 Q902,752 852,902"
              fill="none" stroke={COLORS.waterShallow} strokeWidth="1" opacity="0.10"
              strokeDasharray="2 5"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="14" dur="4s" repeatCount="indefinite" />
              <animateTransform attributeName="transform" type="translate" values="0,0;0,-2;0,0;0,2;0,0" dur="8s" repeatCount="indefinite" />
            </path>

            {/* Marina piers — 4 piers with moored boats and rope lines */}
            <rect x="870" y="230" width="35" height="3" fill="#64748B" opacity="0.45" rx="0.5" />
            <rect x="875" y="233" width="2" height="12" fill="#64748B" opacity="0.35" rx="0.3" />
            <rect x="885" y="233" width="2" height="12" fill="#64748B" opacity="0.35" rx="0.3" />
            <rect x="895" y="233" width="2" height="12" fill="#64748B" opacity="0.35" rx="0.3" />
            {/* Moored boats pier 1 */}
            <rect x="878" y="238" width="4" height="2" fill={COLORS.earth} opacity="0.18" rx="0.3" />
            <polygon points="882,238 884,237 882,236" fill="white" opacity="0.15" />
            <rect x="888" y="240" width="4" height="2" fill={COLORS.earth} opacity="0.15" rx="0.3" />
            <polygon points="892,240 894,239 892,238" fill="white" opacity="0.12" />
            {/* Rope lines */}
            <path d="M876,236 Q880,238 884,236" fill="none" stroke={COLORS.earth} strokeWidth="0.3" opacity="0.12" />
            <path d="M886,237 Q890,239 894,237" fill="none" stroke={COLORS.earth} strokeWidth="0.3" opacity="0.10" />

            <rect x="865" y="270" width="30" height="3" fill="#64748B" opacity="0.40" rx="0.5" />
            <rect x="870" y="273" width="2" height="10" fill="#64748B" opacity="0.30" rx="0.3" />
            <rect x="880" y="273" width="2" height="10" fill="#64748B" opacity="0.30" rx="0.3" />
            <rect x="890" y="273" width="2" height="10" fill="#64748B" opacity="0.30" rx="0.3" />
            {/* Moored boat pier 2 */}
            <rect x="873" y="278" width="4" height="2" fill={COLORS.earth} opacity="0.15" rx="0.3" />
            <polygon points="877,278 879,277 877,276" fill="white" opacity="0.12" />

            {/* Pier 3 */}
            <rect x="875" y="305" width="28" height="2.5" fill="#64748B" opacity="0.38" rx="0.5" />
            <rect x="878" y="307.5" width="1.5" height="9" fill="#64748B" opacity="0.28" rx="0.3" />
            <rect x="888" y="307.5" width="1.5" height="9" fill="#64748B" opacity="0.28" rx="0.3" />
            <rect x="898" y="307.5" width="1.5" height="9" fill="#64748B" opacity="0.28" rx="0.3" />
            <rect x="881" y="311" width="4" height="2" fill={COLORS.earth} opacity="0.14" rx="0.3" />
            <polygon points="885,311 887,310 885,309" fill="white" opacity="0.10" />

            {/* Pier 4 */}
            <rect x="860" y="340" width="25" height="2.5" fill="#64748B" opacity="0.35" rx="0.5" />
            <rect x="864" y="342.5" width="1.5" height="8" fill="#64748B" opacity="0.25" rx="0.3" />
            <rect x="874" y="342.5" width="1.5" height="8" fill="#64748B" opacity="0.25" rx="0.3" />

            {/* Harbor docks */}
            <rect x="905" y="390" width="40" height="5" fill="#475569" opacity="0.45" rx="0.5" />
            <line x1="910" y1="392" x2="940" y2="392" stroke="#94A3B8" strokeWidth="0.8" opacity="0.25" />
            <rect x="910" y="430" width="35" height="4" fill="#475569" opacity="0.40" rx="0.5" />
            <path d="M895,460 Q920,465 945,458" fill="none" stroke="#475569" strokeWidth="3" opacity="0.25" strokeLinecap="round" />

            {/* Cargo ship silhouette */}
            <rect x="920" y="398" width="22" height="6" fill="#374151" opacity="0.20" rx="0.5" />
            <rect x="935" y="393" width="5" height="5" fill="#374151" opacity="0.18" rx="0.3" />
            {/* Loading crane shadow */}
            <line x1="932" y1="390" x2="932" y2="378" stroke="#475569" strokeWidth="1" opacity="0.12" />
            <line x1="928" y1="378" x2="940" y2="378" stroke="#475569" strokeWidth="0.8" opacity="0.10" />
            <line x1="938" y1="378" x2="938" y2="385" stroke="#475569" strokeWidth="0.4" opacity="0.08" />
            {/* Oil slick — iridescent ellipse */}
            <ellipse cx="930" cy="445" rx="8" ry="4" fill="url(#v3-glass)" opacity="0.15">
              <animate attributeName="rx" values="8;9;8" dur="6s" repeatCount="indefinite" />
            </ellipse>

            {/* Foam dots — 30+ with pulsing animation on some */}
            {(() => {
              const rng = seededRandom(4242);
              return Array.from({ length: 32 }, (_, i) => {
                const t = rng() * 900;
                const fx = 852 + rng() * 60 + Math.sin(t * 0.01) * 10;
                const fy = t;
                const fr = 0.8 + rng() * 1.2;
                const pulse = i % 4 === 0;
                const pDur = 3 + rng() * 2;
                return (
                  <circle key={`foam-${i}`} cx={fx} cy={fy} r={fr} fill="#E0F0FF" opacity={0.12 + rng() * 0.12}>
                    {pulse && (
                      <animate attributeName="opacity" values="0.10;0.25;0.10" dur={`${pDur}s`} repeatCount="indefinite" />
                    )}
                  </circle>
                );
              });
            })()}

            {/* Shore contour lines — 3 at different offsets */}
            <path
              d="M845,0 Q855,95 875,175 Q895,245 915,375 Q935,475 915,595 Q895,745 845,895"
              fill="none" stroke="#8BB8D6" strokeWidth="0.5" opacity="0.12" strokeDasharray="6 4"
            />
            <path
              d="M840,0 Q850,90 870,170 Q890,240 910,370 Q930,470 910,590 Q890,740 840,890"
              fill="none" stroke="#7AAAC4" strokeWidth="0.4" opacity="0.08" strokeDasharray="4 6"
            />
            <path
              d="M836,0 Q846,86 866,166 Q886,236 906,366 Q926,466 906,586 Q886,736 836,886"
              fill="none" stroke="#6E9EB8" strokeWidth="0.3" opacity="0.06" strokeDasharray="3 5"
            />
          </g>

          {/* ═══ LAYER 4: District Terrain Textures ═══ */}
          <g id="layer-district-textures" style={{ pointerEvents: 'none' }}>
            {DISTRICTS_GEO.map((d) => {
              const patternFill = DISTRICT_PATTERN_OVERRIDE[d.code] ?? TERRAIN_PATTERN[d.terrain];
              if (!patternFill) return null;
              const pts = polygonToPoints(d.polygon);
              // Compute polygon centroid for radial highlight
              const cx = d.center[0];
              const cy = d.center[1];
              return (
                <g key={`tex-${d.code}`}>
                  {/* Terrain texture fill */}
                  <polygon points={pts} fill={patternFill} opacity="1" />
                  {/* Radial center highlight — soft white glow from center */}
                  <defs>
                    <radialGradient id={`v3-center-hl-${d.code}`} cx="50%" cy="50%" r="55%">
                      <stop offset="0%" stopColor="white" stopOpacity="0.03" />
                      <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <polygon points={pts} fill={`url(#v3-center-hl-${d.code})`} />
                  {/* Inner border line — inset 3px, district accent color */}
                  <polygon
                    points={d.polygon.map(([px, py]) => {
                      // Inset toward centroid by 3px
                      const dx = cx - px;
                      const dy = cy - py;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      const t = dist > 0 ? 3 / dist : 0;
                      return `${px + dx * t},${py + dy * t}`;
                    }).join(' ')}
                    fill="none"
                    stroke={d.gradient[1]}
                    strokeWidth="0.8"
                    opacity="0.05"
                  />
                </g>
              );
            })}
          </g>

          {/* ═══ LAYER 5: Environmental Scatter ═══ */}
          <g id="layer-env-scatter" style={{ pointerEvents: 'none' }}>
            {DISTRICTS_GEO.map((d, idx) => {
              {/* ── GREEN terrain ── */}
              if (d.terrain === 'green') {
                const trees = scatterInPolygon(d.polygon, 20, idx * 1000 + 42);
                const rng = seededRandom(idx * 1000 + 99);
                const bushPts = scatterInPolygon(d.polygon, 7, idx * 1000 + 143);
                const flowerPts = scatterInPolygon(d.polygon, 5, idx * 1000 + 201);
                return (
                  <g key={`env-${d.code}`}>
                    {trees.map(([tx, ty], i) => {
                      // 3 size classes: small (3-5), medium (5-8), large (8-12)
                      const sizeRoll = rng();
                      const r = sizeRoll < 0.35 ? 3 + rng() * 2
                               : sizeRoll < 0.7 ? 5 + rng() * 3
                               : 8 + rng() * 4;
                      const isLarge = r >= 8;
                      return (
                        <g key={i}>
                          {/* Shadow for large trees */}
                          {isLarge && (
                            <ellipse cx={tx + 2} cy={ty + r * 0.4} rx={r * 0.7} ry={r * 0.25} fill="#222" opacity="0.05" />
                          )}
                          <rect x={tx - 0.5} y={ty} width={1} height={r * 0.6} fill={COLORS.earth} opacity="0.15" rx="0.2" />
                          <circle cx={tx} cy={ty - r * 0.1} r={r} fill={COLORS.grass} opacity={0.10 + rng() * 0.08} />
                          <circle cx={tx - r * 0.3} cy={ty - r * 0.3} r={r * 0.6} fill={COLORS.grassLight} opacity={0.08 + rng() * 0.05} />
                        </g>
                      );
                    })}
                    {/* Bush scatter */}
                    {bushPts.map(([bx, by], i) => (
                      <use key={`bush-${i}`} href="#v3-bush" x={bx - 4} y={by - 2} width={8 + (i % 3)} height={5 + (i % 2)} opacity={0.12 + (i % 3) * 0.02} />
                    ))}
                    {/* Flower clusters */}
                    {flowerPts.map(([fx, fy], i) => {
                      const fRng = seededRandom(idx * 1000 + 300 + i);
                      const colors = [COLORS.neonPink, COLORS.glowWarm, 'white', '#E8B4E8'];
                      return (
                        <g key={`flower-${i}`}>
                          {[0, 1, 2, 3].map((fi) => (
                            <circle key={fi}
                              cx={fx + (fRng() - 0.5) * 5}
                              cy={fy + (fRng() - 0.5) * 4}
                              r={0.6 + fRng() * 0.4}
                              fill={colors[fi % colors.length]}
                              opacity={0.12 + fRng() * 0.06}
                            />
                          ))}
                        </g>
                      );
                    })}
                  </g>
                );
              }

              {/* ── URBAN terrain ── */}
              if (d.terrain === 'urban') {
                const bldgs = scatterInPolygon(d.polygon, 14, idx * 1000 + 77);
                const rng = seededRandom(idx * 1000 + 55);
                const carPts = scatterInPolygon(d.polygon, 4, idx * 1000 + 160);
                return (
                  <g key={`env-${d.code}`}>
                    {bldgs.map(([bx, by], i) => {
                      // Variation: some tall/narrow, some wide/short
                      const typeRoll = rng();
                      const w = typeRoll < 0.4 ? 2 + rng() * 2 : 4 + rng() * 5;
                      const h = typeRoll < 0.4 ? 4 + rng() * 5 : 2 + rng() * 3;
                      const op = 0.07 + rng() * 0.04;
                      return (
                        <g key={i}>
                          {/* Shadow rect — offset 1px right, 1px down */}
                          <rect
                            x={bx - w / 2 + 1} y={by - h / 2 + 1}
                            width={w} height={h}
                            fill="#1a1a1a" opacity={op * 0.4}
                            rx="0.2"
                          />
                          <rect
                            x={bx - w / 2} y={by - h / 2}
                            width={w} height={h}
                            fill={d.gradient[1]} opacity={op}
                            rx="0.3"
                          />
                        </g>
                      );
                    })}
                    {/* Parked cars near roads */}
                    {carPts.map(([cx, cy], i) => {
                      const carColors = ['#374151', '#1F2937', '#4B5563', '#6B21A8'];
                      return (
                        <rect key={`car-${i}`}
                          x={cx} y={cy}
                          width={4} height={2}
                          fill={carColors[i % carColors.length]}
                          opacity="0.08"
                          rx="0.5"
                        />
                      );
                    })}
                  </g>
                );
              }

              {/* ── RURAL terrain ── */}
              if (d.terrain === 'rural') {
                const posts = scatterInPolygon(d.polygon, 6, idx * 1000 + 33);
                const rng = seededRandom(idx * 1000 + 44);
                return (
                  <g key={`env-${d.code}`}>
                    {/* Fence posts with connecting rails */}
                    {posts.map(([px, py], i) => {
                      const postH = 3 + rng() * 2;
                      const nextPost = posts[i + 1];
                      return (
                        <g key={i}>
                          <line x1={px} y1={py} x2={px} y2={py - postH} stroke={COLORS.earth} strokeWidth="0.6" opacity="0.14" strokeLinecap="round" />
                          <circle cx={px} cy={py - postH} r="1.2" fill={COLORS.grass} opacity={0.10 + rng() * 0.05} />
                          {/* Fence rail connecting to next post */}
                          {nextPost && (
                            <line x1={px} y1={py - postH * 0.6} x2={nextPost[0]} y2={nextPost[1] - postH * 0.6} stroke={COLORS.earth} strokeWidth="0.3" opacity="0.08" />
                          )}
                        </g>
                      );
                    })}
                    {/* Crop field rows */}
                    <g clipPath={`url(#v3-clip-${d.code})`}>
                      {Array.from({ length: 5 }, (_, i) => {
                        const y = d.center[1] - 60 + i * 30;
                        return (
                          <line key={`row-${i}`} x1={d.center[0] - 50} y1={y} x2={d.center[0] + 50} y2={y}
                            stroke={COLORS.earth} strokeWidth="0.5" opacity="0.08" strokeDasharray="4 3" />
                        );
                      })}
                      {/* Additional crop field rectangles with alternating rows */}
                      {Array.from({ length: 4 }, (_, i) => {
                        const fy = d.center[1] - 40 + i * 25;
                        const fw = 30 + (i % 2) * 20;
                        return (
                          <g key={`field-${i}`}>
                            <rect x={d.center[0] - fw / 2} y={fy} width={fw} height={18} fill={COLORS.grassLight} opacity="0.04" rx="1" />
                            {[0, 1, 2, 3, 4].map((ri) => (
                              <line key={`frow-${ri}`} x1={d.center[0] - fw / 2 + 2} y1={fy + 2 + ri * 3.5} x2={d.center[0] + fw / 2 - 2} y2={fy + 2 + ri * 3.5}
                                stroke={COLORS.earth} strokeWidth="0.3" opacity="0.06" />
                            ))}
                          </g>
                        );
                      })}
                    </g>
                    {/* Hay bales */}
                    {[0, 1, 2].map((i) => {
                      const hx = d.center[0] - 25 + i * 25 + (rng() - 0.5) * 10;
                      const hy = d.center[1] + 20 + (rng() - 0.5) * 20;
                      return <ellipse key={`hay-${i}`} cx={hx} cy={hy} rx={3.5} ry={2.5} fill={COLORS.sandDark} opacity="0.10" />;
                    })}
                    {/* Tiny farmhouse */}
                    <g>
                      <rect x={d.center[0] + 30} y={d.center[1] - 35} width={6} height={6} fill={COLORS.earth} opacity="0.10" rx="0.3" />
                      <polygon points={`${d.center[0] + 30},${d.center[1] - 35} ${d.center[0] + 33},${d.center[1] - 39} ${d.center[0] + 36},${d.center[1] - 35}`} fill={COLORS.roofTerracotta} opacity="0.12" />
                    </g>
                  </g>
                );
              }

              {/* ── INDUSTRIAL terrain ── */}
              if (d.terrain === 'industrial') {
                const pipes = scatterInPolygon(d.polygon, 8, idx * 1000 + 88);
                const rng = seededRandom(idx * 1000 + 66);
                const tankPts = scatterInPolygon(d.polygon, 3, idx * 1000 + 170);
                return (
                  <g key={`env-${d.code}`}>
                    {/* Pipes */}
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
                    {/* Storage tanks */}
                    {tankPts.map(([tx, ty], i) => {
                      const tr = 4 + (i % 3) * 1;
                      return (
                        <g key={`tank-${i}`}>
                          <circle cx={tx} cy={ty} r={tr} fill="#9CA3AF" opacity="0.08" />
                          <circle cx={tx} cy={ty} r={tr} fill="none" stroke="#6B7280" strokeWidth="0.4" opacity="0.06" />
                        </g>
                      );
                    })}
                    {/* Chain-link fence along edges */}
                    <polygon
                      points={polygonToPoints(d.polygon)}
                      fill="none" stroke="#6B7280" strokeWidth="0.4" opacity="0.06"
                      strokeDasharray="1.5 2"
                    />
                    {/* Smokestacks with animated smoke puffs */}
                    {[0, 1, 2].map((si) => {
                      const sx = d.center[0] - 20 + si * 20 + (rng() - 0.5) * 8;
                      const sy = d.center[1] - 10;
                      return (
                        <g key={`stack-${si}`}>
                          {/* Smokestack body */}
                          <rect x={sx - 1} y={sy - 14} width={2} height={14} fill="#57534E" opacity="0.10" rx="0.3" />
                          <rect x={sx - 1.5} y={sy - 15} width={3} height={2} fill="#4B5563" opacity="0.08" rx="0.3" />
                          {/* Smoke puff — rises and fades */}
                          <ellipse cx={sx} cy={sy - 18} rx={2.5} ry={1.5} fill="#9CA3AF" opacity="0.06">
                            <animate attributeName="cy" values={`${sy - 18};${sy - 30};${sy - 18}`} dur={`${6 + si * 2}s`} repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.06;0.01;0.06" dur={`${6 + si * 2}s`} repeatCount="indefinite" />
                            <animate attributeName="rx" values="2.5;5;2.5" dur={`${6 + si * 2}s`} repeatCount="indefinite" />
                          </ellipse>
                        </g>
                      );
                    })}
                  </g>
                );
              }

              {/* ── WATER terrain ── */}
              if (d.terrain === 'water') {
                const rng = seededRandom(idx * 1000 + 120);
                const lilyPts = scatterInPolygon(d.polygon, 4, idx * 1000 + 210);
                return (
                  <g key={`env-${d.code}`}>
                    {/* Animated ripple circles */}
                    {[0, 1, 2].map((ri) => {
                      const rx = d.center[0] + (rng() - 0.5) * 40;
                      const ry = d.center[1] + (rng() - 0.5) * 30;
                      const dur = 4 + rng() * 3;
                      return (
                        <circle key={`ripple-${ri}`} cx={rx} cy={ry} r="2" fill="none" stroke={COLORS.waterShallow} strokeWidth="0.4" opacity="0.12">
                          <animate attributeName="r" values="2;12;2" dur={`${dur}s`} repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.12;0.01;0.12" dur={`${dur}s`} repeatCount="indefinite" />
                        </circle>
                      );
                    })}
                    {/* Lily pads */}
                    {lilyPts.map(([lx, ly], i) => (
                      <ellipse key={`lily-${i}`} cx={lx} cy={ly} rx={2 + (i % 2)} ry={1.5 + (i % 2) * 0.5} fill={COLORS.grass} opacity="0.10" />
                    ))}
                    {/* Reflected light streaks */}
                    {[0, 1, 2].map((li) => {
                      const lx = d.center[0] - 15 + li * 15;
                      const ly = d.center[1] - 8 + li * 6;
                      return <rect key={`reflight-${li}`} x={lx} y={ly} width={1} height={8 + li * 2} fill="white" opacity="0.04" rx="0.3" />;
                    })}
                  </g>
                );
              }

              {/* ── Default fallback: any other terrain ── */}
              {
                const fallbackPts = scatterInPolygon(d.polygon, 5, idx * 1000 + 500);
                return (
                  <g key={`env-${d.code}`}>
                    {fallbackPts.map(([bx, by], i) => (
                      <use key={`fb-bush-${i}`} href="#v3-bush" x={bx - 4} y={by - 2} width={8} height={5} opacity={0.10 + (i % 3) * 0.02} />
                    ))}
                  </g>
                );
              }
            })}
          </g>

          {/* ═══ LAYER 6: Roads ═══ */}
          <g id="layer-roads" style={{ pointerEvents: 'none' }}>
            {/* Ground shadow pass — "pressed into ground" */}
            {ROADS.map((road) => {
              const style = ROAD_STYLES[road.type] ?? ROAD_STYLES.tertiary;
              return (
                <path
                  key={`shadow-${road.id}`} d={road.path} fill="none"
                  stroke="#000" strokeWidth={style.casingWidth + 3}
                  opacity={0.08}
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray={style.dash}
                  filter="url(#v3-ambient-occlusion)"
                  transform="translate(0,2)"
                />
              );
            })}
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
            {/* Highway lane markings — offset dashed stripes */}
            {ROADS.map((road) => {
              if (road.type !== 'highway') return null;
              return (
                <g key={`lanes-${road.id}`}>
                  <path d={road.path} fill="none"
                    stroke="white" strokeWidth="0.5"
                    opacity="0.20" strokeDasharray="6 8"
                    strokeLinecap="round"
                    transform="translate(-1.5,0)"
                  />
                  <path d={road.path} fill="none"
                    stroke="white" strokeWidth="0.5"
                    opacity="0.20" strokeDasharray="6 8"
                    strokeLinecap="round"
                    transform="translate(1.5,0)"
                  />
                </g>
              );
            })}
            {/* Junction intersections + crosswalks + signs + streetlamps */}
            {ROAD_JUNCTIONS.map(([jx, jy], i) => {
              const isActive = selectedCode != null || hoveredCode != null;
              const hasSign = i < 6;
              const hasLamp = i % 2 === 0;
              const signColors = ['#22C55E', '#3B82F6', '#EAB308', '#22C55E', '#3B82F6', '#EAB308'];
              return (
                <g key={`junction-${i}`}>
                  {/* Intersection base — larger circle behind */}
                  <circle cx={jx} cy={jy} r="6" fill="#B8A08A" opacity="0.30" />
                  {/* Main junction circles */}
                  <circle cx={jx} cy={jy} r="4" fill="#B8A08A" opacity="0.45" />
                  <circle cx={jx} cy={jy} r="4" fill="none" stroke="#8B7355" strokeWidth="0.8" opacity="0.35" />
                  {/* Crosswalk dashes (2-4 tiny white lines) */}
                  {[0, 1, 2, 3].slice(0, 2 + (i % 3)).map((ci) => {
                    const offset = (ci - 1.5) * 2.5;
                    // Alternate horizontal/vertical based on junction index
                    return i % 2 === 0
                      ? <line key={`xwalk-${ci}`} x1={jx + offset} y1={jy - 5} x2={jx + offset} y2={jy - 7} stroke="white" strokeWidth="1" opacity="0.18" />
                      : <line key={`xwalk-${ci}`} x1={jx - 5} y1={jy + offset} x2={jx - 7} y2={jy + offset} stroke="white" strokeWidth="1" opacity="0.18" />;
                  })}
                  {/* Road sign */}
                  {hasSign && (
                    <g>
                      <line x1={jx + 7} y1={jy - 2} x2={jx + 7} y2={jy - 6} stroke="#6B7280" strokeWidth="0.5" opacity="0.20" />
                      <rect x={jx + 5.5} y={jy - 10} width={3} height={4} fill={signColors[i]} opacity="0.25" rx="0.3" />
                    </g>
                  )}
                  {/* Streetlamp */}
                  {hasLamp && (
                    <g>
                      <line x1={jx - 6} y1={jy + 2} x2={jx - 6} y2={jy - 6} stroke="#78716C" strokeWidth="0.8" opacity="0.15" />
                      <circle cx={jx - 6} cy={jy - 7} r="1.5" fill={COLORS.gold} opacity={isActive ? 0.25 : 0.12} />
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* ═══ LAYER 7: Forest Trees (between districts) ═══ */}
          <g id="layer-forests" style={{ pointerEvents: 'none' }}>
            {/* Ground cover undergrowth — below tree layer */}
            {(() => {
              const ugRng = seededRandom(77777);
              return Array.from({ length: 18 }, (_, i) => {
                // Pick a random forest region center from FOREST_TREES positions
                const refTree = FOREST_TREES[i % FOREST_TREES.length];
                const ux = refTree.x + (ugRng() - 0.5) * 20;
                const uy = refTree.y + (ugRng() - 0.5) * 15;
                const ur = 1 + ugRng() * 1;
                return <circle key={`ug-${i}`} cx={ux} cy={uy} r={ur} fill={ugRng() > 0.5 ? COLORS.earth : COLORS.grassLight} opacity="0.06" />;
              });
            })()}

            {/* Clearings — lighter circles within dense tree areas */}
            {[
              { x: 300, y: 300, r: 15 },
              { x: 460, y: 290, r: 12 },
              { x: 650, y: 460, r: 14 },
              { x: 360, y: 570, r: 11 },
            ].map((cl, i) => (
              <circle key={`clearing-${i}`} cx={cl.x} cy={cl.y} r={cl.r} fill={COLORS.sand} opacity="0.03" />
            ))}

            {/* Trees — deciduous, conifer, and bush */}
            {FOREST_TREES.map((tree, i) => {
              if (tree.kind === 'conifer') {
                const scale = 0.7 + (tree.r / 10) * 0.6;
                const sw = 10 * scale;
                const sh = 15 * scale;
                return (
                  <g key={`ftree-${i}`}>
                    <ellipse cx={tree.x + 1} cy={tree.y + 1} rx={sw * 0.3} ry={sh * 0.1} fill="#222" opacity="0.04" />
                    <use href="#v3-pine-tree" x={tree.x - sw / 2} y={tree.y - sh * 0.8} width={sw} height={sh} opacity={0.14 + (i % 3) * 0.02} />
                  </g>
                );
              }
              if (tree.kind === 'bush') {
                return (
                  <use key={`ftree-${i}`} href="#v3-bush" x={tree.x - 4} y={tree.y - 2} width={8 + tree.r * 0.3} height={5 + tree.r * 0.2} opacity="0.12" />
                );
              }
              // Deciduous — trunk + 2 circles + shadow
              return (
                <g key={`ftree-${i}`}>
                  {/* Base shadow */}
                  <ellipse cx={tree.x + 1} cy={tree.y + tree.r * 0.3} rx={tree.r * 0.5} ry={tree.r * 0.15} fill="#222" opacity="0.04" />
                  <rect x={tree.x - 0.4} y={tree.y} width={0.8} height={tree.r * 0.5} fill={COLORS.earth} opacity="0.12" rx="0.2" />
                  <circle cx={tree.x} cy={tree.y - tree.r * 0.1} r={tree.r} fill={tree.shade} opacity="0.14" />
                  <circle cx={tree.x - tree.r * 0.25} cy={tree.y - tree.r * 0.3} r={tree.r * 0.5} fill={COLORS.grassLight} opacity="0.08" />
                </g>
              );
            })}
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
                  {/* Two-stage selection glow — outer + inner */}
                  {isSelected && (
                    <>
                      <polygon
                        points={pts}
                        fill={COLORS.gold}
                        opacity="0.25"
                        filter="url(#v3-select-glow)"
                      />
                      <polygon
                        points={pts}
                        fill={COLORS.goldGlow}
                        opacity="0.45"
                        filter="url(#v3-hover-glow)"
                      />
                    </>
                  )}
                  {/* Animated hover pulse */}
                  {isHovered && !isSelected && (
                    <polygon
                      points={pts}
                      fill={COLORS.gold}
                      filter="url(#v3-hover-glow)"
                    >
                      <animate attributeName="opacity" values="0.20;0.35;0.20" dur="2s" repeatCount="indefinite" />
                    </polygon>
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

                  {/* Clipped content — gradient fill + terrain texture + directional glass */}
                  <g clipPath={`url(#v3-clip-${d.code})`}>
                    {/* Base gradient */}
                    <polygon
                      points={pts}
                      fill={`url(#v3-grad-${d.code})`}
                      opacity={isActive ? 0.9 : 0.55}
                      style={{ transition: 'opacity 300ms ease' }}
                    />
                    {/* Terrain texture overlay at 60% */}
                    {(() => {
                      const tp = DISTRICT_PATTERN_OVERRIDE[d.code] ?? TERRAIN_PATTERN[d.terrain];
                      return tp ? (
                        <polygon
                          points={pts}
                          fill={`url(#${tp})`}
                          opacity={0.06}
                        />
                      ) : null;
                    })()}
                    {/* Directional glass highlight — angled x2=0.7 */}
                    <polygon
                      points={pts}
                      fill="url(#v3-glass)"
                      opacity={isActive ? 0.5 : 0.3}
                      style={{ transition: 'opacity 300ms ease' }}
                    />
                    {/* Inner shadow — dark radial gradient at edges */}
                    <polygon
                      points={pts}
                      fill="rgba(0,0,0,0.06)"
                      opacity={isActive ? 0 : 1}
                      style={{ transition: 'opacity 300ms ease' }}
                    />
                  </g>

                  {/* Double-line border for inactive districts */}
                  {!isActive && !selectedCode && (
                    <>
                      <polygon
                        points={pts}
                        fill="none"
                        stroke={d.stroke}
                        strokeWidth="1.2"
                        opacity="0.3"
                      />
                      <polygon
                        points={pts}
                        fill="none"
                        stroke={d.stroke}
                        strokeWidth="0.3"
                        opacity="0.15"
                        strokeDasharray="3 5"
                      />
                    </>
                  )}

                  {/* Border — gold marching ants for selected, warm pulse for hover */}
                  {isActive && (
                    <polygon
                      points={pts}
                      fill="none"
                      stroke={isSelected ? COLORS.gold : COLORS.goldGlow}
                      strokeWidth={isSelected ? 3 : 2}
                      strokeDasharray={isSelected ? '8 4' : undefined}
                      style={{
                        transition: 'stroke 300ms ease, stroke-width 300ms ease',
                      }}
                    >
                      {isSelected && (
                        <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1.5s" repeatCount="indefinite" />
                      )}
                    </polygon>
                  )}

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
              const isHoveredIcon = hoveredCode === d.code;
              const isActive = selectedCode === d.code || isHoveredIcon;
              const iconX = d.center[0] - 14;
              const iconY = d.center[1] - 26;
              return (
                <g key={`icon-${d.code}`} transform={`translate(${iconX}, ${iconY})`}>
                  {/* Glow circle behind icon */}
                  <circle
                    cx={14} cy={14} r={isActive ? 18 : 14}
                    fill={d.gradient[0]}
                    opacity={isActive ? 0.12 : 0.06}
                    style={{ transition: 'r 300ms ease, opacity 300ms ease' }}
                  />
                  {/* Pulsing ring on active */}
                  {isActive && (
                    <circle
                      cx={14} cy={14} r={16}
                      fill="none" stroke={COLORS.gold}
                      strokeWidth="1"
                    >
                      <animate attributeName="r" values="16;22;16" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.3;0.05;0.3" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <g
                    className={isActive ? '' : 'animate-icon-float'}
                    style={{
                      animationDelay: `${(idx * 0.4) % 3}s`,
                      opacity: isActive ? 1 : 0.7,
                      filter: isActive ? 'url(#v3-icon-glow)' : 'none',
                    }}
                  >
                    <g style={{ transform: 'scale(1.3)', transformOrigin: '12px 12px' }}>
                      {DISTRICT_ICONS[d.icon]?.(isActive ? COLORS.gold : d.gradient[0])}
                    </g>
                  </g>
                  {/* Label badge on hover */}
                  {isHoveredIcon && (
                    <g>
                      <rect
                        x={-2} y={32} width={32} height={10}
                        fill="rgba(0,0,0,0.5)" rx="3"
                      />
                      <text
                        x={14} y={40}
                        textAnchor="middle" fontSize="6"
                        fill="white" fontFamily="system-ui"
                        opacity="0.9"
                      >
                        {d.name?.slice(0, 8) ?? d.code}
                      </text>
                    </g>
                  )}
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
