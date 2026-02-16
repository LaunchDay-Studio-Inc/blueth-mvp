'use client';

import { useState } from 'react';
import { DISTRICTS, type DistrictMeta } from '@/lib/districts';

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

// ── Per-district building scenes ──────────────────────

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
          {isoBox(cx - 40, gy, 13, 52, f, s, t, 'c1')}
          {isoBox(cx - 22, gy, 16, 70, f, s, t, 'c2')}
          {isoBox(cx + 0, gy, 12, 44, f, s, t, 'c3')}
          {isoBox(cx + 16, gy, 15, 62, f, s, t, 'c4')}
          {isoBox(cx + 35, gy, 11, 36, f, s, t, 'c5')}
          {/* Antennas */}
          <line x1={cx - 14} y1={gy - 70} x2={cx - 14} y2={gy - 80} stroke={g[0]} strokeWidth="0.8" />
          <circle cx={cx - 14} cy={gy - 81} r="1.2" fill={g[0]} opacity="0.8" />
          <line x1={cx + 23} y1={gy - 62} x2={cx + 23} y2={gy - 70} stroke={g[0]} strokeWidth="0.6" />
          <circle cx={cx + 23} cy={gy - 71} r="0.9" fill={g[0]} opacity="0.6" />
          {/* Helipad circle on roof */}
          <circle cx={cx + 6} cy={gy - 45} r="3" fill="none" stroke={g[0]} strokeWidth="0.4" opacity="0.3" />
        </g>
      );

    case 'OLD_TOWN':
      return (
        <g>
          {pointedBox(cx - 36, gy, 14, 20, f, s, g[1], 'o1')}
          {pointedBox(cx - 16, gy, 13, 18, f, s, g[1], 'o2')}
          {pointedBox(cx + 2, gy, 11, 34, f, s, g[1], 'o3', 16)}
          {pointedBox(cx + 18, gy, 15, 22, f, s, g[1], 'o4')}
          {pointedBox(cx + 36, gy, 12, 16, f, s, g[1], 'o5')}
          {/* Church cross */}
          <line x1={cx + 7.5} y1={gy - 51} x2={cx + 7.5} y2={gy - 56} stroke={g[0]} strokeWidth="0.8" />
          <line x1={cx + 5.5} y1={gy - 54} x2={cx + 9.5} y2={gy - 54} stroke={g[0]} strokeWidth="0.8" />
          {/* Cobblestone hint */}
          <line x1={cx - 40} y1={gy + 3} x2={cx + 50} y2={gy + 3} stroke={g[0]} strokeWidth="0.4" opacity="0.15" strokeDasharray="2 2" />
        </g>
      );

    case 'MARINA':
      return (
        <g>
          {isoBox(cx - 32, gy, 18, 20, f, s, t, 'm1')}
          {isoBox(cx - 8, gy, 15, 24, f, s, t, 'm2')}
          {isoBox(cx + 14, gy, 20, 18, f, s, t, 'm3')}
          {/* Pier/dock */}
          <rect x={cx + 38} y={gy - 2} width={20} height={2} fill={g[0]} opacity="0.5" rx="0.3" />
          <rect x={cx + 40} y={gy} width={1.5} height={5} fill={g[1]} opacity="0.4" />
          <rect x={cx + 52} y={gy} width={1.5} height={5} fill={g[1]} opacity="0.4" />
          {/* Yacht 1 */}
          <polygon points={`${cx+42},${gy-4} ${cx+48},${gy-10} ${cx+48},${gy-4}`} fill={g[0]} opacity="0.5" />
          <line x1={cx + 47} y1={gy - 10} x2={cx + 47} y2={gy - 1} stroke={g[0]} strokeWidth="0.6" opacity="0.4" />
          <ellipse cx={cx + 46} cy={gy - 2} rx="4" ry="1.5" fill={g[0]} opacity="0.3" />
          {/* Yacht 2 */}
          <polygon points={`${cx+52},${gy-5} ${cx+56},${gy-8} ${cx+56},${gy-5}`} fill={g[0]} opacity="0.35" />
          <ellipse cx={cx + 55} cy={gy - 3} rx="3" ry="1.2" fill={g[0]} opacity="0.25" />
          {/* Water ripples */}
          <path d={`M${cx+36},${gy+5} Q${cx+46},${gy+3} ${cx+56},${gy+5}`} fill="none" stroke={g[0]} strokeWidth="0.4" opacity="0.2" />
          <path d={`M${cx+38},${gy+8} Q${cx+48},${gy+6} ${cx+58},${gy+8}`} fill="none" stroke={g[0]} strokeWidth="0.3" opacity="0.15" />
        </g>
      );

    case 'TECH_PARK':
      return (
        <g>
          {isoBox(cx - 34, gy, 15, 40, f, s, t, 't1')}
          {isoBox(cx - 14, gy, 18, 52, f, s, t, 't2')}
          {isoBox(cx + 10, gy, 13, 36, f, s, t, 't3')}
          {isoBox(cx + 28, gy, 16, 46, f, s, t, 't4')}
          {/* Satellite dish */}
          <path d={`M${cx-6},${gy-52} Q${cx-2},${gy-58} ${cx+2},${gy-52}`} fill="none" stroke={g[0]} strokeWidth="1" opacity="0.5" />
          <line x1={cx - 2} y1={gy - 52} x2={cx - 2} y2={gy - 55} stroke={g[0]} strokeWidth="0.6" opacity="0.5" />
          {/* LED display panels */}
          <rect x={cx + 30} y={gy - 44} width={12} height={5} fill="rgba(120,160,255,0.3)" rx="0.5" />
          <rect x={cx + 30} y={gy - 36} width={12} height={5} fill="rgba(120,160,255,0.2)" rx="0.5" />
          {/* Data lines effect */}
          <line x1={cx - 34} y1={gy - 10} x2={cx - 14} y2={gy - 10} stroke={g[0]} strokeWidth="0.4" opacity="0.15" strokeDasharray="1 2" />
          <line x1={cx + 10} y1={gy - 15} x2={cx + 28} y2={gy - 15} stroke={g[0]} strokeWidth="0.4" opacity="0.15" strokeDasharray="1 2" />
        </g>
      );

    case 'MARKET_SQ':
      return (
        <g>
          {/* Market stalls with awnings */}
          <rect x={cx - 38} y={gy - 12} width={14} height={12} fill={f} />
          <path d={`M${cx-39},${gy-12} L${cx-31},${gy-19} L${cx-23},${gy-12}`} fill={g[1]} opacity="0.8" />
          <rect x={cx - 36} y={gy - 8} width={4} height={3} fill={WIN_COLOR} rx="0.2" />

          <rect x={cx - 18} y={gy - 14} width={14} height={14} fill={f} />
          <path d={`M${cx-19},${gy-14} L${cx-11},${gy-22} L${cx-3},${gy-14}`} fill={g[1]} opacity="0.9" />
          <rect x={cx - 15} y={gy - 10} width={4} height={3} fill={WIN_COLOR} rx="0.2" />

          <rect x={cx + 2} y={gy - 12} width={14} height={12} fill={f} />
          <path d={`M${cx+1},${gy-12} L${cx+9},${gy-19} L${cx+17},${gy-12}`} fill={g[1]} opacity="0.8" />
          <rect x={cx + 5} y={gy - 8} width={4} height={3} fill={WIN_COLOR} rx="0.2" />

          <rect x={cx + 22} y={gy - 14} width={14} height={14} fill={f} />
          <path d={`M${cx+21},${gy-14} L${cx+29},${gy-22} L${cx+37},${gy-14}`} fill={g[1]} opacity="0.85" />
          <rect x={cx + 25} y={gy - 10} width={4} height={3} fill={WIN_COLOR} rx="0.2" />

          {/* Goods/crates */}
          <circle cx={cx - 32} cy={gy - 4} r="2" fill={g[0]} opacity="0.25" />
          <circle cx={cx - 28} cy={gy - 4} r="1.5" fill={g[0]} opacity="0.2" />
          <rect x={cx + 6} y={gy - 3} width="3" height="3" fill={g[0]} opacity="0.2" rx="0.3" />
          <rect x={cx + 10} y={gy - 3} width="3" height="3" fill={g[1]} opacity="0.2" rx="0.3" />
          {/* Ground line */}
          <line x1={cx - 42} y1={gy + 2} x2={cx + 40} y2={gy + 2} stroke={g[0]} strokeWidth="0.3" opacity="0.1" />
        </g>
      );

    case 'ENTERTAINMENT':
      return (
        <g>
          {isoBox(cx - 30, gy, 16, 30, f, s, t, 'e1')}
          {domeBox(cx - 8, gy, 20, 38, f, s, `${g[0]}AA`, 'e2')}
          {isoBox(cx + 18, gy, 14, 26, f, s, t, 'e3')}
          {isoBox(cx + 36, gy, 12, 20, f, s, t, 'e4')}
          {/* Marquee / theater sign */}
          <rect x={cx - 6} y={gy - 42} width={16} height={4} fill={g[0]} opacity="0.5" rx="0.5" />
          {/* Stars / spotlights */}
          <circle cx={cx - 24} cy={gy - 38} r="1.5" fill={g[0]} opacity="0.4" />
          <circle cx={cx - 24} cy={gy - 38} r="3" fill={g[0]} opacity="0.1" />
          <circle cx={cx + 25} cy={gy - 32} r="1.2" fill={g[0]} opacity="0.35" />
          <circle cx={cx + 25} cy={gy - 32} r="2.5" fill={g[0]} opacity="0.08" />
          {/* Neon sign line */}
          <line x1={cx - 28} y1={gy - 18} x2={cx - 16} y2={gy - 18} stroke={g[0]} strokeWidth="0.8" opacity="0.3" />
        </g>
      );

    case 'UNIVERSITY':
      return (
        <g>
          {domeBox(cx - 22, gy, 22, 28, f, s, `${g[0]}BB`, 'u1')}
          {pointedBox(cx + 6, gy, 14, 22, f, s, g[1], 'u2')}
          {isoBox(cx + 26, gy, 14, 18, f, s, t, 'u3')}
          {/* Grand columns on main building */}
          <line x1={cx - 17} y1={gy} x2={cx - 17} y2={gy - 24} stroke={g[0]} strokeWidth="1.2" opacity="0.4" />
          <line x1={cx - 11} y1={gy} x2={cx - 11} y2={gy - 24} stroke={g[0]} strokeWidth="1.2" opacity="0.4" />
          <line x1={cx - 5} y1={gy} x2={cx - 5} y2={gy - 24} stroke={g[0]} strokeWidth="1.2" opacity="0.4" />
          {/* Book/scroll decorative element */}
          <rect x={cx + 28} y={gy - 8} width={8} height={2} fill={g[0]} opacity="0.2" rx="0.3" />
          <rect x={cx + 29} y={gy - 10} width={7} height={2} fill={g[0]} opacity="0.18" rx="0.3" />
          <rect x={cx + 28} y={gy - 12} width={6} height={2} fill={g[0]} opacity="0.15" rx="0.3" />
        </g>
      );

    case 'HARBOR':
      return (
        <g>
          {isoBox(cx - 34, gy, 20, 18, f, s, t, 'h1')}
          {isoBox(cx - 8, gy, 18, 16, f, s, t, 'h2')}
          {/* Crane */}
          <rect x={cx + 14} y={gy - 42} width="2.5" height="42" fill={g[0]} opacity="0.8" />
          <line x1={cx + 15} y1={gy - 42} x2={cx + 38} y2={gy - 36} stroke={g[0]} strokeWidth="1.5" opacity="0.7" />
          <line x1={cx + 15} y1={gy - 42} x2={cx + 8} y2={gy - 38} stroke={g[0]} strokeWidth="1" opacity="0.5" />
          <line x1={cx + 33} y1={gy - 37} x2={cx + 33} y2={gy - 22} stroke={g[0]} strokeWidth="0.6" opacity="0.5" />
          <rect x={cx + 31} y={gy - 22} width={4} height={3} fill={g[0]} opacity="0.5" />
          {/* Shipping containers */}
          <rect x={cx + 22} y={gy - 6} width={9} height={6} fill={g[0]} opacity="0.5" rx="0.3" />
          <rect x={cx + 33} y={gy - 6} width={9} height={6} fill={g[1]} opacity="0.6" rx="0.3" />
          <rect x={cx + 25} y={gy - 12} width={9} height={6} fill={g[0]} opacity="0.35" rx="0.3" />
          <rect x={cx + 36} y={gy - 12} width={9} height={6} fill={g[1]} opacity="0.45" rx="0.3" />
          {/* Crane base */}
          <rect x={cx + 10} y={gy - 2} width={10} height={2} fill={g[0]} opacity="0.4" rx="0.3" />
        </g>
      );

    case 'INDUSTRIAL':
      return (
        <g>
          {isoBox(cx - 32, gy, 22, 22, f, s, t, 'i1')}
          {isoBox(cx - 4, gy, 20, 20, f, s, t, 'i2')}
          {isoBox(cx + 22, gy, 24, 18, f, s, t, 'i3')}
          {/* Smokestacks on building 1 */}
          <rect x={cx - 28} y={gy - 36} width="3" height="14" fill={g[1]} opacity="0.8" />
          <rect x={cx - 20} y={gy - 32} width="3" height="10" fill={g[1]} opacity="0.7" />
          {/* Smokestacks on building 2 */}
          <rect x={cx + 2} y={gy - 34} width="3" height="14" fill={g[1]} opacity="0.75" />
          {/* Smoke puffs */}
          <ellipse cx={cx - 26.5} cy={gy - 39} rx="5" ry="2.5" fill={g[0]} opacity="0.08" />
          <ellipse cx={cx - 24} cy={gy - 42} rx="4" ry="2" fill={g[0]} opacity="0.05" />
          <ellipse cx={cx + 3.5} cy={gy - 37} rx="4.5" ry="2.2" fill={g[0]} opacity="0.07" />
          {/* Pipes connecting buildings */}
          <line x1={cx - 10} y1={gy - 16} x2={cx - 4} y2={gy - 14} stroke={g[0]} strokeWidth="1.2" opacity="0.3" />
          <line x1={cx + 16} y1={gy - 14} x2={cx + 22} y2={gy - 12} stroke={g[0]} strokeWidth="1.2" opacity="0.3" />
          {/* Garage door */}
          <rect x={cx + 28} y={gy - 8} width={8} height={8} fill="rgba(0,0,0,0.12)" rx="0.3" />
        </g>
      );

    case 'SUBURBS_N':
      return (
        <g>
          {pointedBox(cx - 34, gy, 14, 14, f, s, g[1], 's1')}
          {pointedBox(cx - 14, gy, 12, 12, f, s, g[1], 's2')}
          {pointedBox(cx + 4, gy, 15, 16, f, s, g[1], 's3')}
          {pointedBox(cx + 26, gy, 12, 13, f, s, g[1], 's4')}
          {/* Trees */}
          <circle cx={cx - 24} cy={gy - 11} r="6" fill={g[0]} opacity="0.35" />
          <circle cx={cx - 22} cy={gy - 9} r="4" fill={g[0]} opacity="0.25" />
          <rect x={cx - 23} y={gy - 5} width="1.2" height="5" fill={g[1]} opacity="0.4" />
          <circle cx={cx + 20} cy={gy - 13} r="7" fill={g[0]} opacity="0.3" />
          <circle cx={cx + 22} cy={gy - 11} r="5" fill={g[0]} opacity="0.2" />
          <rect x={cx + 20.5} y={gy - 6} width="1.2" height="6" fill={g[1]} opacity="0.4" />
          {/* Fence */}
          <line x1={cx - 40} y1={gy + 3} x2={cx + 42} y2={gy + 3} stroke={g[0]} strokeWidth="0.3" opacity="0.12" />
        </g>
      );

    case 'SUBURBS_S':
      return (
        <g>
          {pointedBox(cx - 30, gy, 12, 12, f, s, g[1], 'ss1')}
          {pointedBox(cx - 12, gy, 14, 16, f, s, g[1], 'ss2')}
          {isoBox(cx + 8, gy, 18, 16, f, s, t, 'ss3')}
          {pointedBox(cx + 30, gy, 12, 14, f, s, g[1], 'ss4')}
          {/* Community center sign */}
          <rect x={cx + 10} y={gy - 20} width={14} height={3} fill={g[0]} opacity="0.3" rx="0.5" />
          {/* Bushes */}
          <circle cx={cx - 40} cy={gy - 3} r="3.5" fill={g[0]} opacity="0.25" />
          <circle cx={cx + 44} cy={gy - 3} r="4" fill={g[0]} opacity="0.2" />
          {/* Path */}
          <line x1={cx - 30} y1={gy + 2} x2={cx + 42} y2={gy + 2} stroke={g[0]} strokeWidth="0.4" opacity="0.1" strokeDasharray="3 2" />
        </g>
      );

    case 'OUTSKIRTS':
      return (
        <g>
          {pointedBox(cx - 24, gy, 16, 16, f, s, g[1], 'out1')}
          {isoBox(cx, gy, 12, 10, f, s, t, 'out2')}
          {/* Windmill */}
          <rect x={cx + 20} y={gy - 26} width="4" height="26" fill={g[0]} opacity="0.7" />
          <circle cx={cx + 22} cy={gy - 26} r="1.8" fill={g[1]} opacity="0.6" />
          <line x1={cx + 22} y1={gy - 26} x2={cx + 22} y2={gy - 38} stroke={g[0]} strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
          <line x1={cx + 22} y1={gy - 26} x2={cx + 32} y2={gy - 22} stroke={g[0]} strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
          <line x1={cx + 22} y1={gy - 26} x2={cx + 12} y2={gy - 22} stroke={g[0]} strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
          <line x1={cx + 22} y1={gy - 26} x2={cx + 26} y2={gy - 16} stroke={g[0]} strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
          {/* Field lines */}
          <line x1={cx - 36} y1={gy + 3} x2={cx - 10} y2={gy + 3} stroke={g[0]} strokeWidth="0.3" opacity="0.1" />
          <line x1={cx - 34} y1={gy + 6} x2={cx - 12} y2={gy + 6} stroke={g[0]} strokeWidth="0.3" opacity="0.08" />
          <line x1={cx - 32} y1={gy + 9} x2={cx - 14} y2={gy + 9} stroke={g[0]} strokeWidth="0.3" opacity="0.06" />
          {/* Silo */}
          <rect x={cx - 8} y={gy - 14} width="5" height="14" fill={g[0]} opacity="0.3" rx="2.5" />
          <ellipse cx={cx - 5.5} cy={gy - 14} rx="2.5" ry="1.5" fill={g[0]} opacity="0.2" />
        </g>
      );

    default:
      return null;
  }
}

