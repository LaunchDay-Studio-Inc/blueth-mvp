'use client';

import { useState, useCallback } from 'react';
import { DISTRICTS, type DistrictMeta } from '@/lib/districts';
import { TerrainBackground } from './map/terrain-bg';
import { RoadNetwork } from './map/road-network';
import { DistrictGround } from './map/district-ground';
import { MapDecorations } from './map/map-decorations';

interface CityMapProps {
  onDistrictSelect?: (district: DistrictMeta) => void;
  selectedCode?: string;
}

// ── District icon SVG paths (24x24 viewBox) ──────────────────────

export const DISTRICT_ICONS: Record<string, (color: string) => React.ReactNode> = {
  skyscraper: (c) => (
    <g fill={c} opacity="0.9">
      <rect x="3" y="8" width="6" height="16" rx="0.5" />
      <rect x="4.5" y="10" width="1" height="1" fill="#000" opacity="0.3" />
      <rect x="4.5" y="13" width="1" height="1" fill="#000" opacity="0.3" />
      <rect x="4.5" y="16" width="1" height="1" fill="#000" opacity="0.3" />
      <rect x="10" y="4" width="5" height="20" rx="0.5" />
      <rect x="11.5" y="6" width="1.2" height="1" fill="#000" opacity="0.3" />
      <rect x="11.5" y="9" width="1.2" height="1" fill="#000" opacity="0.3" />
      <rect x="11.5" y="12" width="1.2" height="1" fill="#000" opacity="0.3" />
      <rect x="11.5" y="15" width="1.2" height="1" fill="#000" opacity="0.3" />
      <rect x="16" y="10" width="5" height="14" rx="0.5" />
      <rect x="17.5" y="12" width="1" height="1" fill="#000" opacity="0.3" />
      <rect x="17.5" y="15" width="1" height="1" fill="#000" opacity="0.3" />
      <line x1="12.5" y1="2" x2="12.5" y2="4" stroke={c} strokeWidth="0.8" />
    </g>
  ),
  clocktower: (c) => (
    <g fill={c} opacity="0.9">
      <rect x="8" y="10" width="8" height="14" rx="0.5" />
      <polygon points="7,10 12,3 17,10" />
      <circle cx="12" cy="8" r="2" fill="#000" opacity="0.2" />
      <line x1="12" y1="7" x2="12" y2="8" stroke="#000" strokeWidth="0.5" opacity="0.4" />
      <line x1="12" y1="8" x2="13" y2="8.5" stroke="#000" strokeWidth="0.5" opacity="0.4" />
      <rect x="10" y="14" width="1.5" height="1" fill="#000" opacity="0.2" />
      <rect x="10" y="17" width="1.5" height="1" fill="#000" opacity="0.2" />
      <rect x="10.5" y="20" width="3" height="4" fill="#000" opacity="0.15" />
    </g>
  ),
  sailboat: (c) => (
    <g fill={c} opacity="0.9">
      <polygon points="12,3 12,16 5,16" />
      <polygon points="12,6 12,16 18,16" opacity="0.7" />
      <line x1="12" y1="3" x2="12" y2="18" stroke={c} strokeWidth="0.8" />
      <path d="M4,18 Q8,16 12,18 Q16,20 20,18" fill="none" stroke={c} strokeWidth="1" opacity="0.5" />
      <path d="M3,20 Q8,18 12,20 Q16,22 21,20" fill="none" stroke={c} strokeWidth="0.8" opacity="0.3" />
      <ellipse cx="12" cy="17.5" rx="5" ry="1.5" opacity="0.3" />
    </g>
  ),
  circuit: (c) => (
    <g fill={c} opacity="0.9">
      <rect x="6" y="6" width="12" height="12" rx="1" fill="none" stroke={c} strokeWidth="1.2" />
      <rect x="9" y="9" width="6" height="6" rx="0.5" />
      <line x1="6" y1="10" x2="3" y2="10" stroke={c} strokeWidth="0.8" />
      <line x1="6" y1="14" x2="3" y2="14" stroke={c} strokeWidth="0.8" />
      <line x1="18" y1="10" x2="21" y2="10" stroke={c} strokeWidth="0.8" />
      <line x1="18" y1="14" x2="21" y2="14" stroke={c} strokeWidth="0.8" />
      <line x1="10" y1="6" x2="10" y2="3" stroke={c} strokeWidth="0.8" />
      <line x1="14" y1="6" x2="14" y2="3" stroke={c} strokeWidth="0.8" />
      <line x1="10" y1="18" x2="10" y2="21" stroke={c} strokeWidth="0.8" />
      <line x1="14" y1="18" x2="14" y2="21" stroke={c} strokeWidth="0.8" />
      <circle cx="12" cy="12" r="1" fill="#000" opacity="0.3" />
    </g>
  ),
  'market-stall': (c) => (
    <g fill={c} opacity="0.9">
      <path d="M4,10 L12,4 L20,10 Z" />
      <path d="M4,10 Q8,8 12,10 Q16,12 20,10" fill={c} opacity="0.6" />
      <rect x="5" y="10" width="14" height="10" rx="0.5" opacity="0.8" />
      <rect x="7" y="13" width="3" height="3" fill="#000" opacity="0.15" />
      <rect x="12" y="13" width="3" height="3" fill="#000" opacity="0.15" />
      <circle cx="8.5" cy="14.5" r="1" fill="#000" opacity="0.1" />
      <circle cx="13.5" cy="14.5" r="1" fill="#000" opacity="0.1" />
      <rect x="10" y="17" width="4" height="3" fill="#000" opacity="0.12" />
    </g>
  ),
  spotlight: (c) => (
    <g fill={c} opacity="0.9">
      <polygon points="12,2 14,9 21,9 15.5,13.5 17.5,21 12,16 6.5,21 8.5,13.5 3,9 10,9" />
      <circle cx="12" cy="12" r="3" fill="#000" opacity="0.15" />
      <circle cx="12" cy="12" r="1.5" fill={c} opacity="0.6" />
    </g>
  ),
  'book-tower': (c) => (
    <g fill={c} opacity="0.9">
      <rect x="6" y="16" width="12" height="3" rx="0.3" />
      <rect x="7" y="12.5" width="11" height="3" rx="0.3" opacity="0.85" />
      <rect x="6.5" y="9" width="10" height="3" rx="0.3" opacity="0.7" />
      <rect x="7.5" y="5.5" width="9" height="3" rx="0.3" opacity="0.6" />
      <polygon points="9,5.5 12,2 15,5.5" opacity="0.5" />
      <line x1="8" y1="17.5" x2="16" y2="17.5" stroke="#000" strokeWidth="0.3" opacity="0.2" />
      <line x1="8.5" y1="14" x2="15.5" y2="14" stroke="#000" strokeWidth="0.3" opacity="0.2" />
      <rect x="5" y="19" width="14" height="2" rx="0.3" opacity="0.4" />
    </g>
  ),
  crane: (c) => (
    <g fill={c} opacity="0.9">
      <rect x="11" y="4" width="2" height="18" />
      <line x1="12" y1="4" x2="22" y2="7" stroke={c} strokeWidth="1.2" />
      <line x1="12" y1="4" x2="5" y2="7" stroke={c} strokeWidth="1" />
      <line x1="12" y1="7" x2="20" y2="7" stroke={c} strokeWidth="0.6" opacity="0.5" />
      <line x1="20" y1="7" x2="20" y2="14" stroke={c} strokeWidth="0.6" />
      <rect x="18.5" y="14" width="3" height="2" opacity="0.6" />
      <rect x="8" y="20" width="8" height="2" rx="0.3" opacity="0.5" />
      <line x1="11" y1="22" x2="9" y2="22" stroke={c} strokeWidth="1" />
      <line x1="13" y1="22" x2="15" y2="22" stroke={c} strokeWidth="1" />
    </g>
  ),
  factory: (c) => (
    <g fill={c} opacity="0.9">
      <rect x="4" y="12" width="16" height="10" rx="0.5" />
      <rect x="5" y="6" width="3" height="6" />
      <rect x="10" y="8" width="3" height="4" />
      <rect x="6" y="3" width="1" height="3" opacity="0.6" />
      <rect x="11" y="5" width="1" height="3" opacity="0.6" />
      <ellipse cx="6.5" cy="3" rx="2" ry="1" fill={c} opacity="0.2" />
      <ellipse cx="11.5" cy="5" rx="1.8" ry="0.8" fill={c} opacity="0.15" />
      <rect x="7" y="15" width="2" height="2" fill="#000" opacity="0.15" />
      <rect x="11" y="15" width="2" height="2" fill="#000" opacity="0.15" />
      <rect x="15" y="15" width="2" height="2" fill="#000" opacity="0.15" />
      <rect x="9" y="19" width="3" height="3" fill="#000" opacity="0.12" />
    </g>
  ),
  'house-tree': (c) => (
    <g fill={c} opacity="0.9">
      <rect x="3" y="14" width="10" height="8" rx="0.5" />
      <polygon points="2,14 8,7 14,14" />
      <rect x="6" y="17" width="3" height="5" fill="#000" opacity="0.12" />
      <rect x="4" y="16" width="2" height="2" fill="#000" opacity="0.15" />
      <circle cx="19" cy="10" r="4" opacity="0.7" />
      <circle cx="17" cy="12" r="3" opacity="0.5" />
      <rect x="18.5" y="14" width="1" height="6" opacity="0.6" />
    </g>
  ),
  community: (c) => (
    <g fill={c} opacity="0.9">
      <rect x="2" y="15" width="7" height="6" rx="0.3" />
      <polygon points="1.5,15 5.5,10 9.5,15" />
      <rect x="9" y="13" width="6" height="8" rx="0.3" opacity="0.85" />
      <polygon points="8.5,13 12,8 15.5,13" opacity="0.85" />
      <rect x="16" y="15" width="6" height="6" rx="0.3" opacity="0.7" />
      <polygon points="15.5,15 19,11 22.5,15" opacity="0.7" />
      <rect x="4" y="17" width="1.5" height="2" fill="#000" opacity="0.12" />
      <rect x="11" y="16" width="2" height="3" fill="#000" opacity="0.12" />
      <rect x="18" y="17" width="1.5" height="2" fill="#000" opacity="0.12" />
    </g>
  ),
  windmill: (c) => (
    <g fill={c} opacity="0.9">
      <polygon points="10,10 14,10 13,22 11,22" />
      <circle cx="12" cy="10" r="1.5" fill="#000" opacity="0.2" />
      <line x1="12" y1="10" x2="12" y2="2" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="10" x2="20" y2="7" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="10" x2="4" y2="13" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="10" x2="15" y2="18" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="10" r="1" fill={c} />
      <rect x="9" y="22" width="6" height="1" rx="0.3" opacity="0.4" />
    </g>
  ),
};