// ── Road segments (pairs of district codes for natural adjacencies) ──

const ROADS: [string, string][] = [
  ['SUBURBS_N', 'OLD_TOWN'],
  ['SUBURBS_N', 'OUTSKIRTS'],
  ['OLD_TOWN', 'CBD'],
  ['CBD', 'MARINA'],
  ['CBD', 'TECH_PARK'],
  ['CBD', 'MARKET_SQ'],
  ['MARINA', 'HARBOR'],
  ['HARBOR', 'INDUSTRIAL'],
  ['TECH_PARK', 'ENTERTAINMENT'],
  ['TECH_PARK', 'INDUSTRIAL'],
  ['MARKET_SQ', 'ENTERTAINMENT'],
  ['MARKET_SQ', 'UNIVERSITY'],
  ['UNIVERSITY', 'OUTSKIRTS'],
  ['UNIVERSITY', 'SUBURBS_S'],
  ['OUTSKIRTS', 'SUBURBS_S'],
  ['OLD_TOWN', 'MARKET_SQ'],
];

export function CityMap({ onDistrictSelect, selectedCode }: CityMapProps) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

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
        viewBox="-100 -60 900 700"
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
          <filter id="fog" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="20" />
          </filter>

          {/* ── Per-district gradients ── */}
          {DISTRICTS.map((d) => (
            <linearGradient key={`grad-${d.code}`} id={`grad-${d.code}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={d.gradient[0]} stopOpacity="0.7" />
              <stop offset="100%" stopColor={d.gradient[1]} stopOpacity="0.85" />
            </linearGradient>
          ))}

          {/* ── Per-district clip paths ── */}
          {DISTRICTS.map((d) => (
            <clipPath key={`clip-${d.code}`} id={`clip-${d.code}`}>
              <polygon points={d.points} />
            </clipPath>
          ))}

          {/* ── Glass overlay gradient ── */}
          <linearGradient id="glass-overlay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.06" />
          </linearGradient>

          {/* ── Background gradient ── */}
          <radialGradient id="bg-radial" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#8BC34A" />
            <stop offset="60%" stopColor="#7CB342" />
            <stop offset="100%" stopColor="#558B2F" />
          </radialGradient>

          {/* ── Water gradient (shore → deep) ── */}
          <linearGradient id="water-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#29B6F6" stopOpacity="0.3" />
            <stop offset="40%" stopColor="#0288D1" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#01579B" stopOpacity="0.85" />
          </linearGradient>

          {/* ── Sand strip gradient ── */}
          <linearGradient id="sand-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFE0B2" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFE0B2" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFCC80" stopOpacity="0.75" />
          </linearGradient>

          {/* ── Sunlight radial ── */}
          <radialGradient id="sunlight" cx="15%" cy="10%" r="60%">
            <stop offset="0%" stopColor="#FFF9C4" stopOpacity="0.10" />
            <stop offset="60%" stopColor="#FFF9C4" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#FFF9C4" stopOpacity="0" />
          </radialGradient>

          {/* ── Tree symbol ── */}
          <symbol id="tree-oak" viewBox="0 0 20 28">
            <rect x="9" y="18" width="2" height="10" fill="#5D4037" rx="0.5" />
            <circle cx="10" cy="12" r="8" fill="#4CAF50" opacity="0.8" />
            <circle cx="7" cy="9" r="5" fill="#66BB6A" opacity="0.6" />
            <circle cx="13" cy="10" r="4" fill="#43A047" opacity="0.5" />
          </symbol>
        </defs>

        {/* ═══ Terrain background ═══ */}
        <rect x="-100" y="-60" width="900" height="700" fill="url(#bg-radial)" />

        {/* ── Mountains (north edge) ── */}
        <polygon points="-60,-40 20,-50 100,30" fill="#78909C" opacity="0.5" />
        <polygon points="30,-50 120,-60 180,10" fill="#90A4AE" opacity="0.6" />
        <polygon points="170,-60 270,-55 340,20" fill="#78909C" opacity="0.55" />
        <polygon points="280,-50 380,-60 460,30" fill="#90A4AE" opacity="0.5" />
        <polygon points="420,-55 510,-60 580,15" fill="#78909C" opacity="0.6" />
        <polygon points="530,-55 620,-50 690,25" fill="#90A4AE" opacity="0.55" />
        <polygon points="650,-50 730,-60 790,10" fill="#78909C" opacity="0.45" />
        <polygon points="100,-45 180,-55 230,15" fill="#607D8B" opacity="0.35" />
        {/* Snow caps */}
        <polygon points="90,-48 120,-60 150,-48" fill="#ECEFF1" opacity="0.7" />
        <polygon points="240,-43 270,-55 300,-43" fill="#ECEFF1" opacity="0.65" />
        <polygon points="460,-43 510,-60 555,-43" fill="#ECEFF1" opacity="0.7" />
        <polygon points="610,-38 620,-50 640,-38" fill="#ECEFF1" opacity="0.5" />

        {/* ── East coastline ── */}
        <path
          d="M580,-60 Q620,0 640,80 Q660,180 670,280 Q680,380 660,480 Q640,560 620,640 L800,640 L800,-60 Z"
          fill="url(#water-grad)"
        />
        {/* Wave lines */}
        <path d="M610,50 Q650,45 690,50" fill="none" stroke="#29B6F6" strokeWidth="0.5" opacity="0.2" />
        <path d="M620,150 Q660,145 700,150" fill="none" stroke="#29B6F6" strokeWidth="0.4" opacity="0.15" />
        <path d="M630,250 Q670,245 710,250" fill="none" stroke="#29B6F6" strokeWidth="0.4" opacity="0.15" />
        <path d="M625,350 Q665,345 705,350" fill="none" stroke="#29B6F6" strokeWidth="0.3" opacity="0.12" />
        <path d="M615,450 Q655,445 695,450" fill="none" stroke="#29B6F6" strokeWidth="0.3" opacity="0.12" />

        {/* ── Sand strip ── */}
        <path
          d="M565,-60 Q605,0 625,80 Q645,180 655,280 Q665,380 645,480 Q625,560 605,640 L620,640 Q640,560 660,480 Q680,380 670,280 Q660,180 640,80 Q620,0 580,-60 Z"
          fill="url(#sand-grad)"
        />

        {/* ── River (top-center through CBD to coast) ── */}
        <path
          d="M300,-20 Q310,40 330,100 Q350,160 380,210 Q420,260 480,290 Q540,310 600,320 Q640,330 660,340"
          fill="none" stroke="#4FC3F7" strokeWidth="8" opacity="0.5"
          strokeLinecap="round" strokeLinejoin="round"
        />
        {/* River highlight */}
        <path
          d="M300,-20 Q310,40 330,100 Q350,160 380,210 Q420,260 480,290 Q540,310 600,320 Q640,330 660,340"
          fill="none" stroke="#81D4FA" strokeWidth="2" opacity="0.25"
          strokeLinecap="round" strokeDasharray="6 4"
        />

        {/* ── Scattered trees ── */}
        <use href="#tree-oak" x="-80" y="50" width="18" height="25" opacity="0.8" />
        <use href="#tree-oak" x="-60" y="120" width="16" height="22" opacity="0.7" />
        <use href="#tree-oak" x="-40" y="200" width="20" height="28" opacity="0.85" />
        <use href="#tree-oak" x="-70" y="300" width="17" height="24" opacity="0.75" />
        <use href="#tree-oak" x="-50" y="400" width="19" height="26" opacity="0.8" />
        <use href="#tree-oak" x="-30" y="480" width="15" height="21" opacity="0.7" />
        <use href="#tree-oak" x="40" y="30" width="16" height="22" opacity="0.65" />
        <use href="#tree-oak" x="90" y="90" width="18" height="25" opacity="0.75" />
        <use href="#tree-oak" x="120" y="150" width="14" height="20" opacity="0.6" />
        <use href="#tree-oak" x="70" y="260" width="19" height="26" opacity="0.8" />
        <use href="#tree-oak" x="100" y="330" width="16" height="22" opacity="0.7" />
        <use href="#tree-oak" x="80" y="420" width="18" height="25" opacity="0.75" />
        <use href="#tree-oak" x="60" y="500" width="20" height="28" opacity="0.85" />
        <use href="#tree-oak" x="130" y="500" width="15" height="21" opacity="0.65" />
        <use href="#tree-oak" x="200" y="80" width="17" height="24" opacity="0.7" />
        <use href="#tree-oak" x="250" y="90" width="16" height="22" opacity="0.6" />
        <use href="#tree-oak" x="310" y="50" width="18" height="25" opacity="0.75" />
        <use href="#tree-oak" x="200" y="430" width="19" height="26" opacity="0.8" />
        <use href="#tree-oak" x="250" y="460" width="16" height="22" opacity="0.7" />
        <use href="#tree-oak" x="300" y="500" width="20" height="28" opacity="0.9" />
        <use href="#tree-oak" x="350" y="460" width="15" height="21" opacity="0.65" />
        <use href="#tree-oak" x="400" y="440" width="17" height="24" opacity="0.7" />
        <use href="#tree-oak" x="430" y="500" width="18" height="25" opacity="0.75" />
        <use href="#tree-oak" x="470" y="80" width="16" height="22" opacity="0.6" />
        <use href="#tree-oak" x="520" y="100" width="19" height="26" opacity="0.7" />
        <use href="#tree-oak" x="500" y="420" width="17" height="24" opacity="0.7" />
        <use href="#tree-oak" x="540" y="430" width="16" height="22" opacity="0.65" />
        <use href="#tree-oak" x="150" y="570" width="18" height="25" opacity="0.8" />
        <use href="#tree-oak" x="220" y="560" width="20" height="28" opacity="0.85" />
        <use href="#tree-oak" x="350" y="550" width="16" height="22" opacity="0.7" />
        <use href="#tree-oak" x="450" y="540" width="19" height="26" opacity="0.8" />
        <use href="#tree-oak" x="500" y="550" width="15" height="21" opacity="0.65" />
        <use href="#tree-oak" x="-20" y="550" width="18" height="25" opacity="0.8" />
        <use href="#tree-oak" x="30" y="580" width="17" height="24" opacity="0.75" />
        <use href="#tree-oak" x="560" y="200" width="14" height="20" opacity="0.6" />

        {/* ── Tonal variation patches ── */}
        <ellipse cx="180" cy="130" rx="60" ry="40" fill="#2E7D32" opacity="0.12" />
        <ellipse cx="160" cy="380" rx="55" ry="40" fill="#1B5E20" opacity="0.10" />
        <ellipse cx="160" cy="290" rx="35" ry="25" fill="#33691E" opacity="0.08" />

        {/* ── Industrial haze ── */}
        <ellipse cx="560" cy="320" rx="50" ry="40" fill="#78716C" opacity="0.08" />

        {/* ── Atmospheric fog spots ── */}
        <circle cx="330" cy="250" r="80" fill="#FFF9C4" opacity="0.02" filter="url(#fog)" />
        <circle cx="150" cy="200" r="60" fill="#FFF9C4" opacity="0.015" filter="url(#fog)" />
        <circle cx="500" cy="180" r="50" fill="#E1F5FE" opacity="0.015" filter="url(#fog)" />

        {/* ── Sunlight overlay ── */}
        <rect x="-100" y="-60" width="900" height="700" fill="url(#sunlight)" />

        {/* ═══ Road network ═══ */}
        <g opacity="0.12">
          {ROADS.map(([a, b], i) => {
            const ca = centers[a];
            const cb = centers[b];
            if (!ca || !cb) return null;
            const mx = (ca.x + cb.x) / 2 + (i % 2 === 0 ? 5 : -5);
            const my = (ca.y + cb.y) / 2 + (i % 3 === 0 ? 5 : -3);
            return (
              <path
                key={`road-${a}-${b}`}
                d={`M${ca.x},${ca.y} Q${mx},${my} ${cb.x},${cb.y}`}
                fill="none"
                stroke="hsl(210 20% 70%)"
                strokeWidth="1"
                strokeDasharray="4 3"
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* ═══ Districts ═══ */}
        {DISTRICTS.map((d, idx) => {
          const isSelected = selectedCode === d.code;
          const isHovered = hoveredCode === d.code;
          const isActive = isSelected || isHovered;
          const center = centers[d.code];

          return (
            <g key={d.code}>
              {/* Glow behind active district */}
              {isActive && (
                <polygon
                  points={d.points}
                  fill={d.gradient[0]}
                  opacity="0.35"
                  filter="url(#district-glow)"
                  className="pointer-events-none"
                />
              )}

              {/* Clipped content: gradient background + 3D buildings + glass overlay */}
              <g clipPath={`url(#clip-${d.code})`} className="pointer-events-none">
                {/* Background gradient fill */}
                <polygon
                  points={d.points}
                  fill={`url(#grad-${d.code})`}
                  opacity={isActive ? 0.9 : 0.6}
                  style={{ transition: 'opacity 300ms ease' }}
                />

                {/* 3D isometric building scene */}
                {center && renderDistrictScene(d.code, center.x, center.y, d.gradient)}

                {/* Glass overlay for depth */}
                <polygon
                  points={d.points}
                  fill="url(#glass-overlay)"
                  opacity={isActive ? 0.6 : 0.35}
                  style={{ transition: 'opacity 300ms ease' }}
                />
              </g>

              {/* Border */}
              <polygon
                points={d.points}
                fill="none"
                stroke={
                  isSelected
                    ? 'hsl(192 91% 52%)'
                    : isHovered
                      ? 'hsl(192 70% 45%)'
                      : d.stroke
                }
                strokeWidth={isSelected ? 2.5 : isHovered ? 1.8 : 0.4}
                className="pointer-events-none"
                style={{ transition: 'stroke 300ms ease, stroke-width 300ms ease' }}
              />

              {/* Clickable transparent overlay — catches all mouse/touch events */}
              <polygon
                points={d.points}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredCode(d.code)}
                onMouseLeave={() => setHoveredCode(null)}
                onClick={() => onDistrictSelect?.(d)}
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
                    fill: isActive ? '#fff' : 'hsl(210 20% 80%)',
                    fontSize: isActive ? '9px' : '8px',
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase' as const,
                    textShadow: isActive
                      ? `0 0 10px ${d.gradient[0]}80, 0 1px 4px rgba(0,0,0,0.9)`
                      : '0 1px 3px rgba(0,0,0,0.8)',
                    transition: 'fill 300ms ease, font-size 300ms ease',
                  }}
                >
                  {d.name.length > 14 ? d.code.replace(/_/g, ' ') : d.name}
                </text>
              )}
            </g>
          );
        })}

        {/* ═══ Vignette overlay (pointer-events-none to not block clicks) ═══ */}
        <rect
          x="-100" y="-60" width="900" height="700"
          fill="url(#bg-radial)" opacity="0.15"
          style={{ mixBlendMode: 'multiply' }}
          className="pointer-events-none"
        />

        {/* ═══ Outer frame (pointer-events-none to not block clicks) ═══ */}
        <rect
          x="-100" y="-60" width="900" height="700"
          fill="none"
          stroke="#7CB342"
          strokeWidth="0.8"
          opacity="0.2"
          rx="2"
          className="pointer-events-none"
        />
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