// ── Isometric 3D building helpers ──────────────────────

const WIN_COLOR = 'rgba(180,220,255,0.3)';

function isoBox(
  bx: number, gy: number, w: number, h: number,
  front: string, side: string, top: string, k: string
): React.ReactNode {
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
): React.ReactNode {
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
      {/* Right side of roof */}
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
      {/* Door */}
      <rect x={bx + w/2 - 1.5} y={gy - 4} width={3} height={4} fill="rgba(0,0,0,0.15)" rx="0.3" />
    </g>
  );
}

function domeBox(
  bx: number, gy: number, w: number, h: number,
  front: string, side: string, dome: string, k: string
): React.ReactNode {
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
      {/* Columns */}
      <line x1={bx + 3} y1={gy} x2={bx + 3} y2={gy - h} stroke={front} strokeWidth="1.2" opacity="0.6" />
      <line x1={bx + w - 3} y1={gy} x2={bx + w - 3} y2={gy - h} stroke={front} strokeWidth="1.2" opacity="0.6" />
    </g>
  );
}

// ── Small detail helpers ──────────────────────────────

function miniTree(x: number, y: number, color: string, k: string): React.ReactNode {
  return (
    <g key={k}>
      <rect x={x - 0.5} y={y} width={1} height={4} fill="#5D4037" opacity="0.4" rx="0.2" />
      <circle cx={x} cy={y - 1} r={3.5} fill={color} opacity="0.35" />
      <circle cx={x - 1} cy={y - 2} r={2.2} fill={color} opacity="0.25" />
    </g>
  );
}

function car(x: number, y: number, color: string, k: string): React.ReactNode {
  return (
    <g key={k} opacity="0.35">
      <rect x={x} y={y} width={5} height={2} fill={color} rx="0.6" />
      <rect x={x + 0.8} y={y - 1} width={3} height={1.2} fill={color} opacity="0.7" rx="0.4" />
      <circle cx={x + 1} cy={y + 2} r="0.6" fill="#333" opacity="0.4" />
      <circle cx={x + 4} cy={y + 2} r="0.6" fill="#333" opacity="0.4" />
    </g>
  );
}

function lampPost(x: number, y: number, color: string, k: string): React.ReactNode {
  return (
    <g key={k}>
      <line x1={x} y1={y} x2={x} y2={y - 8} stroke={color} strokeWidth="0.5" opacity="0.3" />
      <circle cx={x} cy={y - 8.5} r="1.2" fill={color} opacity="0.2" />
      <circle cx={x} cy={y - 8.5} r="2.5" fill={color} opacity="0.06" />
    </g>
  );
}

function bench(x: number, y: number, color: string, k: string): React.ReactNode {
  return (
    <g key={k} opacity="0.25">
      <rect x={x} y={y} width={5} height={0.8} fill={color} rx="0.2" />
      <rect x={x + 0.3} y={y + 0.8} width={0.5} height={1.5} fill={color} />
      <rect x={x + 4.2} y={y + 0.8} width={0.5} height={1.5} fill={color} />
      <rect x={x} y={y - 1.5} width={5} height={0.5} fill={color} rx="0.1" />
    </g>
  );
}

function person(x: number, y: number, color: string, k: string): React.ReactNode {
  return (
    <g key={k} opacity="0.3">
      <circle cx={x} cy={y} r="1" fill={color} />
      <polygon points={`${x - 1},${y + 1.2} ${x + 1},${y + 1.2} ${x},${y + 4.5}`} fill={color} />
    </g>
  );
}

// ── Per-district building scenes (3x detail) ──────────────────────

function renderDistrictScene(
  code: string, cx: number, cy: number, g: [string, string]
): React.ReactNode {
  const f = `${g[0]}DD`;
  const s = `${g[1]}CC`;
  const t = `${g[0]}88`;
  const gy = cy + 20;

  switch (code) {
    case 'CBD':
      return (
        <g>
          {/* Skyline — 8 towers, staggered heights */}
          {isoBox(cx - 58, gy, 9, 28, f, s, t, 'c0')}
          {isoBox(cx - 46, gy, 11, 42, f, s, t, 'c1')}
          {isoBox(cx - 32, gy, 13, 58, f, s, t, 'c2')}
          {isoBox(cx - 16, gy, 16, 76, f, s, t, 'c3')}
          {isoBox(cx + 3, gy, 12, 50, f, s, t, 'c4')}
          {isoBox(cx + 18, gy, 15, 68, f, s, t, 'c5')}
          {isoBox(cx + 36, gy, 11, 38, f, s, t, 'c6')}
          {isoBox(cx + 50, gy, 10, 32, f, s, t, 'c7')}
          {/* Antennas */}
          <line x1={cx - 8} y1={gy - 76} x2={cx - 8} y2={gy - 86} stroke={g[0]} strokeWidth="0.8" />
          <circle cx={cx - 8} cy={gy - 87} r="1.2" fill="#E53935" opacity="0.8" />
          <line x1={cx + 25} y1={gy - 68} x2={cx + 25} y2={gy - 76} stroke={g[0]} strokeWidth="0.6" />
          <circle cx={cx + 25} cy={gy - 77} r="0.9" fill="#E53935" opacity="0.6" />
          {/* Helipad on tallest */}
          <circle cx={cx - 8} cy={gy - 77} r="4" fill="none" stroke={g[0]} strokeWidth="0.5" opacity="0.25" />
          <line x1={cx - 10} y1={gy - 77} x2={cx - 6} y2={gy - 77} stroke={g[0]} strokeWidth="0.3" opacity="0.2" />
          {/* Rooftop gardens */}
          <rect x={cx + 3.5} y={gy - 51.5} width={10} height={2} fill="#4CAF50" opacity="0.3" rx="0.5" />
          <rect x={cx + 37} y={gy - 39.5} width={9} height={1.5} fill="#4CAF50" opacity="0.25" rx="0.5" />
          {/* Sky bridge */}
          <rect x={cx + 12} y={gy - 50} width={8} height={1.5} fill={s} opacity="0.4" rx="0.3" />
          {/* Cars */}
          {car(cx - 54, gy + 1, '#4A90D9', 'cc1')}
          {car(cx - 10, gy + 1, '#E53935', 'cc2')}
          {car(cx + 28, gy + 1, '#333', 'cc3')}
          {/* Lamp posts */}
          {lampPost(cx - 60, gy, g[0], 'cl1')}
          {lampPost(cx - 26, gy, g[0], 'cl2')}
          {lampPost(cx + 10, gy, g[0], 'cl3')}
          {lampPost(cx + 46, gy, g[0], 'cl4')}
          {/* People */}
          {person(cx - 40, gy - 1, g[0], 'cp1')}
          {person(cx + 0, gy - 1, g[0], 'cp2')}
          {person(cx + 42, gy - 1, g[0], 'cp3')}
          {/* Ground plaza */}
          <rect x={cx - 62} y={gy} width={124} height={2} fill="rgba(0,0,0,0.05)" rx="0.3" />
        </g>
      );

    case 'OLD_TOWN':
      return (
        <g>
          {/* Buildings — varied pitched roofs, one tall church */}
          {pointedBox(cx - 50, gy, 12, 16, f, s, g[1], 'o0')}
          {pointedBox(cx - 34, gy, 14, 22, f, s, g[1], 'o1')}
          {pointedBox(cx - 16, gy, 13, 18, f, s, g[1], 'o2')}
          {pointedBox(cx + 0, gy, 11, 38, f, s, g[1], 'o3', 16)}
          {pointedBox(cx + 16, gy, 15, 24, f, s, g[1], 'o4')}
          {pointedBox(cx + 34, gy, 12, 16, f, s, g[1], 'o5')}
          {pointedBox(cx + 48, gy, 11, 14, f, s, g[1], 'o6')}
          {pointedBox(cx - 60, gy, 10, 12, f, s, g[1], 'o7')}
          {/* Church cross */}
          <line x1={cx + 5.5} y1={gy - 55} x2={cx + 5.5} y2={gy - 61} stroke={g[0]} strokeWidth="0.8" />
          <line x1={cx + 3.5} y1={gy - 59} x2={cx + 7.5} y2={gy - 59} stroke={g[0]} strokeWidth="0.8" />
          {/* Clock tower face */}
          <circle cx={cx + 5.5} cy={gy - 30} r="2.5" fill="#000" opacity="0.15" />
          <line x1={cx + 5.5} y1={gy - 31.5} x2={cx + 5.5} y2={gy - 30} stroke="#000" strokeWidth="0.4" opacity="0.3" />
          <line x1={cx + 5.5} y1={gy - 30} x2={cx + 7} y2={gy - 29.5} stroke="#000" strokeWidth="0.4" opacity="0.3" />
          {/* Flower boxes */}
          <rect x={cx - 32} y={gy - 10} width={4} height={1.5} fill="#E74C8B" opacity="0.4" rx="0.3" />
          <rect x={cx + 18} y={gy - 12} width={4} height={1.5} fill="#FF6B6B" opacity="0.4" rx="0.3" />
          {/* Shop signs */}
          <rect x={cx - 48} y={gy - 8} width={6} height={2} fill={g[0]} opacity="0.2" rx="0.3" />
          <rect x={cx + 36} y={gy - 8} width={5} height={2} fill={g[1]} opacity="0.2" rx="0.3" />
          {/* Lamp posts (antique) */}
          {lampPost(cx - 56, gy, g[1], 'ol1')}
          {lampPost(cx - 24, gy, g[1], 'ol2')}
          {lampPost(cx + 28, gy, g[1], 'ol3')}
          {/* Benches */}
          {bench(cx - 42, gy - 1, g[1], 'ob1')}
          {bench(cx + 10, gy - 1, g[1], 'ob2')}
          {/* Trees */}
          {miniTree(cx - 28, gy - 4, g[0], 'ot1')}
          {miniTree(cx + 44, gy - 4, g[0], 'ot2')}
          {/* People */}
          {person(cx - 44, gy - 1, g[0], 'op1')}
          {person(cx - 8, gy - 1, g[0], 'op2')}
          {person(cx + 24, gy - 1, g[0], 'op3')}
          {/* Cobblestone ground */}
          <line x1={cx - 64} y1={gy + 3} x2={cx + 62} y2={gy + 3} stroke={g[0]} strokeWidth="0.4" opacity="0.15" strokeDasharray="2 2" />
          <rect x={cx - 64} y={gy} width={126} height={2} fill="rgba(0,0,0,0.04)" rx="0.3" />
        </g>
      );

    case 'MARINA':
      return (
        <g>
          {/* Buildings — coastal mix */}
          {isoBox(cx - 40, gy, 16, 20, f, s, t, 'm0')}
          {isoBox(cx - 20, gy, 14, 24, f, s, t, 'm1')}
          {pointedBox(cx - 2, gy, 12, 16, f, s, g[1], 'm2')}
          {isoBox(cx + 14, gy, 18, 18, f, s, t, 'm3')}
          {pointedBox(cx + 36, gy, 10, 14, f, s, g[1], 'm4')}
          {/* Lighthouse */}
          <rect x={cx + 56} y={gy - 32} width="4" height="32" fill={g[0]} opacity="0.6" rx="1" />
          <ellipse cx={cx + 58} cy={gy - 32} rx="3" ry="1.5" fill={g[0]} opacity="0.3" />
          <circle cx={cx + 58} cy={gy - 34} r="2" fill="#FFD54F" opacity="0.5" />
          <circle cx={cx + 58} cy={gy - 34} r="4" fill="#FFD54F" opacity="0.1" />
          {/* Pier 1 */}
          <rect x={cx + 36} y={gy - 2} width={22} height={2} fill={g[0]} opacity="0.5" rx="0.3" />
          <rect x={cx + 38} y={gy} width={1.5} height={5} fill={g[1]} opacity="0.4" />
          <rect x={cx + 50} y={gy} width={1.5} height={5} fill={g[1]} opacity="0.4" />
          {/* Pier 2 */}
          <rect x={cx + 36} y={gy + 8} width={18} height={1.5} fill={g[0]} opacity="0.35" rx="0.3" />
          {/* Sailboat 1 */}
          <polygon points={`${cx+40},${gy-5} ${cx+46},${gy-12} ${cx+46},${gy-5}`} fill="white" opacity="0.5" />
          <line x1={cx + 45} y1={gy - 12} x2={cx + 45} y2={gy - 2} stroke={g[0]} strokeWidth="0.6" opacity="0.4" />
          <ellipse cx={cx + 44} cy={gy - 3} rx="4" ry="1.5" fill={g[0]} opacity="0.25" />
          {/* Sailboat 2 */}
          <polygon points={`${cx+52},${gy-6} ${cx+56},${gy-10} ${cx+56},${gy-6}`} fill="white" opacity="0.4" />
          <ellipse cx={cx + 55} cy={gy - 4} rx="3" ry="1.2" fill={g[0]} opacity="0.2" />
          {/* Motorboat 1 */}
          <ellipse cx={cx + 42} cy={gy + 6} rx="4" ry="1.3" fill={g[0]} opacity="0.3" />
          <rect x={cx + 40} y={gy + 4} width={3} height={1.5} fill={g[1]} opacity="0.3" rx="0.3" />
          {/* Motorboat 2 */}
          <ellipse cx={cx + 50} cy={gy + 10} rx="3.5" ry="1.1" fill={g[0]} opacity="0.25" />
          {/* Beach umbrellas */}
          <path d={`M${cx-44},${gy-5} A4,4 0 0,1 ${cx-36},${gy-5}`} fill="#FF6B6B" opacity="0.35" />
          <line x1={cx - 40} y1={gy - 5} x2={cx - 40} y2={gy + 2} stroke={g[1]} strokeWidth="0.5" opacity="0.3" />
          <path d={`M${cx-36},${gy-4} A3.5,3.5 0 0,1 ${cx-29},${gy-4}`} fill="#FFD54F" opacity="0.3" />
          <line x1={cx - 32.5} y1={gy - 4} x2={cx - 32.5} y2={gy + 2} stroke={g[1]} strokeWidth="0.5" opacity="0.3" />
          <path d={`M${cx-28},${gy-5} A4,4 0 0,1 ${cx-20},${gy-5}`} fill="#4FC3F7" opacity="0.3" />
          <line x1={cx - 24} y1={gy - 5} x2={cx - 24} y2={gy + 2} stroke={g[1]} strokeWidth="0.5" opacity="0.3" />
          {/* Bollards */}
          <rect x={cx + 42} y={gy - 3} width="1.5" height="2" fill={g[1]} opacity="0.3" rx="0.3" />
          <rect x={cx + 48} y={gy - 3} width="1.5" height="2" fill={g[1]} opacity="0.3" rx="0.3" />
          {/* Lamp posts */}
          {lampPost(cx - 42, gy, g[0], 'ml1')}
          {lampPost(cx + 8, gy, g[0], 'ml2')}
          {/* People */}
          {person(cx - 38, gy - 1, g[0], 'mp1')}
          {person(cx + 22, gy - 1, g[0], 'mp2')}
          {/* Water ripples */}
          <path d={`M${cx+34},${gy+5} Q${cx+44},${gy+3} ${cx+54},${gy+5}`} fill="none" stroke={g[0]} strokeWidth="0.4" opacity="0.2" />
          <path d={`M${cx+36},${gy+8} Q${cx+46},${gy+6} ${cx+56},${gy+8}`} fill="none" stroke={g[0]} strokeWidth="0.3" opacity="0.15" />
          <path d={`M${cx+38},${gy+12} Q${cx+48},${gy+10} ${cx+58},${gy+12}`} fill="none" stroke={g[0]} strokeWidth="0.25" opacity="0.1" />
        </g>
      );

    case 'TECH_PARK':
      return (
        <g>
          {/* Buildings — tall glass towers */}
          {isoBox(cx - 44, gy, 12, 34, f, s, t, 't0')}
          {isoBox(cx - 28, gy, 15, 44, f, s, t, 't1')}
          {isoBox(cx - 10, gy, 18, 56, f, s, t, 't2')}
          {isoBox(cx + 12, gy, 13, 38, f, s, t, 't3')}
          {isoBox(cx + 28, gy, 16, 50, f, s, t, 't4')}
          {isoBox(cx + 48, gy, 11, 30, f, s, t, 't5')}
          {isoBox(cx - 56, gy, 10, 24, f, s, t, 't6')}
          {/* Satellite dish 1 */}
          <path d={`M${cx-3},${gy-56} Q${cx+1},${gy-62} ${cx+5},${gy-56}`} fill="none" stroke={g[0]} strokeWidth="1" opacity="0.5" />
          <line x1={cx + 1} y1={gy - 56} x2={cx + 1} y2={gy - 59} stroke={g[0]} strokeWidth="0.6" opacity="0.5" />
          {/* Satellite dish 2 */}
          <path d={`M${cx+30},${gy-50} Q${cx+33},${gy-54} ${cx+36},${gy-50}`} fill="none" stroke={g[0]} strokeWidth="0.8" opacity="0.4" />
          <line x1={cx + 33} y1={gy - 50} x2={cx + 33} y2={gy - 52} stroke={g[0]} strokeWidth="0.5" opacity="0.4" />
          {/* Solar panels */}
          <rect x={cx - 9} y={gy - 58} width={14} height={2.5} fill="rgba(100,140,255,0.3)" rx="0.5" />
          <line x1={cx - 2} y1={gy - 58} x2={cx - 2} y2={gy - 55.5} stroke={s} strokeWidth="0.3" opacity="0.3" />
          {/* LED display panels */}
          <rect x={cx + 30} y={gy - 48} width={12} height={5} fill="rgba(120,160,255,0.3)" rx="0.5" />
          <rect x={cx + 30} y={gy - 40} width={12} height={5} fill="rgba(120,160,255,0.2)" rx="0.5" />
          {/* Data connection lines */}
          <line x1={cx - 28} y1={gy - 12} x2={cx - 10} y2={gy - 12} stroke={g[0]} strokeWidth="0.4" opacity="0.15" strokeDasharray="1 2" />
          <line x1={cx + 12} y1={gy - 16} x2={cx + 28} y2={gy - 16} stroke={g[0]} strokeWidth="0.4" opacity="0.15" strokeDasharray="1 2" />
          <line x1={cx - 44} y1={gy - 8} x2={cx - 28} y2={gy - 8} stroke={g[0]} strokeWidth="0.3" opacity="0.1" strokeDasharray="1 2" />
          {/* EV charging station */}
          <rect x={cx + 20} y={gy - 4} width="2" height="4" fill={g[0]} opacity="0.25" rx="0.3" />
          <circle cx={cx + 21} cy={gy - 5} r="0.8" fill="#4CAF50" opacity="0.4" />
          {/* Cars */}
          {car(cx - 52, gy + 1, '#4A90D9', 'tc1')}
          {car(cx - 5, gy + 1, '#666', 'tc2')}
          {car(cx + 38, gy + 1, '#E53935', 'tc3')}
          {/* Lamp posts */}
          {lampPost(cx - 58, gy, g[0], 'tl1')}
          {lampPost(cx - 20, gy, g[0], 'tl2')}
          {lampPost(cx + 22, gy, g[0], 'tl3')}
          {/* People */}
          {person(cx - 36, gy - 1, g[0], 'tp1')}
          {person(cx + 6, gy - 1, g[0], 'tp2')}
          {/* Ground plaza */}
          <rect x={cx - 58} y={gy} width={120} height={2} fill="rgba(0,0,0,0.04)" rx="0.3" />
        </g>
      );

    case 'MARKET_SQ':
      return (
        <g>
          {/* 8 market stalls with colored awnings */}
          <rect x={cx - 52} y={gy - 12} width={12} height={12} fill={f} />
          <path d={`M${cx-53},${gy-12} L${cx-46},${gy-19} L${cx-39},${gy-12}`} fill="#E74C8B" opacity="0.7" />
          <rect x={cx - 50} y={gy - 8} width={3} height={2.5} fill={WIN_COLOR} rx="0.2" />

          <rect x={cx - 36} y={gy - 14} width={12} height={14} fill={f} />
          <path d={`M${cx-37},${gy-14} L${cx-30},${gy-21} L${cx-23},${gy-14}`} fill="#FFD54F" opacity="0.8" />
          <rect x={cx - 34} y={gy - 10} width={3} height={2.5} fill={WIN_COLOR} rx="0.2" />

          <rect x={cx - 20} y={gy - 12} width={12} height={12} fill={f} />
          <path d={`M${cx-21},${gy-12} L${cx-14},${gy-19} L${cx-7},${gy-12}`} fill="#4CAF50" opacity="0.7" />
          <rect x={cx - 18} y={gy - 8} width={3} height={2.5} fill={WIN_COLOR} rx="0.2" />

          <rect x={cx - 4} y={gy - 14} width={12} height={14} fill={f} />
          <path d={`M${cx-5},${gy-14} L${cx+2},${gy-21} L${cx+9},${gy-14}`} fill="#4A90D9" opacity="0.7" />
          <rect x={cx - 2} y={gy - 10} width={3} height={2.5} fill={WIN_COLOR} rx="0.2" />

          <rect x={cx + 12} y={gy - 12} width={12} height={12} fill={f} />
          <path d={`M${cx+11},${gy-12} L${cx+18},${gy-19} L${cx+25},${gy-12}`} fill="#FF9800" opacity="0.7" />
          <rect x={cx + 14} y={gy - 8} width={3} height={2.5} fill={WIN_COLOR} rx="0.2" />

          <rect x={cx + 28} y={gy - 14} width={12} height={14} fill={f} />
          <path d={`M${cx+27},${gy-14} L${cx+34},${gy-21} L${cx+41},${gy-14}`} fill="#9C27B0" opacity="0.6" />
          <rect x={cx + 30} y={gy - 10} width={3} height={2.5} fill={WIN_COLOR} rx="0.2" />

          <rect x={cx + 44} y={gy - 12} width={11} height={12} fill={f} />
          <path d={`M${cx+43},${gy-12} L${cx+49.5},${gy-19} L${cx+56},${gy-12}`} fill="#E74C8B" opacity="0.6" />

          <rect x={cx - 64} y={gy - 12} width={10} height={12} fill={f} />
          <path d={`M${cx-65},${gy-12} L${cx-59},${gy-18} L${cx-53},${gy-12}`} fill="#4CAF50" opacity="0.6" />
          {/* Hanging lanterns */}
          <circle cx={cx - 46} cy={gy - 16} r="1.2" fill="#FFD54F" opacity="0.5" />
          <circle cx={cx - 14} cy={gy - 16} r="1.2" fill="#FFD54F" opacity="0.5" />
          <circle cx={cx + 18} cy={gy - 16} r="1.2" fill="#FFD54F" opacity="0.5" />
          {/* Central fountain */}
          <circle cx={cx - 8} cy={gy + 6} r="5" fill="none" stroke={g[0]} strokeWidth="0.5" opacity="0.2" />
          <circle cx={cx - 8} cy={gy + 6} r="3" fill="none" stroke={g[0]} strokeWidth="0.3" opacity="0.15" />
          <line x1={cx - 8} y1={gy + 6} x2={cx - 8} y2={gy + 1} stroke={g[0]} strokeWidth="0.6" opacity="0.2" />
          {/* Crates & barrels */}
          <circle cx={cx - 58} cy={gy - 4} r="2" fill={g[0]} opacity="0.2" />
          <circle cx={cx - 54} cy={gy - 4} r="1.5" fill={g[0]} opacity="0.18" />
          <rect x={cx + 8} y={gy - 3} width="3" height="3" fill={g[0]} opacity="0.2" rx="0.3" />
          <rect x={cx + 12} y={gy - 3} width="3" height="3" fill={g[1]} opacity="0.2" rx="0.3" />
          <rect x={cx + 40} y={gy - 4} width="3" height="3" fill={g[0]} opacity="0.15" rx="0.3" />
          {/* Cart with wheels */}
          <rect x={cx + 48} y={gy - 2} width={6} height={3} fill={g[1]} opacity="0.2" rx="0.3" />
          <circle cx={cx + 49.5} cy={gy + 1.5} r="0.8" fill={g[1]} opacity="0.2" />
          <circle cx={cx + 52.5} cy={gy + 1.5} r="0.8" fill={g[1]} opacity="0.2" />
          {/* People */}
          {person(cx - 48, gy - 1, g[0], 'mqp1')}
          {person(cx - 30, gy - 1, g[0], 'mqp2')}
          {person(cx + 22, gy - 1, g[0], 'mqp3')}
          {/* Benches */}
          {bench(cx - 62, gy + 2, g[1], 'mqb1')}
          {bench(cx + 38, gy + 2, g[1], 'mqb2')}
          {/* Cobblestone ground */}
          <line x1={cx - 68} y1={gy + 3} x2={cx + 58} y2={gy + 3} stroke={g[0]} strokeWidth="0.3" opacity="0.1" strokeDasharray="2 2" />
          <rect x={cx - 68} y={gy} width={126} height={2} fill="rgba(0,0,0,0.03)" rx="0.3" />
        </g>
      );

    case 'ENTERTAINMENT':
      return (
        <g>
          {/* Buildings */}
          {isoBox(cx - 38, gy, 14, 28, f, s, t, 'e0')}
          {isoBox(cx - 20, gy, 16, 32, f, s, t, 'e1')}
          {domeBox(cx + 0, gy, 20, 40, f, s, `${g[0]}AA`, 'e2')}
          {isoBox(cx + 24, gy, 14, 26, f, s, t, 'e3')}
          {isoBox(cx + 42, gy, 12, 20, f, s, t, 'e4')}
          {/* Ferris wheel */}
          <circle cx={cx - 48} cy={gy - 22} r="16" fill="none" stroke={g[0]} strokeWidth="0.8" opacity="0.25" />
          <circle cx={cx - 48} cy={gy - 22} r="2" fill={g[0]} opacity="0.3" />
          <line x1={cx - 48} y1={gy - 38} x2={cx - 48} y2={gy - 6} stroke={g[0]} strokeWidth="0.5" opacity="0.2" />
          <line x1={cx - 64} y1={gy - 22} x2={cx - 32} y2={gy - 22} stroke={g[0]} strokeWidth="0.5" opacity="0.2" />
          <line x1={cx - 59.3} y1={gy - 33.3} x2={cx - 36.7} y2={gy - 10.7} stroke={g[0]} strokeWidth="0.4" opacity="0.15" />
          <line x1={cx - 36.7} y1={gy - 33.3} x2={cx - 59.3} y2={gy - 10.7} stroke={g[0]} strokeWidth="0.4" opacity="0.15" />
          {/* Ferris wheel support */}
          <line x1={cx - 48} y1={gy - 6} x2={cx - 54} y2={gy} stroke={g[0]} strokeWidth="0.8" opacity="0.3" />
          <line x1={cx - 48} y1={gy - 6} x2={cx - 42} y2={gy} stroke={g[0]} strokeWidth="0.8" opacity="0.3" />
          {/* Marquee lights */}
          <rect x={cx + 2} y={gy - 44} width={16} height={4} fill={g[0]} opacity="0.5" rx="0.5" />
          <circle cx={cx + 4} cy={gy - 42} r="0.8" fill="#FFD54F" opacity="0.6" />
          <circle cx={cx + 7} cy={gy - 42} r="0.8" fill="#E53935" opacity="0.6" />
          <circle cx={cx + 10} cy={gy - 42} r="0.8" fill="#4FC3F7" opacity="0.6" />
          <circle cx={cx + 13} cy={gy - 42} r="0.8" fill="#FFD54F" opacity="0.6" />
          <circle cx={cx + 16} cy={gy - 42} r="0.8" fill="#E53935" opacity="0.6" />
          {/* Spotlights */}
          <circle cx={cx - 14} cy={gy - 38} r="1.5" fill={g[0]} opacity="0.4" />
          <circle cx={cx - 14} cy={gy - 38} r="3" fill={g[0]} opacity="0.1" />
          <circle cx={cx + 31} cy={gy - 32} r="1.2" fill={g[0]} opacity="0.35" />
          <circle cx={cx + 31} cy={gy - 32} r="2.5" fill={g[0]} opacity="0.08" />
          {/* Neon signs */}
          <line x1={cx - 18} y1={gy - 20} x2={cx - 6} y2={gy - 20} stroke="#E74C8B" strokeWidth="0.8" opacity="0.3" />
          <line x1={cx + 26} y1={gy - 16} x2={cx + 36} y2={gy - 16} stroke="#4FC3F7" strokeWidth="0.8" opacity="0.25" />
          {/* Ticket booth */}
          <rect x={cx + 54} y={gy - 8} width={6} height={8} fill={f} opacity="0.7" rx="0.3" />
          <rect x={cx + 54} y={gy - 10} width={6} height={2} fill={g[1]} opacity="0.5" rx="0.3" />
          {/* Stars */}
          <circle cx={cx - 30} cy={gy - 42} r="0.6" fill="#FFD54F" opacity="0.5" />
          <circle cx={cx + 45} cy={gy - 28} r="0.5" fill="#FFD54F" opacity="0.4" />
          <circle cx={cx + 18} cy={gy - 50} r="0.7" fill="#FFD54F" opacity="0.45" />
          {/* Lamp posts with glow */}
          {lampPost(cx - 60, gy, g[0], 'el1')}
          {lampPost(cx + 48, gy, g[0], 'el2')}
          {/* People */}
          {person(cx - 36, gy - 1, g[0], 'ep1')}
          {person(cx + 16, gy - 1, g[0], 'ep2')}
          {person(cx + 38, gy - 1, g[0], 'ep3')}
          {/* Ground */}
          <rect x={cx - 64} y={gy} width={126} height={2} fill="rgba(0,0,0,0.04)" rx="0.3" />
        </g>
      );

    case 'UNIVERSITY':
      return (
        <g>
          {/* Buildings — main hall, chapel, dorms, library */}
          {domeBox(cx - 26, gy, 24, 30, f, s, `${g[0]}BB`, 'u1')}
          {pointedBox(cx + 4, gy, 14, 24, f, s, g[1], 'u2')}
          {isoBox(cx + 24, gy, 14, 18, f, s, t, 'u3')}
          {isoBox(cx - 50, gy, 16, 16, f, s, t, 'u4')}
          {pointedBox(cx + 42, gy, 12, 14, f, s, g[1], 'u5')}
          {/* Grand columns */}
          <line x1={cx - 21} y1={gy} x2={cx - 21} y2={gy - 26} stroke={g[0]} strokeWidth="1.2" opacity="0.4" />
          <line x1={cx - 15} y1={gy} x2={cx - 15} y2={gy - 26} stroke={g[0]} strokeWidth="1.2" opacity="0.4" />
          <line x1={cx - 9} y1={gy} x2={cx - 9} y2={gy - 26} stroke={g[0]} strokeWidth="1.2" opacity="0.4" />
          <line x1={cx - 3} y1={gy} x2={cx - 3} y2={gy - 26} stroke={g[0]} strokeWidth="1.2" opacity="0.4" />
          {/* Flag on pole */}
          <rect x={cx + 10} y={gy - 44} width="1" height="20" fill={g[1]} opacity="0.5" />
          <polygon points={`${cx+11},${gy-44} ${cx+18},${gy-41} ${cx+11},${gy-38}`} fill={g[0]} opacity="0.4" />
          {/* Sports field outline */}
          <rect x={cx - 56} y={gy + 6} width={28} height={16} fill="none" stroke={g[0]} strokeWidth="0.4" opacity="0.15" rx="0.5" />
          <line x1={cx - 42} y1={gy + 6} x2={cx - 42} y2={gy + 22} stroke={g[0]} strokeWidth="0.3" opacity="0.12" />
          <circle cx={cx - 42} cy={gy + 14} r="3" fill="none" stroke={g[0]} strokeWidth="0.3" opacity="0.1" />
          {/* Statue on pedestal */}
          <rect x={cx - 34} y={gy - 4} width="3" height="3" fill={g[0]} opacity="0.2" rx="0.3" />
          {person(cx - 32.5, gy - 9, g[0], 'us1')}
          {/* Book stack */}
          <rect x={cx + 26} y={gy - 8} width={8} height={2} fill={g[0]} opacity="0.2" rx="0.3" />
          <rect x={cx + 27} y={gy - 10} width={7} height={2} fill={g[0]} opacity="0.18" rx="0.3" />
          <rect x={cx + 26} y={gy - 12} width={6} height={2} fill={g[0]} opacity="0.15" rx="0.3" />
          {/* Lamppost + bench */}
          {lampPost(cx - 38, gy, g[0], 'ul1')}
          {bench(cx - 44, gy - 1, g[1], 'ub1')}
          {/* Bicycle rack */}
          <line x1={cx + 36} y1={gy - 2} x2={cx + 36} y2={gy - 4} stroke={g[0]} strokeWidth="0.4" opacity="0.2" />
          <line x1={cx + 38} y1={gy - 2} x2={cx + 38} y2={gy - 4} stroke={g[0]} strokeWidth="0.4" opacity="0.2" />
          <line x1={cx + 40} y1={gy - 2} x2={cx + 40} y2={gy - 4} stroke={g[0]} strokeWidth="0.4" opacity="0.2" />
          <line x1={cx + 35} y1={gy - 3} x2={cx + 41} y2={gy - 3} stroke={g[0]} strokeWidth="0.4" opacity="0.2" />
          {/* People (students) */}
          {person(cx - 30, gy - 1, g[0], 'up1')}
          {person(cx + 16, gy - 1, g[0], 'up2')}
          {person(cx + 36, gy - 1, g[0], 'up3')}
          {/* Trees */}
          {miniTree(cx + 50, gy - 4, g[0], 'ut1')}
          {miniTree(cx - 56, gy - 4, g[0], 'ut2')}
          {/* Ground */}
          <rect x={cx - 58} y={gy} width={116} height={2} fill="rgba(0,0,0,0.04)" rx="0.3" />
        </g>
      );

    case 'HARBOR':
      return (
        <g>
          {/* Warehouse buildings */}
          {isoBox(cx - 46, gy, 22, 18, f, s, t, 'h1')}
          {isoBox(cx - 20, gy, 18, 16, f, s, t, 'h2')}
          {isoBox(cx + 2, gy, 20, 14, f, s, t, 'h3')}
          {isoBox(cx - 58, gy, 10, 12, f, s, t, 'h4')}
          {/* Crane 1 */}
          <rect x={cx + 24} y={gy - 46} width="2.5" height="46" fill={g[0]} opacity="0.8" />
          <line x1={cx + 25} y1={gy - 46} x2={cx + 48} y2={gy - 40} stroke={g[0]} strokeWidth="1.5" opacity="0.7" />
          <line x1={cx + 25} y1={gy - 46} x2={cx + 18} y2={gy - 42} stroke={g[0]} strokeWidth="1" opacity="0.5" />
          <line x1={cx + 43} y1={gy - 41} x2={cx + 43} y2={gy - 26} stroke={g[0]} strokeWidth="0.6" opacity="0.5" />
          <rect x={cx + 41} y={gy - 26} width={4} height={3} fill={g[0]} opacity="0.5" />
          {/* Crane 2 */}
          <rect x={cx + 54} y={gy - 38} width="2" height="38" fill={g[0]} opacity="0.6" />
          <line x1={cx + 55} y1={gy - 38} x2={cx + 68} y2={gy - 34} stroke={g[0]} strokeWidth="1.2" opacity="0.5" />
          <line x1={cx + 64} y1={gy - 35} x2={cx + 64} y2={gy - 20} stroke={g[0]} strokeWidth="0.5" opacity="0.4" />
          <rect x={cx + 62} y={gy - 20} width={4} height={3} fill={g[0]} opacity="0.4" />
          {/* Cargo ship */}
          <polygon points={`${cx+26},${gy+10} ${cx+30},${gy+6} ${cx+56},${gy+6} ${cx+60},${gy+10}`} fill={g[1]} opacity="0.4" />
          <rect x={cx + 32} y={gy + 2} width={20} height={4} fill={g[0]} opacity="0.3" rx="0.3" />
          <rect x={cx + 36} y={gy - 1} width={6} height={3} fill={g[1]} opacity="0.25" rx="0.3" />
          {/* Containers — 2 rows */}
          <rect x={cx + 24} y={gy - 6} width={8} height={6} fill="#E53935" opacity="0.5" rx="0.3" />
          <rect x={cx + 34} y={gy - 6} width={8} height={6} fill="#4A90D9" opacity="0.5" rx="0.3" />
          <rect x={cx + 44} y={gy - 6} width={8} height={6} fill="#4CAF50" opacity="0.45" rx="0.3" />
          <rect x={cx + 54} y={gy - 6} width={8} height={6} fill="#FF9800" opacity="0.5" rx="0.3" />
          <rect x={cx + 27} y={gy - 12} width={8} height={6} fill="#9C27B0" opacity="0.4" rx="0.3" />
          <rect x={cx + 37} y={gy - 12} width={8} height={6} fill="#E53935" opacity="0.35" rx="0.3" />
          <rect x={cx + 47} y={gy - 12} width={8} height={6} fill="#4A90D9" opacity="0.4" rx="0.3" />
          <rect x={cx + 57} y={gy - 12} width={8} height={6} fill="#4CAF50" opacity="0.35" rx="0.3" />
          {/* Dock platforms */}
          <rect x={cx + 20} y={gy - 2} width={50} height={2} fill={g[0]} opacity="0.4" rx="0.3" />
          <rect x={cx + 24} y={gy + 4} width={40} height={1.5} fill={g[0]} opacity="0.3" rx="0.3" />
          {/* Bollards */}
          <rect x={cx + 22} y={gy - 4} width="1.5" height="3" fill={g[1]} opacity="0.3" rx="0.3" />
          <rect x={cx + 40} y={gy - 4} width="1.5" height="3" fill={g[1]} opacity="0.3" rx="0.3" />
          <rect x={cx + 58} y={gy - 4} width="1.5" height="3" fill={g[1]} opacity="0.3" rx="0.3" />
          {/* Forklift */}
          <rect x={cx + 4} y={gy - 4} width={4} height={3} fill={g[0]} opacity="0.25" rx="0.3" />
          <rect x={cx + 3} y={gy - 6} width={2} height={5} fill={g[0]} opacity="0.2" />
          <circle cx={cx + 5} cy={gy - 0.5} r="0.6" fill="#333" opacity="0.3" />
          <circle cx={cx + 7} cy={gy - 0.5} r="0.6" fill="#333" opacity="0.3" />
          {/* People (workers) */}
          {person(cx - 10, gy - 1, g[0], 'hp1')}
          {person(cx + 14, gy - 1, g[0], 'hp2')}
          {/* Crane bases */}
          <rect x={cx + 20} y={gy - 2} width={10} height={2} fill={g[0]} opacity="0.4" rx="0.3" />
          <rect x={cx + 50} y={gy - 2} width={8} height={2} fill={g[0]} opacity="0.3" rx="0.3" />
        </g>
      );

    case 'INDUSTRIAL':
      return (
        <g>
          {/* Factory buildings */}
          {isoBox(cx - 42, gy, 22, 24, f, s, t, 'i1')}
          {isoBox(cx - 14, gy, 20, 22, f, s, t, 'i2')}
          {isoBox(cx + 12, gy, 24, 18, f, s, t, 'i3')}
          {isoBox(cx + 40, gy, 18, 20, f, s, t, 'i4')}
          {isoBox(cx - 56, gy, 12, 14, f, s, t, 'i5')}
          {/* Smokestacks */}
          <rect x={cx - 38} y={gy - 40} width="3" height="16" fill={g[1]} opacity="0.8" />
          <rect x={cx - 30} y={gy - 36} width="3" height="12" fill={g[1]} opacity="0.7" />
          <rect x={cx - 8} y={gy - 38} width="3" height="16" fill={g[1]} opacity="0.75" />
          {/* Smoke puffs */}
          <ellipse cx={cx - 36.5} cy={gy - 43} rx="5" ry="2.5" fill={g[0]} opacity="0.08" />
          <ellipse cx={cx - 34} cy={gy - 46} rx="4" ry="2" fill={g[0]} opacity="0.05" />
          <ellipse cx={cx - 28.5} cy={gy - 39} rx="4" ry="2" fill={g[0]} opacity="0.06" />
          <ellipse cx={cx - 6.5} cy={gy - 41} rx="4.5" ry="2.2" fill={g[0]} opacity="0.07" />
          <ellipse cx={cx - 4} cy={gy - 44} rx="3.5" ry="1.8" fill={g[0]} opacity="0.04" />
          {/* Cooling tower */}
          <rect x={cx + 62} y={gy - 20} width="10" height="20" fill={g[0]} opacity="0.3" rx="3" />
          <ellipse cx={cx + 67} cy={gy - 20} rx="5" ry="2.5" fill={g[0]} opacity="0.2" />
          <ellipse cx={cx + 67} cy={gy - 22} rx="3" ry="1.5" fill={g[0]} opacity="0.08" />
          {/* Pipes connecting buildings */}
          <line x1={cx - 20} y1={gy - 16} x2={cx - 14} y2={gy - 14} stroke={g[0]} strokeWidth="1.2" opacity="0.3" />
          <line x1={cx + 6} y1={gy - 14} x2={cx + 12} y2={gy - 12} stroke={g[0]} strokeWidth="1.2" opacity="0.3" />
          <line x1={cx + 36} y1={gy - 12} x2={cx + 40} y2={gy - 10} stroke={g[0]} strokeWidth="1" opacity="0.25" />
          {/* Power lines */}
          <rect x={cx + 74} y={gy - 28} width="1.5" height="28" fill={g[1]} opacity="0.3" />
          <rect x={cx + 84} y={gy - 28} width="1.5" height="28" fill={g[1]} opacity="0.3" />
          <line x1={cx + 75} y1={gy - 25} x2={cx + 85} y2={gy - 25} stroke={g[1]} strokeWidth="0.5" opacity="0.25" />
          <line x1={cx + 75} y1={gy - 22} x2={cx + 85} y2={gy - 22} stroke={g[1]} strokeWidth="0.5" opacity="0.2" />
          {/* Garage doors */}
          <rect x={cx + 18} y={gy - 8} width={8} height={8} fill="rgba(0,0,0,0.12)" rx="0.3" />
          <rect x={cx + 44} y={gy - 7} width={7} height={7} fill="rgba(0,0,0,0.10)" rx="0.3" />
          {/* Storage tanks */}
          <rect x={cx - 50} y={gy - 10} width="6" height="10" fill={g[0]} opacity="0.25" rx="3" />
          <ellipse cx={cx - 47} cy={gy - 10} rx="3" ry="1.5" fill={g[0]} opacity="0.15" />
          {/* Chain-link fence */}
          <line x1={cx - 60} y1={gy + 3} x2={cx + 78} y2={gy + 3} stroke={g[0]} strokeWidth="0.4" opacity="0.12" strokeDasharray="1 1.5" />
          {/* Truck */}
          {car(cx + 30, gy + 1, '#5D4037', 'it1')}
          <rect x={cx + 25} y={gy} width={5} height={3} fill={g[0]} opacity="0.2" rx="0.3" />
          {/* People (workers) */}
          {person(cx - 10, gy - 1, g[0], 'ip1')}
          {person(cx + 50, gy - 1, g[0], 'ip2')}
        </g>
      );

    case 'SUBURBS_N':
      return (
        <g>
          {/* Houses — 6 varied */}
          {pointedBox(cx - 50, gy, 13, 14, f, s, g[1], 's0')}
          {pointedBox(cx - 34, gy, 14, 16, f, s, g[1], 's1')}
          {pointedBox(cx - 14, gy, 12, 12, f, s, g[1], 's2')}
          {pointedBox(cx + 2, gy, 15, 18, f, s, g[1], 's3')}
          {pointedBox(cx + 22, gy, 12, 13, f, s, g[1], 's4')}
          {pointedBox(cx + 38, gy, 13, 14, f, s, g[1], 's5')}
          {/* Trees near houses */}
          {miniTree(cx - 26, gy - 4, '#4CAF50', 'st1')}
          {miniTree(cx - 6, gy - 4, '#66BB6A', 'st2')}
          {miniTree(cx + 34, gy - 4, '#4CAF50', 'st3')}
          {miniTree(cx + 54, gy - 4, '#43A047', 'st4')}
          {/* Fences between properties */}
          <line x1={cx - 36} y1={gy + 1} x2={cx - 36} y2={gy - 3} stroke={g[1]} strokeWidth="0.4" opacity="0.2" />
          <line x1={cx - 36} y1={gy - 1} x2={cx - 16} y2={gy - 1} stroke={g[1]} strokeWidth="0.3" opacity="0.15" />
          <line x1={cx + 19} y1={gy + 1} x2={cx + 19} y2={gy - 3} stroke={g[1]} strokeWidth="0.4" opacity="0.2" />
          <line x1={cx + 19} y1={gy - 1} x2={cx + 36} y2={gy - 1} stroke={g[1]} strokeWidth="0.3" opacity="0.15" />
          <line x1={cx - 2} y1={gy + 1} x2={cx - 2} y2={gy - 3} stroke={g[1]} strokeWidth="0.4" opacity="0.2" />
          {/* Mailboxes */}
          <rect x={cx - 44} y={gy - 4} width="1.5" height="4" fill={g[1]} opacity="0.3" />
          <rect x={cx - 45} y={gy - 5} width="3.5" height="2" fill="#3B82F6" opacity="0.3" rx="0.3" />
          <rect x={cx + 14} y={gy - 4} width="1.5" height="4" fill={g[1]} opacity="0.3" />
          <rect x={cx + 13} y={gy - 5} width="3.5" height="2" fill="#E53935" opacity="0.3" rx="0.3" />
          {/* Playground — swing set */}
          <line x1={cx - 58} y1={gy - 8} x2={cx - 58} y2={gy} stroke={g[0]} strokeWidth="0.6" opacity="0.25" />
          <line x1={cx - 52} y1={gy - 8} x2={cx - 52} y2={gy} stroke={g[0]} strokeWidth="0.6" opacity="0.25" />
          <line x1={cx - 59} y1={gy - 8} x2={cx - 51} y2={gy - 8} stroke={g[0]} strokeWidth="0.6" opacity="0.25" />
          <line x1={cx - 56} y1={gy - 7.5} x2={cx - 55} y2={gy - 3} stroke={g[0]} strokeWidth="0.3" opacity="0.2" />
          <line x1={cx - 54} y1={gy - 7.5} x2={cx - 55} y2={gy - 3} stroke={g[0]} strokeWidth="0.3" opacity="0.2" />
          {/* Driveways */}
          <rect x={cx - 32} y={gy} width={8} height={3} fill={g[0]} opacity="0.06" rx="0.3" />
          <rect x={cx + 4} y={gy} width={8} height={3} fill={g[0]} opacity="0.06" rx="0.3" />
          {/* Car in driveway */}
          {car(cx + 5, gy + 1, '#4A90D9', 'sc1')}
          {/* Lamp posts */}
          {lampPost(cx - 42, gy, g[0], 'sl1')}
          {lampPost(cx + 18, gy, g[0], 'sl2')}
          {/* Person walking dog */}
          {person(cx - 46, gy - 1, g[0], 'sp1')}
          <circle cx={cx - 43} cy={gy + 1} r="0.8" fill={g[0]} opacity="0.25" />
          <circle cx={cx - 43.5} cy={gy + 2} r="0.5" fill={g[0]} opacity="0.2" />
          {/* Dog park outline */}
          <rect x={cx + 52} y={gy + 2} width={12} height={8} fill="none" stroke={g[0]} strokeWidth="0.3" opacity="0.1" rx="0.5" />
          {/* Ground */}
          <line x1={cx - 60} y1={gy + 4} x2={cx + 56} y2={gy + 4} stroke={g[0]} strokeWidth="0.3" opacity="0.1" />
        </g>
      );

    case 'SUBURBS_S':
      return (
        <g>
          {/* Houses + community center */}
          {pointedBox(cx - 40, gy, 12, 12, f, s, g[1], 'ss0')}
          {pointedBox(cx - 24, gy, 14, 16, f, s, g[1], 'ss1')}
          {pointedBox(cx - 6, gy, 12, 14, f, s, g[1], 'ss2')}
          {isoBox(cx + 10, gy, 18, 18, f, s, t, 'ss3')}
          {pointedBox(cx + 32, gy, 12, 14, f, s, g[1], 'ss4')}
          {/* Community center sign */}
          <rect x={cx + 12} y={gy - 22} width={14} height={3} fill={g[0]} opacity="0.3" rx="0.5" />
          {/* Basketball hoop */}
          <line x1={cx + 48} y1={gy} x2={cx + 48} y2={gy - 10} stroke={g[0]} strokeWidth="0.6" opacity="0.25" />
          <rect x={cx + 47} y={gy - 11} width="3" height="2" fill={g[0]} opacity="0.2" rx="0.2" />
          <circle cx={cx + 48.5} cy={gy - 8} r="1.5" fill="none" stroke={g[0]} strokeWidth="0.4" opacity="0.2" />
          {/* Trees */}
          {miniTree(cx - 44, gy - 4, '#4CAF50', 'sst1')}
          {miniTree(cx - 16, gy - 4, '#66BB6A', 'sst2')}
          {miniTree(cx + 44, gy - 4, '#43A047', 'sst3')}
          {/* Bushes */}
          <circle cx={cx - 50} cy={gy - 3} r="3.5" fill={g[0]} opacity="0.25" />
          <circle cx={cx - 46} cy={gy - 2} r="2.5" fill={g[0]} opacity="0.18" />
          <circle cx={cx + 52} cy={gy - 3} r="4" fill={g[0]} opacity="0.2" />
          {/* Park bench */}
          {bench(cx + 38, gy - 1, g[1], 'ssb1')}
          {/* Walking path */}
          <line x1={cx - 40} y1={gy + 3} x2={cx + 52} y2={gy + 3} stroke={g[0]} strokeWidth="0.4" opacity="0.1" strokeDasharray="3 2" />
          {/* People */}
          {person(cx - 30, gy - 1, g[0], 'ssp1')}
          {person(cx + 22, gy - 1, g[0], 'ssp2')}
          {/* Bicycle */}
          <circle cx={cx + 6} cy={gy + 1} r="1.2" fill="none" stroke={g[0]} strokeWidth="0.3" opacity="0.2" />
          <circle cx={cx + 9} cy={gy + 1} r="1.2" fill="none" stroke={g[0]} strokeWidth="0.3" opacity="0.2" />
          <line x1={cx + 6} y1={gy + 1} x2={cx + 7.5} y2={gy - 1} stroke={g[0]} strokeWidth="0.3" opacity="0.2" />
          <line x1={cx + 7.5} y1={gy - 1} x2={cx + 9} y2={gy + 1} stroke={g[0]} strokeWidth="0.3" opacity="0.2" />
          {/* Ground */}
          <rect x={cx - 52} y={gy} width={108} height={2} fill="rgba(0,0,0,0.03)" rx="0.3" />
        </g>
      );

    case 'OUTSKIRTS':
      return (
        <g>
          {/* Farmhouse */}
          {pointedBox(cx - 28, gy, 16, 18, f, s, g[1], 'out1')}
          {/* Barn */}
          {isoBox(cx - 6, gy, 16, 14, f, s, t, 'out2')}
          <rect x={cx - 2} y={gy - 6} width={8} height={6} fill="rgba(0,0,0,0.1)" rx="0.3" />
          {/* Windmill */}
          <rect x={cx + 26} y={gy - 30} width="4" height="30" fill={g[0]} opacity="0.7" />
          <circle cx={cx + 28} cy={gy - 30} r="1.8" fill={g[1]} opacity="0.6" />
          <line x1={cx + 28} y1={gy - 30} x2={cx + 28} y2={gy - 42} stroke={g[0]} strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
          <line x1={cx + 28} y1={gy - 30} x2={cx + 38} y2={gy - 26} stroke={g[0]} strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
          <line x1={cx + 28} y1={gy - 30} x2={cx + 18} y2={gy - 26} stroke={g[0]} strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
          <line x1={cx + 28} y1={gy - 30} x2={cx + 32} y2={gy - 20} stroke={g[0]} strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
          {/* Silo */}
          <rect x={cx + 14} y={gy - 18} width="5" height="18" fill={g[0]} opacity="0.3" rx="2.5" />
          <ellipse cx={cx + 16.5} cy={gy - 18} rx="2.5" ry="1.5" fill={g[0]} opacity="0.2" />
          {/* Farm field lines */}
          <line x1={cx - 48} y1={gy + 4} x2={cx - 16} y2={gy + 4} stroke={g[0]} strokeWidth="0.3" opacity="0.12" />
          <line x1={cx - 46} y1={gy + 7} x2={cx - 18} y2={gy + 7} stroke={g[0]} strokeWidth="0.3" opacity="0.10" />
          <line x1={cx - 44} y1={gy + 10} x2={cx - 20} y2={gy + 10} stroke={g[0]} strokeWidth="0.3" opacity="0.08" />
          <line x1={cx - 42} y1={gy + 13} x2={cx - 22} y2={gy + 13} stroke={g[0]} strokeWidth="0.3" opacity="0.06" />
          <line x1={cx - 40} y1={gy + 16} x2={cx - 24} y2={gy + 16} stroke={g[0]} strokeWidth="0.3" opacity="0.05" />
          <line x1={cx - 38} y1={gy + 19} x2={cx - 26} y2={gy + 19} stroke={g[0]} strokeWidth="0.3" opacity="0.04" />
          {/* Hay bales */}
          <ellipse cx={cx + 38} cy={gy - 2} rx="4" ry="3" fill="#C8956A" opacity="0.3" />
          <ellipse cx={cx + 46} cy={gy - 2} rx="3.5" ry="2.5" fill="#D4A574" opacity="0.25" />
          <ellipse cx={cx + 42} cy={gy - 5} rx="3" ry="2" fill="#C8956A" opacity="0.2" />
          {/* Fence posts */}
          <rect x={cx - 52} y={gy - 3} width="1" height="3" fill="#5D4037" opacity="0.2" />
          <rect x={cx - 45} y={gy - 3} width="1" height="3" fill="#5D4037" opacity="0.2" />
          <rect x={cx - 38} y={gy - 3} width="1" height="3" fill="#5D4037" opacity="0.2" />
          <line x1={cx - 52} y1={gy - 1.5} x2={cx - 38} y2={gy - 1.5} stroke="#5D4037" strokeWidth="0.4" opacity="0.18" />
          <line x1={cx - 52} y1={gy - 0.5} x2={cx - 38} y2={gy - 0.5} stroke="#5D4037" strokeWidth="0.4" opacity="0.15" />
          {/* Farm animals */}
          <ellipse cx={cx - 36} cy={gy + 8} rx="1.5" ry="1" fill={g[0]} opacity="0.18" />
          <circle cx={cx - 34.5} cy={gy + 7.2} r="0.6" fill={g[0]} opacity="0.15" />
          <ellipse cx={cx - 30} cy={gy + 10} rx="1.2" ry="0.8" fill={g[0]} opacity="0.15" />
          <ellipse cx={cx - 26} cy={gy + 7} rx="1.3" ry="0.9" fill={g[0]} opacity="0.16" />
          {/* Tractor */}
          <rect x={cx + 4} y={gy + 4} width={6} height={3.5} fill="#E53935" opacity="0.25" rx="0.5" />
          <rect x={cx + 1} y={gy + 4.5} width={3} height={2.5} fill="#333" opacity="0.15" rx="0.3" />
          <circle cx={cx + 3} cy={gy + 8} r="1.5" fill="#333" opacity="0.2" />
          <circle cx={cx + 8} cy={gy + 8} r="1" fill="#333" opacity="0.2" />
          {/* Pond */}
          <ellipse cx={cx + 50} cy={gy + 12} rx="8" ry="5" fill="#4FC3F7" opacity="0.15" />
          <ellipse cx={cx + 50} cy={gy + 12} rx="6" ry="3.5" fill="#81D4FA" opacity="0.08" />
          {/* Trees */}
          {miniTree(cx - 16, gy - 4, '#4CAF50', 'outt1')}
          {miniTree(cx + 42, gy - 4, '#66BB6A', 'outt2')}
        </g>
      );

    default:
      return null;
  }
}

export function CityMap({ onDistrictSelect, selectedCode }: CityMapProps) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [flashCode, setFlashCode] = useState<string | null>(null);

  const handleDistrictClick = useCallback((d: DistrictMeta) => {
    setFlashCode(d.code);
    setTimeout(() => setFlashCode(null), 400);
    onDistrictSelect?.(d);
  }, [onDistrictSelect]);

  const centers = Object.fromEntries(
    DISTRICTS.map((d) => [d.code, getPolygonCenter(d.points)])
  );

  return (
    <div
      className="w-full aspect-[4/3] relative rounded-xl overflow-hidden"
      style={{
        touchAction: 'pan-y',
        boxShadow:
          '0 0 20px rgba(124, 179, 66, 0.3), 0 0 60px rgba(124, 179, 66, 0.1), inset 0 1px 0 hsl(210 20% 90% / 0.05)',
      }}
    >
      <svg
        viewBox="0 0 800 600"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* ── Filters ── */}
          <filter id="district-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="icon-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="building-shadow" x="-10%" y="-10%" width="130%" height="140%">
            <feDropShadow dx="2" dy="3" stdDeviation="2" floodColor="#33691E" floodOpacity="0.3" />
          </filter>

          {/* ── Per-district gradients ── */}
          {DISTRICTS.map((d) => (
            <linearGradient key={`grad-${d.code}`} id={`grad-${d.code}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={d.gradient[0]} stopOpacity="0.7" />
              <stop offset="100%" stopColor={d.gradient[1]} stopOpacity="0.85" />
            </linearGradient>
          ))}

          {/* ── Interaction animations ── */}
          <style>{`
            @keyframes district-pop {
              0% { transform: scale(1); }
              40% { transform: scale(1.04); }
              100% { transform: scale(1.02); }
            }
            @keyframes flash-overlay {
              0% { opacity: 0; }
              25% { opacity: 0.2; }
              100% { opacity: 0; }
            }
            @keyframes glow-pulse {
              0%, 100% { filter: drop-shadow(0 0 6px #FFD54F80); }
              50% { filter: drop-shadow(0 0 14px #FFD54FCC); }
            }
          `}</style>
        </defs>

        {/* ═══ Terrain background ═══ */}
        <TerrainBackground />

        {/* ═══ Road network ═══ */}
        <RoadNetwork centers={centers} />

        {/* ═══ Districts ═══ */}
        {DISTRICTS.map((d, idx) => {
          const isSelected = selectedCode === d.code;
          const isHovered = hoveredCode === d.code;
          const isFlashing = flashCode === d.code;
          const isActive = isSelected || isHovered;
          const center = centers[d.code];
          const anyHovered = hoveredCode !== null;
          const anySelected = selectedCode != null;

          // Dimming: when one is hovered, dim others to 0.7; when one is selected, dim others to 0.35
          const dimOpacity = isActive
            ? 1
            : anySelected
              ? 0.35
              : anyHovered
                ? 0.7
                : 1;

          return (
            <g
              key={d.code}
              style={{
                opacity: dimOpacity,
                transition: 'transform 200ms ease, opacity 300ms ease',
                transform: isHovered && !isSelected ? 'scale(1.02)' : 'scale(1)',
                transformOrigin: center ? `${center.x}px ${center.y}px` : 'center',
                ...(isFlashing ? { animation: 'district-pop 350ms ease-out' } : {}),
              }}
            >
              {/* District ground terrain */}
              <DistrictGround
                points={d.points}
                terrain={d.terrain}
                gradient={d.gradient}
                code={d.code}
                isActive={isActive}
              />

              {/* 3D isometric building scene */}
              {center && (
                <g
                  className="pointer-events-none"
                  filter="url(#building-shadow)"
                  style={{
                    filter: isSelected
                      ? 'url(#building-shadow) brightness(1.15)'
                      : 'url(#building-shadow)',
                  }}
                >
                  {renderDistrictScene(d.code, center.x, center.y, d.gradient)}
                </g>
              )}

              {/* Flash overlay on click */}
              {isFlashing && (
                <polygon
                  points={d.points}
                  fill="white"
                  className="pointer-events-none"
                  style={{ animation: 'flash-overlay 400ms ease-out forwards' }}
                />
              )}

              {/* Border */}
              <polygon
                points={d.points}
                fill="none"
                stroke={
                  isSelected
                    ? '#FFD54F'
                    : isHovered
                      ? '#FFF176'
                      : d.stroke
                }
                strokeWidth={isSelected ? 3 : isHovered ? 2 : 0.4}
                opacity={isSelected ? 1 : isHovered ? 0.8 : 0}
                className="pointer-events-none"
                style={{
                  transition: 'stroke 300ms ease, stroke-width 300ms ease, opacity 300ms ease',
                  ...(isSelected ? { animation: 'glow-pulse 2s infinite' } : {}),
                }}
              />

              {/* Clickable transparent overlay — catches all mouse/touch events */}
              <polygon
                points={d.points}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredCode(d.code)}
                onMouseLeave={() => setHoveredCode(null)}
                onClick={() => handleDistrictClick(d)}
              />

              {/* District icon — positioned via SVG transform, animated via CSS on inner g */}
              {center && (
                <g
                  transform={`translate(${center.x - 14}, ${center.y - 22})`}
                  className="pointer-events-none"
                >
                  <g
                    className={isActive ? '' : 'animate-icon-float'}
                    style={{
                      animationDelay: `${(idx * 0.4) % 3}s`,
                      opacity: isActive ? 1 : 0.7,
                      filter: isActive ? 'url(#icon-glow)' : 'none',
                    }}
                  >
                    <g style={{ transform: 'scale(1.15)', transformOrigin: '12px 12px' }}>
                      {DISTRICT_ICONS[d.icon]?.(isActive ? '#fff' : d.gradient[0])}
                    </g>
                  </g>
                </g>
              )}

              {/* Label below icon */}
              {center && (
                <text
                  x={center.x}
                  y={center.y + 8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="pointer-events-none select-none"
                  style={{
                    fill: isActive ? '#fff' : '#3E2723',
                    fontSize: isActive ? '9px' : '8px',
                    fontWeight: isActive ? 700 : 600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase' as const,
                    textShadow: isActive
                      ? `0 0 10px ${d.gradient[0]}80, 0 1px 4px rgba(0,0,0,0.7)`
                      : '0 1px 2px rgba(255,255,255,0.5)',
                    transition: 'fill 300ms ease, font-size 300ms ease',
                  }}
                >
                  {d.name.length > 14 ? d.code.replace(/_/g, ' ') : d.name}
                </text>
              )}
            </g>
          );
        })}

        {/* ═══ Map decorations (clouds, compass, title) ═══ */}
        <MapDecorations />
      </svg>
    </div>
  );
}

function getPolygonCenter(points: string): { x: number; y: number } {
  const coords = points.split(' ').map((p) => {
    const [x, y] = p.split(',').map(Number);
    return { x, y };
  });
  const x = coords.reduce((sum, c) => sum + c.x, 0) / coords.length;
  const y = coords.reduce((sum, c) => sum + c.y, 0) / coords.length;
  return { x, y };
}
